"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SignalingProvider } from "@/contexts/SignalingContext";
import { RoomProvider, useRoom } from "@/contexts/RoomContext";
import { WebRTCProvider } from "@/contexts/WebRTCContext";
import { useIdentity } from "@/hooks/useIdentity";
import { LoginModal } from "@/components/auth/LoginModal";
import { AnonNicknameModal } from "@/components/auth/AnonNicknameModal";
import { PasswordPromptModal } from "@/components/room/PasswordPromptModal";
import { ConnectionLog } from "@/components/room/ConnectionLog";
import { getRoom, ApiError } from "@/lib/api";
import { useTranslations } from "next-intl";

function WebRTCLayer({ myPeerId, children }: { myPeerId: string; children: React.ReactNode }) {
  const { isSpeaker, isViewer } = useRoom();
  return (
    <WebRTCProvider myPeerId={myPeerId} isSpeaker={isSpeaker} isViewer={isViewer}>
      <ConnectionLog />
      {children}
    </WebRTCProvider>
  );
}

function RoomShell({
  roomId,
  myPeerId,
  password,
  children,
}: {
  roomId: string;
  myPeerId: string;
  password?: string;
  children: React.ReactNode;
}) {
  return (
    <SignalingProvider roomId={roomId} password={password}>
      <RoomProvider myPeerId={myPeerId}>
        <WebRTCLayer myPeerId={myPeerId}>
          {children}
        </WebRTCLayer>
      </RoomProvider>
    </SignalingProvider>
  );
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const roomId = params.roomId as string;
  const identity = useIdentity();

  const t = useTranslations("RoomLayout");
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [showAnon, setShowAnon] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const { data: room, error: roomError } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => getRoom(roomId),
    enabled: identity.type === "oauth" || identity.type === "anon",
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 3;
    },
  });

  useEffect(() => {
    if (roomError instanceof ApiError && roomError.status === 404) {
      router.replace("/");
      return;
    }
  }, [roomError, router]);

  useEffect(() => {
    if (identity.type === "loading") return; // wait for auth to resolve
    if (identity.type === "none") {
      setShowLogin(true);
      return;
    }

    if (!room) return; // still loading

    if (room.has_password && password === undefined) {
      setShowPasswordPrompt(true);
    } else {
      setReady(true);
    }
  }, [identity.type, room, password]);

  const handlePasswordSubmit = (pw: string) => {
    setPasswordError(undefined);
    setPassword(pw);
    setShowPasswordPrompt(false);
    setReady(true);
  };

  // Auth still resolving
  if (identity.type === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--night-bg)" }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--night-border)", borderTopColor: "var(--night-muted)" }}
        />
      </div>
    );
  }

  // Not authenticated — prompt sign-in
  if (identity.type === "none") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--night-bg)" }}>
        <div className="text-center" style={{ color: "var(--night-muted)" }}>
          <p className="text-4xl mb-3">🎙️</p>
          <p>{t("signInToJoin")}</p>
        </div>
        <LoginModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          onAnonClick={() => { setShowLogin(false); setShowAnon(true); }}
        />
        <AnonNicknameModal
          open={showAnon}
          onClose={() => setShowAnon(false)}
          onSuccess={() => { setShowAnon(false); }}
        />
      </div>
    );
  }

  // Authenticated but room not ready yet (loading room data or awaiting password)
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--night-bg)" }}>
        {!showPasswordPrompt && (
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--night-border)", borderTopColor: "var(--night-muted)" }}
          />
        )}
        <PasswordPromptModal
          open={showPasswordPrompt}
          onClose={() => setShowPasswordPrompt(false)}
          onSubmit={handlePasswordSubmit}
          error={passwordError}
        />
      </div>
    );
  }

  const peerId = identity.type === "oauth" || identity.type === "anon" ? identity.peerId : "";

  return (
    <RoomShell roomId={roomId} myPeerId={peerId} password={password}>
      {children}
    </RoomShell>
  );
}
