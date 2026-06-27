"use client";

import { Avatar } from "@/components/ui/Avatar";
import { ModerationMenu } from "./ModerationMenu";
import type { ChatMessage as ChatMsg } from "@/types/chat";
import { clsx } from "clsx";

interface Props {
  message: ChatMsg;
  roomId: string;
  isHost: boolean;
  isSpeaker: boolean;
  myPeerId: string;
}

export function ChatMessage({ message, roomId, isHost, isSpeaker, myPeerId }: Props) {
  const isOwn = message.author_id === myPeerId;

  return (
    <div className={clsx("flex gap-2 group", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar src={message.avatar_url} name={message.display_name} size={28} className="shrink-0 mt-0.5" />
      )}
      <div className={clsx("flex flex-col gap-0.5 min-w-0 max-w-[75%]", isOwn && "items-end")}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium truncate" style={{ color: "var(--night-warm)" }}>
              {message.display_name}
            </span>
            {!isOwn && (
              <ModerationMenu roomId={roomId} messageId={message.id} authorId={message.author_id} isHost={isHost} isSpeaker={isSpeaker} />
            )}
          </div>
        )}
        <p
          className={clsx(
            "text-sm px-3 py-2 break-words leading-relaxed",
            isOwn
              ? "rounded-2xl rounded-tr-sm"
              : "rounded-2xl rounded-tl-sm",
            message.is_deleted
              ? "italic"
              : ""
          )}
          style={{
            background: message.is_deleted
              ? "rgba(138,136,152,0.1)"
              : isOwn
              ? "var(--night-chat-self)"
              : "var(--night-chat-other)",
            color: message.is_deleted
              ? "var(--night-muted)"
              : "var(--night-text)",
          }}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}
