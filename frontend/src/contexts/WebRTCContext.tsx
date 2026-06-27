"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { useSignaling } from "./SignalingContext";
import { createPeerConnection } from "@/lib/webrtc";
import { readSettings } from "@/hooks/useSettings";
import type {
  RoomStateMsg,
  ScreenShareStartFromMsg, ScreenShareStopFromMsg,
  SpeakerJoinedMsg, SpeakerLeftMsg, ViewerBecameListenerMsg, WebRTCAnswerFromMsg,
  WebRTCIceFromMsg, WebRTCOfferFromMsg,
} from "@/types/signaling";

interface WebRTCCtx {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  remoteScreenStreams: Map<string, MediaStream>;
  micEnabled: boolean;
  camEnabled: boolean;
  screenSharingPeerIds: Set<string>;
  localScreenStream: MediaStream | null;
  pings: Map<string, number | null>;
  toggleMic: () => void;
  toggleCam: () => void;
  startLocalMedia: () => Promise<void>;
  stopLocalMedia: () => void;
  setMicDevice: (deviceId: string) => Promise<void>;
  setCamDevice: (deviceId: string) => Promise<void>;
  startLocalScreenShare: (stream: MediaStream) => Promise<void>;
  stopLocalScreenShare: () => Promise<void>;
  hwCodecs: Set<string>;
  dumpDebug: () => Promise<void>;
}

const Ctx = createContext<WebRTCCtx | null>(null);

export function WebRTCProvider({
  myPeerId,
  isSpeaker,
  isViewer,
  children,
}: {
  myPeerId: string;
  isSpeaker: boolean;
  isViewer: boolean;
  children: React.ReactNode;
}) {
  const { send, on } = useSignaling();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(false);
  const [screenSharingPeerIds, setScreenSharingPeerIds] = useState<Set<string>>(new Set());
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [pings, setPings] = useState<Map<string, number | null>>(new Map());
  // Codecs with confirmed hardware acceleration (via VideoEncoder.isConfigSupported)
  const [hwCodecs, setHwCodecs] = useState<Set<string>>(new Set());
  const hwCodecsRef = useRef<Set<string>>(new Set());
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  // Screen share tracks (applied to all PCs via replaceTrack — no renegotiation)
  const screenVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  // Per-peer senders for the screen video (mid "2") and screen audio (mid "3") slots
  const screenVideoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenAudioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const pingsRef = useRef<Map<string, number | null>>(new Map());
  const isSpeakerRef = useRef(isSpeaker);
  const isViewerRef = useRef(isViewer);
  isSpeakerRef.current = isSpeaker;
  isViewerRef.current = isViewer;

  const addRemoteStream = useCallback((peerId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
  }, []);

  const addTrackToRemoteStream = useCallback((peerId: string, track: MediaStreamTrack) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      const existing = next.get(peerId);
      if (existing) {
        if (!existing.getTrackById(track.id)) existing.addTrack(track);
        return next;
      }
      return next.set(peerId, new MediaStream([track]));
    });
  }, []);

  // Routes mid "2" (screen video) and mid "3" (screen audio) tracks into a
  // shared MediaStream per peer so ScreenSharePreview can play both together.
  const addRemoteScreenTrack = useCallback((peerId: string, track: MediaStreamTrack) => {
    setRemoteScreenStreams((prev) => {
      const next = new Map(prev);
      const existing = next.get(peerId);
      if (existing) {
        if (!existing.getTrackById(track.id)) existing.addTrack(track);
        return new Map(next);
      }
      return next.set(peerId, new MediaStream([track]));
    });
  }, []);

  const removeRemoteStream = useCallback((peerId: string) => {
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const removeRemoteScreenStream = useCallback((peerId: string) => {
    setRemoteScreenStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const drainPendingCandidates = useCallback(async (peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (!pc) return;
    const pending = pendingCandidatesRef.current.get(peerId) ?? [];
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn(`[WebRTC] addIceCandidate (queued) failed peer=${peerId}`, e);
      }
    }
  }, []);

  // Build the ordered codec list for a video transceiver.
  //
  // Manual override: the user-chosen codec goes first.
  // Auto mode: hardware-accelerated codecs are ranked above software equivalents.
  //   Priority within HW tier: AV1 > VP9 > H.264
  //   Priority within SW tier: AV1 > VP9 > H.264
  //   So: HW-AV1 > HW-VP9 > HW-H264 > SW-AV1 > SW-VP9 > SW-H264 > VP8 > rest
  //
  // H.264 entries are filtered to level-asymmetry-allowed=1 + packetization-mode=1
  // and sorted High profile (0x64) > Main (0x4d) > Baseline (0x42).
  const applyVideoCodecPreference = useCallback((transceiver: RTCRtpTransceiver) => {
    const caps = RTCRtpSender.getCapabilities("video");
    if (!caps) return;

    const hw   = hwCodecsRef.current;
    const mime = (c: RTCRtpCodec) => c.mimeType.toLowerCase();

    const h264ProfileOf = (sdp?: string) => {
      const m = (sdp ?? "").match(/profile-level-id=([0-9a-f]{6})/i);
      return m ? parseInt(m[1].slice(0, 2), 16) : 0;
    };

    // H.264 must have level-asymmetry-allowed=1 + packetization-mode=1
    const isUsableH264 = (c: RTCRtpCodec) => {
      if (mime(c) !== "video/h264") return false;
      const p = c.sdpFmtpLine ?? "";
      return p.includes("level-asymmetry-allowed=1") && p.includes("packetization-mode=1");
    };

    const sortedH264 = caps.codecs
      .filter(isUsableH264)
      .sort((a, b) => h264ProfileOf(b.sdpFmtpLine) - h264ProfileOf(a.sdpFmtpLine));

    const { screenCodec } = readSettings();

    if (screenCodec !== "auto") {
      // Manual override: put the chosen codec family first, rest after
      let chosen: RTCRtpCodec[];
      if (screenCodec === "h264") {
        chosen = sortedH264;
      } else {
        const needle = `video/${screenCodec}`;
        chosen = caps.codecs.filter((c) => mime(c) === needle);
      }
      const rest = caps.codecs.filter((c) => !chosen.includes(c));
      try { transceiver.setCodecPreferences([...chosen, ...rest]); } catch {}
      return;
    }

    // Auto: split each codec into HW and SW buckets, then rank HW > SW within AV1 > VP9 > H264
    const bucket = (name: string, filter: (c: RTCRtpCodec) => boolean) => {
      const all = caps.codecs.filter(filter);
      return hw.has(name) ? { hw: all, sw: [] as RTCRtpCodec[] } : { hw: [], sw: all };
    };

    const av1  = bucket("av1",  (c) => mime(c) === "video/av1");
    const vp9  = bucket("vp9",  (c) => mime(c) === "video/vp9");
    const h264 = hw.has("h264")
      ? { hw: sortedH264, sw: [] as RTCRtpCodec[] }
      : { hw: [],         sw: sortedH264 };

    const ordered = [
      ...av1.hw, ...vp9.hw, ...h264.hw,   // hardware tier
      ...av1.sw, ...vp9.sw, ...h264.sw,   // software tier
    ];
    const prioritized = new Set(ordered);
    const rest = caps.codecs.filter((c) => !prioritized.has(c));
    try { transceiver.setCodecPreferences([...ordered, ...rest]); } catch {}
  }, []);

  const createPC = useCallback((peerId: string, receiveOnly: boolean): RTCPeerConnection => {
    if (pcsRef.current.has(peerId)) {
      console.log(`[WebRTC] createPC peer=${peerId} — closing existing PC`);
      pcsRef.current.get(peerId)?.close();
    }
    pendingCandidatesRef.current.delete(peerId);
    console.log(`[WebRTC] createPC peer=${peerId} receiveOnly=${receiveOnly}`);

    const pc = createPeerConnection();

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.debug(`[WebRTC] ICE candidate for peer=${peerId} type=${candidate.type}`);
        send({ type: "webrtc_ice", target_peer_id: peerId, candidate: candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] PC[${peerId}] iceConnectionState → ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] PC[${peerId}] connectionState → ${pc.connectionState}`);
    };

    // Transceiver layout (same order on all paths so mids are consistent):
    //   mid "0" — mic audio
    //   mid "1" — camera video
    //   mid "2" — screen video
    //   mid "3" — screen audio
    pc.ontrack = ({ track, streams, transceiver }) => {
      if (transceiver.mid === "2" || transceiver.mid === "3") {
        addRemoteScreenTrack(peerId, track);
        return;
      }
      if (streams[0]) {
        addRemoteStream(peerId, streams[0]);
      } else {
        addTrackToRemoteStream(peerId, track);
      }
    };

    if (receiveOnly) {
      pc.addTransceiver("audio", { direction: "recvonly" }); // mid "0" mic
      pc.addTransceiver("video", { direction: "recvonly" }); // mid "1" camera
      pc.addTransceiver("video", { direction: "recvonly" }); // mid "2" screen video
      pc.addTransceiver("audio", { direction: "recvonly" }); // mid "3" screen audio
    } else {
      const localStream = localStreamRef.current;
      const audioTrack = localStream?.getAudioTracks()[0] ?? null;
      const videoTrack = localStream?.getVideoTracks()[0] ?? null;
      pc.addTransceiver(audioTrack ?? "audio", { direction: "sendrecv", streams: audioTrack ? [localStream!] : [] }); // mid "0"
      const camTransceiver = pc.addTransceiver(videoTrack ?? "video", { direction: "sendrecv", streams: videoTrack ? [localStream!] : [] }); // mid "1"
      applyVideoCodecPreference(camTransceiver);

      const svt = pc.addTransceiver("video", { direction: "sendrecv" }); // mid "2" screen video
      applyVideoCodecPreference(svt);
      const sat = pc.addTransceiver("audio", { direction: "sendrecv" }); // mid "3" screen audio
      screenVideoSendersRef.current.set(peerId, svt.sender);
      screenAudioSendersRef.current.set(peerId, sat.sender);

      // If already screen sharing, apply tracks to the new PC immediately
      if (screenVideoTrackRef.current) svt.sender.replaceTrack(screenVideoTrackRef.current);
      if (screenAudioTrackRef.current) sat.sender.replaceTrack(screenAudioTrackRef.current);
    }

    pcsRef.current.set(peerId, pc);
    return pc;
  }, [send, addRemoteStream, addTrackToRemoteStream, addRemoteScreenTrack]);

  const closePeer = useCallback((peerId: string) => {
    pcsRef.current.get(peerId)?.close();
    pcsRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    screenVideoSendersRef.current.delete(peerId);
    screenAudioSendersRef.current.delete(peerId);
    removeRemoteStream(peerId);
    removeRemoteScreenStream(peerId);
    pingsRef.current.delete(peerId);
  }, [removeRemoteStream, removeRemoteScreenStream]);

  // ─── Hardware codec detection ─────────────────────────────────────────────
  // Uses VideoEncoder.isConfigSupported with hardwareAcceleration:'require-hardware'
  // so we only mark a codec as HW-accelerated when the browser confirms it.
  useEffect(() => {
    if (typeof VideoEncoder === "undefined") return;
    const tests: Array<{ name: string; codec: string }> = [
      { name: "av1",  codec: "av01.0.04M.08" },
      { name: "vp9",  codec: "vp09.00.10.08" },
      { name: "h264", codec: "avc1.640034"    },
    ];
    Promise.all(
      tests.map(async ({ name, codec }) => {
        try {
          const res = await (VideoEncoder as any).isConfigSupported({
            codec,
            width: 1920,
            height: 1080,
            hardwareAcceleration: "require-hardware",
          });
          if (res.supported) {
            hwCodecsRef.current = new Set([...hwCodecsRef.current, name]);
          }
        } catch {}
      })
    ).then(() => setHwCodecs(new Set(hwCodecsRef.current)));
  }, []);

  // ─── Ping tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    const checkAllPings = async () => {
      const newPings = new Map<string, number | null>();

      for (const [peerId, pc] of pcsRef.current.entries()) {
        try {
          const stats = await pc.getStats();
          let currentRtt: number | null = null;

          stats.forEach((report) => {
            if (report.type === "inbound-rtp") {
              const roundTripTime = (report as any).roundTripTime;
              if (roundTripTime !== undefined && roundTripTime > 0) {
                currentRtt = Math.round(roundTripTime * 1000);
              }
            }
            if (report.type === "candidate-pair") {
              const currentRoundTripTime = (report as any).currentRoundTripTime;
              if (
                currentRoundTripTime !== undefined &&
                currentRoundTripTime > 0 &&
                currentRtt === null
              ) {
                currentRtt = Math.round(currentRoundTripTime * 1000);
              }
            }
          });

          newPings.set(peerId, currentRtt);
        } catch (error) {
          console.error(`Error checking stats for peer ${peerId}:`, error);
          newPings.set(peerId, null);
        }
      }

      pingsRef.current = newPings;
      setPings(new Map(newPings));
    };

    const interval = setInterval(checkAllPings, 500);
    checkAllPings();

    return () => clearInterval(interval);
  }, []);

  // ─── WebRTC signaling listeners ───────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      on("room_state", (m) => {
        const { screen_sharing_peer_ids } = m as RoomStateMsg;
        if (screen_sharing_peer_ids?.length) {
          setScreenSharingPeerIds(new Set(screen_sharing_peer_ids));
        }
      }),

      on("speaker_joined", async (m) => {
        const { peer_id } = m as SpeakerJoinedMsg;
        if (peer_id === myPeerId) {
          isSpeakerRef.current = true;
          isViewerRef.current = false;
          console.log("[WebRTC] speaker_joined=self → isSpeakerRef set true, isViewerRef cleared");
          return;
        }
        if (isViewerRef.current) return;

        const receiveOnly = !isSpeakerRef.current;
        console.log(`[WebRTC] speaker_joined peer=${peer_id} isSpeaker=${isSpeakerRef.current} → receiveOnly=${receiveOnly}`);
        const pc = createPC(peer_id, receiveOnly);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "webrtc_offer", target_peer_id: peer_id, sdp: offer.sdp! });
        console.log(`[WebRTC] sent offer to ${peer_id}`);
      }),

      on("viewer_became_listener", async (m) => {
        const { peer_id } = m as ViewerBecameListenerMsg;
        if (peer_id === myPeerId) {
          isViewerRef.current = false;
          return;
        }
        if (!isSpeakerRef.current) return;

        const pc = createPC(peer_id, false);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "webrtc_offer", target_peer_id: peer_id, sdp: offer.sdp! });
      }),

      on("speaker_left", (m) => {
        const { peer_id } = m as SpeakerLeftMsg;
        closePeer(peer_id);
        setScreenSharingPeerIds((prev) => {
          const next = new Set(prev);
          next.delete(peer_id);
          return next;
        });
      }),

      on("participant_left", (m: { peer_id?: string } & Record<string, unknown>) => {
        if (m.peer_id) closePeer(m.peer_id as string);
      }),

      on("webrtc_offer", async (m) => {
        if (isViewerRef.current) return;
        const { from_peer_id, sdp } = m as WebRTCOfferFromMsg;
        const isSpeakerNow = isSpeakerRef.current;
        console.log(`[WebRTC] webrtc_offer from=${from_peer_id} isSpeaker=${isSpeakerNow}`);

        pcsRef.current.get(from_peer_id)?.close();
        const pc = createPeerConnection();
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) send({ type: "webrtc_ice", target_peer_id: from_peer_id, candidate: candidate.toJSON() });
        };
        pc.ontrack = ({ track, streams, transceiver }) => {
          if (transceiver.mid === "2" || transceiver.mid === "3") {
            addRemoteScreenTrack(from_peer_id, track);
            return;
          }
          if (streams[0]) addRemoteStream(from_peer_id, streams[0]);
          else addTrackToRemoteStream(from_peer_id, track);
        };
        pcsRef.current.set(from_peer_id, pc);

        await pc.setRemoteDescription({ type: "offer", sdp });
        await drainPendingCandidates(from_peer_id);

        if (isSpeakerNow) {
          const stream = localStreamRef.current;
          for (const transceiver of pc.getTransceivers()) {
            transceiver.direction = "sendrecv";
            let track: MediaStreamTrack | null = null;
            if (transceiver.mid === "2") {
              track = screenVideoTrackRef.current;
            } else if (transceiver.mid === "3") {
              track = screenAudioTrackRef.current;
            } else if (transceiver.receiver.track.kind === "audio") {
              track = stream?.getAudioTracks()[0] ?? null;
            } else {
              track = stream?.getVideoTracks()[0] ?? null;
            }
            if (track) await transceiver.sender.replaceTrack(track);
          }

          // Store screen senders so replaceTrack works when sharing starts/stops later
          const svt = pc.getTransceivers().find((t) => t.mid === "2");
          const sat = pc.getTransceivers().find((t) => t.mid === "3");
          if (svt) screenVideoSendersRef.current.set(from_peer_id, svt.sender);
          if (sat) screenAudioSendersRef.current.set(from_peer_id, sat.sender);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "webrtc_answer", target_peer_id: from_peer_id, sdp: answer.sdp! });
        console.log(`[WebRTC] sent answer to ${from_peer_id}, transceivers:`,
          pc.getTransceivers().map(t => `mid=${t.mid} ${t.receiver.track.kind} dir=${t.direction} senderTrack=${t.sender.track?.label ?? "null"}`));
      }),

      on("webrtc_answer", async (m) => {
        const { from_peer_id, sdp } = m as WebRTCAnswerFromMsg;
        console.log(`[WebRTC] webrtc_answer from=${from_peer_id}`);
        const pc = pcsRef.current.get(from_peer_id);
        if (!pc || pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription({ type: "answer", sdp });
        await drainPendingCandidates(from_peer_id);
      }),

      on("webrtc_ice", async (m) => {
        const { from_peer_id, candidate } = m as WebRTCIceFromMsg;
        const pc = pcsRef.current.get(from_peer_id);
        if (!pc || pc.remoteDescription === null) {
          const buf = pendingCandidatesRef.current.get(from_peer_id) ?? [];
          buf.push(candidate);
          pendingCandidatesRef.current.set(from_peer_id, buf);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn(`[WebRTC] addIceCandidate failed peer=${from_peer_id}`, e);
        }
      }),

      on("screen_share_start", (m) => {
        setScreenSharingPeerIds((prev) => new Set([...prev, (m as ScreenShareStartFromMsg).peer_id]));
      }),

      on("screen_share_stop", (m) => {
        const { peer_id } = m as ScreenShareStopFromMsg;
        setScreenSharingPeerIds((prev) => {
          const next = new Set(prev);
          next.delete(peer_id);
          return next;
        });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, send, myPeerId, createPC, closePeer, drainPendingCandidates]);

  // ─── Local media ─────────────────────────────────────────────────────────
  const startLocalMedia = useCallback(async () => {
    console.log("[WebRTC] startLocalMedia — requesting mic");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const tracks = stream.getTracks().map((t) => `${t.kind}:${t.label}`).join(", ");
    console.log(`[WebRTC] startLocalMedia — got stream tracks: ${tracks}`);
    localStreamRef.current = stream;
    setLocalStream(stream);
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
      setMicEnabled(t.enabled);
    });
  }, []);

  const toggleCam = useCallback(async () => {
    const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (videoTracks.length > 0) {
      videoTracks.forEach((t) => {
        t.enabled = !t.enabled;
        setCamEnabled(t.enabled);
      });
      return;
    }
    // No video track yet — acquire one now
    try {
      const { camDeviceId } = readSettings();
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: camDeviceId ? { deviceId: { exact: camDeviceId } } : true,
      });
      const newTrack = newStream.getVideoTracks()[0];
      const old = localStreamRef.current;
      if (old) {
        const next = new MediaStream([...old.getAudioTracks(), newTrack]);
        localStreamRef.current = next;
        setLocalStream(next);
      }
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getTransceivers().find((t) => t.mid === "1")?.sender;
        if (sender) await sender.replaceTrack(newTrack);
      }
      setCamEnabled(true);
    } catch (e) {
      console.warn("[WebRTC] toggleCam: failed to acquire camera", e);
    }
  }, []);

  // ─── Add local tracks to existing peer connections when media becomes available ───
  useEffect(() => {
    if (!localStreamRef.current) return;
    console.log("[WebRTC] localStream ready — filling null senders across", pcsRef.current.size, "PC(s)");

    // Build a set of screen senders to skip — those slots are managed separately
    const screenSenders = new Set([
      ...screenVideoSendersRef.current.values(),
      ...screenAudioSendersRef.current.values(),
    ]);

    for (const [peerId, pc] of pcsRef.current.entries()) {
      for (const transceiver of pc.getTransceivers()) {
        if (transceiver.sender.track !== null) continue;
        if (screenSenders.has(transceiver.sender)) continue;
        const kind = transceiver.receiver.track.kind;
        const track =
          kind === "audio"
            ? localStreamRef.current!.getAudioTracks()[0]
            : localStreamRef.current!.getVideoTracks()[0];
        if (track) {
          console.log(`[WebRTC] replaceTrack ${kind} on PC[${peerId}]`);
          transceiver.sender.replaceTrack(track);
        }
      }
    }
  }, [localStream]);

  // ─── Upgrade broken/recvonly PCs when we become a speaker ───────────────
  useEffect(() => {
    if (!isSpeaker || !localStream) return;
    for (const [peerId, pc] of pcsRef.current.entries()) {
      const transceivers = pc.getTransceivers();
      if (transceivers.length === 0) continue;
      const allRecvonly = transceivers.every((t) => t.direction === "recvonly");
      const hasMixedTransceivers =
        transceivers.some((t) => t.direction === "recvonly") &&
        transceivers.some((t) => t.direction !== "recvonly");
      if (allRecvonly || hasMixedTransceivers) {
        console.log(`[WebRTC] renegotiating broken PC[${peerId}] (${allRecvonly ? "recvonly" : "mixed"})`);
        const newPc = createPC(peerId, false);
        newPc.createOffer().then(async (offer) => {
          await newPc.setLocalDescription(offer);
          send({ type: "webrtc_offer", target_peer_id: peerId, sdp: offer.sdp! });
        });
      }
    }
  }, [isSpeaker, localStream, createPC, send]);

  // ─── Device switching ─────────────────────────────────────────────────────
  const setMicDevice = useCallback(async (deviceId: string) => {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    const newTrack = newStream.getAudioTracks()[0];

    const old = localStreamRef.current;
    if (old) {
      old.getAudioTracks().forEach((t) => t.stop());
      const next = new MediaStream([newTrack, ...old.getVideoTracks()]);
      localStreamRef.current = next;
      setLocalStream(next);
    }

    for (const pc of pcsRef.current.values()) {
      const sender = pc.getTransceivers().find((t) => t.mid === "0")?.sender;
      if (sender) await sender.replaceTrack(newTrack);
    }
  }, []);

  const setCamDevice = useCallback(async (deviceId: string) => {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    });
    const newTrack = newStream.getVideoTracks()[0];

    const old = localStreamRef.current;
    if (old) {
      old.getVideoTracks().forEach((t) => t.stop());
      const next = new MediaStream([...old.getAudioTracks(), newTrack]);
      localStreamRef.current = next;
      setLocalStream(next);
      setCamEnabled(true);
    }

    for (const pc of pcsRef.current.values()) {
      const sender = pc.getTransceivers().find((t) => t.mid === "1")?.sender;
      if (sender) await sender.replaceTrack(newTrack);
    }
  }, []);

  // ─── Screen sharing ───────────────────────────────────────────────────────
  const startLocalScreenShare = useCallback(async (stream: MediaStream) => {
    const vt = stream.getVideoTracks()[0] ?? null;
    const at = stream.getAudioTracks()[0] ?? null;
    screenVideoTrackRef.current = vt;
    screenAudioTrackRef.current = at;
    for (const s of screenVideoSendersRef.current.values()) if (vt) await s.replaceTrack(vt);
    for (const s of screenAudioSendersRef.current.values()) if (at) await s.replaceTrack(at);
    setScreenSharingPeerIds((prev) => new Set([...prev, myPeerId]));
    setLocalScreenStream(stream);
  }, [myPeerId]);

  const stopLocalScreenShare = useCallback(async () => {
    screenVideoTrackRef.current = null;
    screenAudioTrackRef.current = null;
    for (const s of screenVideoSendersRef.current.values()) await s.replaceTrack(null);
    for (const s of screenAudioSendersRef.current.values()) await s.replaceTrack(null);
    setScreenSharingPeerIds((prev) => {
      const next = new Set(prev);
      next.delete(myPeerId);
      return next;
    });
    setLocalScreenStream(null);
  }, [myPeerId]);

  const dumpDebug = useCallback(async () => {
    console.group("[WebRTC Debug Dump]");
    console.log("myPeerId:", myPeerId);
    console.log("isSpeaker (ref/prop):", isSpeakerRef.current, "/", isSpeaker);
    console.log("isViewer  (ref/prop):", isViewerRef.current, "/", isViewer);
    console.log("localStream:", localStreamRef.current
      ? localStreamRef.current.getTracks().map(t => `${t.kind}:${t.label}:${t.readyState}`)
      : null);
    console.log("remoteStreams:", [...remoteStreams.entries()].map(([id, s]) =>
      `${id}: [${s.getTracks().map(t => `${t.kind}:${t.readyState}`).join(", ")}]`));
    console.log("remoteScreenStreams:", [...remoteScreenStreams.entries()].map(([id, s]) =>
      `${id}: [${s.getTracks().map(t => `${t.kind}:${t.readyState}`).join(", ")}]`));
    console.log("screenSharingPeerIds:", [...screenSharingPeerIds]);

    for (const [peerId, pc] of pcsRef.current.entries()) {
      console.group(`PC[${peerId}]`);
      console.log("signalingState:", pc.signalingState);
      console.log("iceConnectionState:", pc.iceConnectionState);
      console.log("connectionState:", pc.connectionState);
      for (const t of pc.getTransceivers()) {
        const kind = t.receiver.track.kind;
        console.log(
          `  transceiver mid=${t.mid}(${kind}): dir=${t.direction} currentDir=${t.currentDirection}` +
          ` senderTrack=${t.sender.track?.label ?? "null"} senderEnabled=${t.sender.track?.enabled ?? "—"}` +
          ` receiverTrack=${t.receiver.track?.readyState ?? "—"}`
        );
      }
      try {
        const stats = await pc.getStats();
        const relevant: Record<string, unknown> = {};
        stats.forEach((r) => {
          if (["inbound-rtp", "outbound-rtp", "candidate-pair", "transport"].includes(r.type)) {
            relevant[`${r.type}:${(r as any).id ?? ""}`] = r;
          }
        });
        console.log("  stats:", relevant);
      } catch {
        console.log("  stats: unavailable");
      }
      console.groupEnd();
    }
    console.groupEnd();
  }, [myPeerId, isSpeaker, isViewer, remoteStreams, remoteScreenStreams, screenSharingPeerIds]);

  useEffect(() => {
    return () => {
      pcsRef.current.forEach((pc) => pc.close());
      stopLocalMedia();
    };
  }, [stopLocalMedia]);

  return (
    <Ctx.Provider value={{
      localStream, remoteStreams, remoteScreenStreams, micEnabled, camEnabled, pings,
      screenSharingPeerIds, localScreenStream, hwCodecs,
      toggleMic, toggleCam, startLocalMedia, stopLocalMedia,
      setMicDevice, setCamDevice,
      startLocalScreenShare, stopLocalScreenShare, dumpDebug,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWebRTC() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWebRTC must be used within WebRTCProvider");
  return ctx;
}
