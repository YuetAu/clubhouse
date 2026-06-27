"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSignaling } from "@/contexts/SignalingContext";
import { getMessages } from "@/lib/api";
import type { ChatMessage } from "@/types/chat";
import type { ChatDeletedMsg, ChatMessageMsg } from "@/types/signaling";

export function useChat(roomId: string) {
  const { send, on } = useSignaling();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const loadedRef = useRef(false);

  // Load history on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    getMessages(roomId).then(setMessages).catch(() => {});
  }, [roomId]);

  // Subscribe to live messages
  useEffect(() => {
    const unsubs = [
      on("chat_message", (m) => {
        const msg = m as ChatMessageMsg;
        setMessages((prev) => [
          ...prev,
          {
            id: msg.message_id,
            room_id: roomId,
            author_id: msg.author_id,
            display_name: msg.display_name,
            avatar_url: msg.avatar_url,
            is_verified: msg.is_verified,
            is_anon: msg.is_anon,
            content: msg.content,
            is_deleted: false,
            created_at: msg.created_at,
          },
        ]);
      }),
      on("chat_deleted", (m) => {
        const { message_id } = m as ChatDeletedMsg;
        setMessages((prev) =>
          prev.map((msg) => msg.id === message_id ? { ...msg, is_deleted: true, content: "[deleted]" } : msg)
        );
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, roomId]);

  const sendMessage = useCallback((content: string) => {
    send({ type: "chat_send", content });
  }, [send]);

  return { messages, sendMessage };
}
