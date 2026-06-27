"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { useRoom } from "@/contexts/RoomContext";
import { useTranslations } from "next-intl";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface Props {
  roomId: string;
  myPeerId: string;
}

export function ChatPanel({ roomId, myPeerId }: Props) {
  const { messages, sendMessage } = useChat(roomId);
  const { isHost, isSpeaker } = useRoom();
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Chat");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--night-bg)" }}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--night-muted)" }}>
            {t("empty")}
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            roomId={roomId}
            isHost={isHost}
            isSpeaker={isSpeaker}
            myPeerId={myPeerId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-4 pb-20 pt-2">
        <ChatInput onSend={sendMessage} />
      </div>
    </div>
  );
}
