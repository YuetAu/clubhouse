"use client";

import { useCallback, useRef, useState } from "react";
import { useSignaling } from "@/contexts/SignalingContext";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { readSettings, RESOLUTION_MAP } from "@/hooks/useSettings";

export function useScreenShare() {
  const { send } = useSignaling();
  const { startLocalScreenShare, stopLocalScreenShare } = useWebRTC();
  const [isSharing, setIsSharing] = useState(false);
  const displayTrackRef = useRef<MediaStreamTrack | null>(null);

  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert("Screen sharing is not supported on this device. It's available on desktop browsers (Windows, macOS, Linux).");
      return;
    }

    try {
      const { screenResolution, screenFps } = readSettings();
      const { width, height } = RESOLUTION_MAP[screenResolution];

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width:     { ideal: width },
          height:    { ideal: height },
          frameRate: { ideal: screenFps, max: screenFps },
        },
        audio: true,
      });

      const displayTrack = displayStream.getVideoTracks()[0];
      displayTrackRef.current = displayTrack;

      await startLocalScreenShare(displayStream);
      setIsSharing(true);
      send({ type: "screen_share_start" });

      displayTrack.onended = async () => {
        await stopScreenShare();
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        alert("Screen sharing permission denied. Please allow screen sharing in your browser settings.");
      } else if (error instanceof DOMException && error.name === "NotSupportedError") {
        alert("Screen sharing is not supported on this device.");
      } else {
        console.error("Screen share error:", error);
        alert("Failed to start screen sharing. Please try again.");
      }
    }
  }, [send, startLocalScreenShare]);

  const stopScreenShare = useCallback(async () => {
    displayTrackRef.current?.stop();
    displayTrackRef.current = null;

    await stopLocalScreenShare();
    setIsSharing(false);
    send({ type: "screen_share_stop" });
  }, [send, stopLocalScreenShare]);

  return { isSharing, startScreenShare, stopScreenShare };
}
