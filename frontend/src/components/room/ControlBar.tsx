"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useRoom } from "@/contexts/RoomContext";
import { useSignaling } from "@/contexts/SignalingContext";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { useScreenShare } from "@/hooks/useScreenShare";
import { closeRoomSocket } from "@/lib/ws";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  roomId: string;
  myPeerId: string;
  isChitchat?: boolean;
}

function PillBtn({
  onClick,
  active,
  disabled,
  label,
  icon,
  danger,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  icon: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        "flex items-center justify-center w-10 h-10 rounded-full text-lg transition-all",
        danger
          ? "text-red-400 hover:text-red-300"
          : active
          ? "text-[#00C853]"
          : "text-[var(--night-muted)] hover:text-[var(--night-text)]",
        disabled && "opacity-30 cursor-not-allowed"
      )}
      style={{
        background: danger
          ? "transparent"
          : active
          ? "rgba(0,200,83,0.12)"
          : "transparent",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const shadow = danger
          ? "0 0 0 1.5px rgba(239,68,68,0.5), 0 0 10px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.08)"
          : active
          ? "0 0 0 1.5px rgba(0,200,83,0.5), 0 0 10px rgba(0,200,83,0.2), 0 0 20px rgba(0,200,83,0.08)"
          : "0 0 0 1.5px rgba(255,255,255,0.2), 0 0 10px rgba(255,255,255,0.08), 0 0 20px rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = shadow;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      {icon}
    </button>
  );
}

export function ControlBar({ roomId, myPeerId, isChitchat }: Props) {
  const router = useRouter();
  const { myRole, isHost, isSpeaker, isViewer, handsRaised } = useRoom();
  const myHandRaised = handsRaised.has(myPeerId);
  const { send } = useSignaling();
  const { micEnabled, toggleMic, camEnabled, toggleCam } = useWebRTC();
  const { isSharing, startScreenShare, stopScreenShare } = useScreenShare();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const t = useTranslations("ControlBar");

  const isScreenShareSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  const handleLeave = async () => {
    if (isSharing) await stopScreenShare();
    if (micEnabled) toggleMic();
    send({ type: "leave" });
    closeRoomSocket(roomId);
    router.push("/");
  };

  return (
    <>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div
          className="flex items-center gap-1 px-4 py-2 rounded-full shadow-2xl"
          style={{
            background: "var(--night-raised)",
            border: "1px solid var(--night-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {isChitchat ? (
            /* Chitchat: everyone is a speaker — just mic/cam/screen share */
            isSpeaker && (
              <>
                <PillBtn
                  onClick={toggleMic}
                  active={micEnabled}
                  icon={micEnabled ? "🎤" : "🔇"}
                  label={micEnabled ? t("mute") : t("unmute")}
                />
                <PillBtn
                  onClick={toggleCam}
                  active={camEnabled}
                  icon={camEnabled ? "📹" : "📵"}
                  label={camEnabled ? t("camOff") : t("camOn")}
                />
                <PillBtn
                  onClick={isSharing ? stopScreenShare : startScreenShare}
                  active={isSharing}
                  disabled={!isScreenShareSupported}
                  icon="🖥️"
                  label={
                    isScreenShareSupported
                      ? isSharing
                        ? t("stopShare")
                        : t("shareScreen")
                      : t("notSupported")
                  }
                />
              </>
            )
          ) : (
            /* Stage mode: full role-based controls */
            <>
              {isSpeaker && (
                <>
                  <PillBtn
                    onClick={toggleMic}
                    active={micEnabled}
                    icon={micEnabled ? "🎤" : "🔇"}
                    label={micEnabled ? t("mute") : t("unmute")}
                  />
                  <PillBtn
                    onClick={toggleCam}
                    active={camEnabled}
                    icon={camEnabled ? "📹" : "📵"}
                    label={camEnabled ? t("camOff") : t("camOn")}
                  />
                  <PillBtn
                    onClick={isSharing ? stopScreenShare : startScreenShare}
                    active={isSharing}
                    disabled={!isScreenShareSupported}
                    icon="🖥️"
                    label={
                      isScreenShareSupported
                        ? isSharing
                          ? t("stopShare")
                          : t("shareScreen")
                        : t("notSupported")
                    }
                  />
                  <PillBtn
                    onClick={() => send({ type: "leave_stage" })}
                    icon="⬇️"
                    label={t("leaveStage")}
                  />
                </>
              )}

              {isHost && !isSpeaker && (
                <PillBtn
                  onClick={() => send({ type: "join_stage" })}
                  icon="🎙️"
                  label={t("goOnStage")}
                />
              )}

              {isViewer && (
                <>
                  <PillBtn
                    onClick={() => send({ type: "become_listener" })}
                    icon="🎧"
                    label={t("listenIn")}
                  />
                  {!isHost && (
                    <PillBtn
                      onClick={() => send({ type: myHandRaised ? "lower_hand" : "raise_hand" })}
                      active={myHandRaised}
                      icon="✋"
                      label={myHandRaised ? t("handDown") : t("requestStage")}
                    />
                  )}
                </>
              )}

              {myRole === "listener" && !isHost && (
                <PillBtn
                  onClick={() => send({ type: myHandRaised ? "lower_hand" : "raise_hand" })}
                  active={myHandRaised}
                  icon="✋"
                  label={myHandRaised ? t("handDown") : t("raiseHand")}
                />
              )}
            </>
          )}

          <div className="w-px h-6 mx-1" style={{ background: "var(--night-border)" }} />
          <PillBtn onClick={() => setSettingsOpen(true)} icon="⚙️" label="Settings" />
          <PillBtn onClick={handleLeave} icon="🚪" label={t("leave")} danger />
        </div>
      </div>
    </>
  );
}
