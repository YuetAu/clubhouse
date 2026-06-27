"use client";

import { useCallback, useState } from "react";

export type ScreenResolution = "720p" | "1080p" | "1440p" | "4k";
export type ScreenFps = 15 | 30;
export type ScreenCodec = "auto" | "av1" | "vp9" | "h264" | "vp8";

export interface AppSettings {
  micDeviceId: string | null;
  camDeviceId: string | null;
  screenResolution: ScreenResolution;
  screenFps: ScreenFps;
  screenCodec: ScreenCodec;
}

const DEFAULTS: AppSettings = {
  micDeviceId: null,
  camDeviceId: null,
  screenResolution: "1080p",
  screenFps: 30,
  screenCodec: "auto",
};

const STORAGE_KEY = "clubhouse:settings";

function load(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function persist(s: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  return { settings, update };
}

export function readSettings(): AppSettings {
  return load();
}

export const RESOLUTION_MAP: Record<ScreenResolution, { width: number; height: number }> = {
  "720p":  { width: 1280,  height: 720  },
  "1080p": { width: 1920,  height: 1080 },
  "1440p": { width: 2560,  height: 1440 },
  "4k":    { width: 3840,  height: 2160 },
};

export const RESOLUTION_LABELS: Record<ScreenResolution, string> = {
  "720p":  "720p (1280×720)",
  "1080p": "1080p (1920×1080)",
  "1440p": "1440p (2560×1440)",
  "4k":    "4K (3840×2160)",
};

export const FPS_LABELS: Record<ScreenFps, string> = {
  15: "15 FPS — low bandwidth",
  30: "30 FPS — standard",
};

export interface CodecMeta {
  label: string;
  note: string;
}

export const CODEC_META: Record<ScreenCodec, CodecMeta> = {
  auto:  { label: "Auto",   note: "Selects best codec based on hardware availability: AV1 → VP9 → H.264." },
  av1:   { label: "AV1",    note: "Best compression. Highest CPU for software encoding; very light with hardware." },
  vp9:   { label: "VP9",    note: "Good compression. Moderate CPU. Widely supported." },
  h264:  { label: "H.264",  note: "Broadest compatibility. Usually hardware-accelerated. Lower compression than VP9/AV1." },
  vp8:   { label: "VP8",    note: "Legacy fallback. Lowest compression. Only use if other codecs cause issues." },
};
