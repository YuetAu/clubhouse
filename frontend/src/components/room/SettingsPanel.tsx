"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useWebRTC } from "@/contexts/WebRTCContext";
import {
  useSettings,
  RESOLUTION_LABELS,
  FPS_LABELS,
  CODEC_META,
  type ScreenResolution,
  type ScreenFps,
  type ScreenCodec,
} from "@/hooks/useSettings";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

const CODEC_ORDER: ScreenCodec[] = ["auto", "av1", "vp9", "h264", "vp8"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--night-muted)" }}>
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm" style={{ color: "var(--night-text)" }}>{label}</label>
      {children}
    </div>
  );
}

const selectCls =
  "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors " +
  "bg-[var(--night-card)] border border-[var(--night-border)] text-[var(--night-text)] " +
  "focus:border-[#00C853] focus:ring-1 focus:ring-[#00C853]";

// Infer which codec "Auto" will pick given hardware availability
function autoLabel(hwCodecs: Set<string>): string {
  if (hwCodecs.has("av1"))  return "Auto (AV1 ⚡ HW)";
  if (hwCodecs.has("vp9"))  return "Auto (VP9 ⚡ HW)";
  if (hwCodecs.has("h264")) return "Auto (H.264 ⚡ HW)";
  return "Auto (AV1 SW)";
}

function codecOptionLabel(codec: ScreenCodec, hwCodecs: Set<string>): string {
  if (codec === "auto") return autoLabel(hwCodecs);
  const hw = codec !== "vp8" && hwCodecs.has(codec) ? " ⚡ HW" : "";
  return `${CODEC_META[codec].label}${hw}`;
}

export function SettingsPanel({ open, onClose }: Props) {
  const { settings, update } = useSettings();
  const { setMicDevice, setCamDevice, hwCodecs } = useWebRTC();
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cams, setCams] = useState<DeviceOption[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [micLoading, setMicLoading] = useState(false);
  const [camLoading, setCamLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDeviceError(null);

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMics(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      );
      setCams(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
      );
    }).catch(() => {
      setDeviceError("Could not enumerate devices. Grant mic/camera permission first.");
    });
  }, [open]);

  const handleMicChange = async (deviceId: string) => {
    update({ micDeviceId: deviceId });
    setMicLoading(true);
    try { await setMicDevice(deviceId); } catch {}
    setMicLoading(false);
  };

  const handleCamChange = async (deviceId: string) => {
    update({ camDeviceId: deviceId });
    setCamLoading(true);
    try { await setCamDevice(deviceId); } catch {}
    setCamLoading(false);
  };

  const highRes = settings.screenResolution === "1440p" || settings.screenResolution === "4k";

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">

        {/* ── Audio ──────────────────────────────────────────────────────── */}
        <Section title="Audio">
          <SettingRow label="Microphone">
            {deviceError ? (
              <p className="text-xs mt-1" style={{ color: "#f87171" }}>{deviceError}</p>
            ) : (
              <select
                className={selectCls}
                value={settings.micDeviceId ?? ""}
                onChange={(e) => handleMicChange(e.target.value)}
                disabled={micLoading}
              >
                <option value="">System default</option>
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            )}
            {micLoading && (
              <p className="text-xs mt-1" style={{ color: "var(--night-muted)" }}>Switching microphone…</p>
            )}
          </SettingRow>
        </Section>

        {/* ── Camera ─────────────────────────────────────────────────────── */}
        <Section title="Camera">
          <SettingRow label="Camera">
            {!deviceError && (
              <select
                className={selectCls}
                value={settings.camDeviceId ?? ""}
                onChange={(e) => handleCamChange(e.target.value)}
                disabled={camLoading}
              >
                <option value="">System default</option>
                {cams.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            )}
            {camLoading && (
              <p className="text-xs mt-1" style={{ color: "var(--night-muted)" }}>Switching camera…</p>
            )}
          </SettingRow>
        </Section>

        {/* ── Screen Share ────────────────────────────────────────────────── */}
        <Section title="Screen Share">
          <SettingRow label="Resolution">
            <select
              className={selectCls}
              value={settings.screenResolution}
              onChange={(e) => update({ screenResolution: e.target.value as ScreenResolution })}
            >
              {(["720p", "1080p", "1440p", "4k"] as ScreenResolution[]).map((r) => (
                <option key={r} value={r}>{RESOLUTION_LABELS[r]}</option>
              ))}
            </select>
            {highRes && (
              <p className="text-xs mt-1" style={{ color: "#fbbf24" }}>
                1440p / 4K works best with AV1 or VP9.
              </p>
            )}
          </SettingRow>

          <SettingRow label="Frame rate">
            <select
              className={selectCls}
              value={settings.screenFps}
              onChange={(e) => update({ screenFps: Number(e.target.value) as ScreenFps })}
            >
              {([15, 30] as ScreenFps[]).map((fps) => (
                <option key={fps} value={fps}>{FPS_LABELS[fps]}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label="Video codec">
            <select
              className={selectCls}
              value={settings.screenCodec}
              onChange={(e) => update({ screenCodec: e.target.value as ScreenCodec })}
            >
              {CODEC_ORDER.map((c) => (
                <option key={c} value={c}>{codecOptionLabel(c, hwCodecs)}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--night-muted)" }}>
              {CODEC_META[settings.screenCodec].note}
            </p>
          </SettingRow>

          <p className="text-xs" style={{ color: "var(--night-muted)" }}>
            ⚡ = hardware-accelerated on this device. Changes apply to new peer connections and screen shares.
          </p>
        </Section>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "var(--night-border)", color: "var(--night-text)" }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
