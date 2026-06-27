import { WS_URL, BACKEND_JWT_KEY } from "./constants";
import type { ClientMessage, ServerMessage } from "@/types/signaling";

type MessageHandler = (msg: ServerMessage) => void;
type CloseHandler = (code: number, reason: string) => void;

// WebSocket close codes (application-defined, RFC 6455 §7.4.2)
export const WS_CLOSE_FORBIDDEN = 4003;
export const WS_CLOSE_NOT_FOUND = 4004;

class RoomSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private closeHandlers: Set<CloseHandler> = new Set();
  private openHandlers: Set<() => void> = new Set();
  private queue: ClientMessage[] = [];
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private closed = false;

  constructor(
    private roomId: string,
    private password?: string,
  ) {}

  connect(): void {
    const token = typeof window !== "undefined" ? localStorage.getItem(BACKEND_JWT_KEY) : null;
    if (!token) {
      console.warn(`[WS] connect room=${this.roomId} — no JWT token, aborting`);
      return;
    }

    // Password is passed as a query param — only option available before WS handshake in browsers
    const passwordParam = this.password ? `&password=${encodeURIComponent(this.password)}` : "";
    const attempt = this.reconnectAttempts > 0 ? ` (reconnect #${this.reconnectAttempts})` : "";
    console.log(`[WS] connecting room=${this.roomId}${attempt}`);
    this.ws = new WebSocket(`${WS_URL}/room/${this.roomId}?token=${token}${passwordParam}`);

    this.ws.onopen = () => {
      if (this.closed) {
        this.ws?.close();
        return;
      }
      console.log(`[WS] connected room=${this.roomId}, flushing ${this.queue.length} queued message(s)`);
      this.reconnectAttempts = 0;
      this.queue.forEach((msg) => this.ws!.send(JSON.stringify(msg)));
      this.queue = [];
      this.openHandlers.forEach((h) => h());
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        console.debug(`[WS] ← ${msg.type}`, msg);
        this.handlers.forEach((h) => h(msg));
      } catch {
        console.warn("[WS] malformed message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] closed room=${this.roomId} code=${event.code} reason="${event.reason}" wasClean=${event.wasClean}`);
      // Notify close handlers (e.g. for password/forbidden handling)
      this.closeHandlers.forEach((h) => h(event.code, event.reason));

      if (this.closed) return;
      // Don't auto-reconnect on application-level errors
      if (event.code === WS_CLOSE_FORBIDDEN || event.code === WS_CLOSE_NOT_FOUND) return;

      if (this.reconnectAttempts < this.maxReconnects) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
        console.log(`[WS] scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnects})`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.error(`[WS] max reconnects (${this.maxReconnects}) reached for room=${this.roomId}`);
      }
    };

    this.ws.onerror = (event) => {
      console.error(`[WS] error room=${this.roomId}`, event);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.debug(`[WS] → ${msg.type}`, msg);
      this.ws.send(JSON.stringify(msg));
    } else {
      console.debug(`[WS] → ${msg.type} (queued, readyState=${this.ws?.readyState ?? "no socket"})`, msg);
      this.queue.push(msg);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onOpen(handler: () => void): () => void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      handler();
      return () => {};
    }
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  close(): void {
    this.closed = true;
    // Don't close a CONNECTING socket — onopen will see closed=true and abort cleanly.
    // Calling close() on readyState=0 causes a browser error and an abnormal server disconnect.
    if (this.ws?.readyState !== WebSocket.CONNECTING) {
      this.ws?.close();
    }
  }
}

const sockets = new Map<string, RoomSocket>();

export function getRoomSocket(roomId: string, password?: string): RoomSocket {
  if (!sockets.has(roomId)) {
    const s = new RoomSocket(roomId, password);
    s.connect();
    sockets.set(roomId, s);
  }
  return sockets.get(roomId)!;
}

export function closeRoomSocket(roomId: string): void {
  sockets.get(roomId)?.close();
  sockets.delete(roomId);
}
