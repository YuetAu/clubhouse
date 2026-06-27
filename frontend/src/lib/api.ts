import { API_URL, BACKEND_JWT_KEY } from "./constants";
import type { Room } from "@/types/room";
import type { ChatMessage } from "@/types/chat";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BACKEND_JWT_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(BACKEND_JWT_KEY, token);
    window.dispatchEvent(new CustomEvent("tokenChanged", { detail: { token } }));
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(BACKEND_JWT_KEY);
    window.dispatchEvent(new CustomEvent("tokenChanged", { detail: { token: null } }));
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = body.detail;
    const message = typeof detail === "string" ? detail : (detail?.message ?? "Request failed");
    throw new ApiError(message, res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function loginOAuth(provider: string, providerAccessToken: string) {
  const data = await apiFetch<{ access_token: string; user: object }>(
    `/auth/callback/${provider}`,
    { method: "POST", body: JSON.stringify({ provider_access_token: providerAccessToken }) }
  );
  setToken(data.access_token);
  return data;
}

export async function loginAnon(anonToken: string, displayName: string) {
  const data = await apiFetch<{ access_token: string; user: object }>(
    "/auth/anon",
    { method: "POST", body: JSON.stringify({ anon_token: anonToken, display_name: displayName }) }
  );
  setToken(data.access_token);
  return data;
}

export async function refreshToken() {
  const data = await apiFetch<{ access_token: string; user: object }>("/auth/refresh", { method: "POST" });
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  return apiFetch<{ id: string; display_name: string; is_verified: boolean; is_anon: boolean }>("/auth/me");
}

// ─── Rooms ────────────────────────────────────────────────────────────────────
export async function getRooms(params: { q?: string; tags?: string[]; page?: number } = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  params.tags?.forEach((t) => query.append("tags", t));
  if (params.page) query.set("page", String(params.page));
  return apiFetch<Room[]>(`/rooms?${query}`);
}

export async function getRoom(id: string) {
  return apiFetch<Room>(`/rooms/${id}`);
}

export async function createRoom(body: {
  slug: string;
  title: string;
  description?: string;
  topic_tags?: string[];
  room_type?: "stage" | "chitchat";
  is_private?: boolean;
  password?: string;
  scheduled_at?: string;
  max_speakers?: number;
}) {
  return apiFetch<Room>("/rooms", { method: "POST", body: JSON.stringify(body) });
}

export async function createInstantRoom() {
  return apiFetch<Room>("/rooms/instant", { method: "POST" });
}

export async function updateRoom(
  id: string,
  body: {
    title?: string;
    description?: string;
    topic_tags?: string[];
    room_type?: "stage" | "chitchat";
    is_private?: boolean;
    is_temporary?: boolean;
    password?: string | null;
    scheduled_at?: string | null;
  }
) {
  return apiFetch<Room>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function closeRoom(id: string) {
  return apiFetch<void>(`/rooms/${id}`, { method: "DELETE" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export async function getMessages(roomId: string, params: { before?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.before) query.set("before", params.before);
  if (params.limit) query.set("limit", String(params.limit));
  return apiFetch<ChatMessage[]>(`/rooms/${roomId}/messages?${query}`);
}

// ─── Moderation ───────────────────────────────────────────────────────────────
export async function deleteMessage(roomId: string, messageId: string) {
  return apiFetch<void>(`/rooms/${roomId}/messages/${messageId}`, { method: "DELETE" });
}

export async function muteParticipant(roomId: string, userId: string) {
  return apiFetch<void>(`/rooms/${roomId}/participants/${userId}/mute`, { method: "POST" });
}

export async function unmuteParticipant(roomId: string, userId: string) {
  return apiFetch<void>(`/rooms/${roomId}/participants/${userId}/mute`, { method: "DELETE" });
}

export async function kickParticipant(roomId: string, userId: string) {
  return apiFetch<void>(`/rooms/${roomId}/participants/${userId}/kick`, { method: "POST" });
}

export async function banParticipant(roomId: string, userId: string) {
  return apiFetch<void>(`/rooms/${roomId}/participants/${userId}/ban`, { method: "POST" });
}
