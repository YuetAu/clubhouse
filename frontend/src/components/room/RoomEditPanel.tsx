"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { updateRoom } from "@/lib/api";
import type { Room } from "@/types/room";

interface Props {
  open: boolean;
  onClose: () => void;
  room: Room;
}

export function RoomEditPanel({ open, onClose, room }: Props) {
  const queryClient = useQueryClient();
  const t = useTranslations("RoomEdit");
  const [form, setForm] = useState({
    title: room.title,
    description: room.description ?? "",
    topic_tags: room.topic_tags?.join(", ") ?? "",
    room_type: room.room_type as "stage" | "chitchat",
    is_private: room.is_private,
    password: "",
    clearPassword: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateRoom(room.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        topic_tags: form.topic_tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        room_type: form.room_type,
        // Send password when set; null to clear; omit to keep existing
        ...(form.password ? { password: form.password } : form.clearPassword ? { password: null } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["room", room.id] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-4">
        {/* Room type selector */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            {(["stage", "chitchat"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set("room_type", type)}
                className="text-left rounded-xl p-3 border transition-all"
                style={{
                  background: form.room_type === type ? "rgba(0,200,83,0.08)" : "var(--night-raised)",
                  borderColor: form.room_type === type ? "rgba(0,200,83,0.5)" : "var(--night-border)",
                  color: form.room_type === type ? "var(--night-speaking)" : "var(--night-text)",
                }}
              >
                <div className="font-medium text-sm">
                  {type === "stage" ? t("typeStage") : t("typeChitchat")}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Input
          label={t("roomTitle")}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={t("roomTitlePlaceholder")}
        />
        <Input
          label={t("description")}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={t("descriptionPlaceholder")}
        />
        <Input
          label={t("tags")}
          value={form.topic_tags}
          onChange={(e) => set("topic_tags", e.target.value)}
          placeholder={t("tagsPlaceholder")}
        />

        {/* Password — available for all room types */}
        <Input
          label={t("password")}
          type="password"
          value={form.password}
          onChange={(e) => {
            set("password", e.target.value);
            if (e.target.value) set("clearPassword", false);
          }}
          placeholder={room.has_password ? t("passwordKeepExisting") : t("passwordPlaceholder")}
        />
        {room.has_password && !form.password && (
          <div className="flex items-center gap-2 -mt-2">
            <input
              type="checkbox"
              id="edit-clear-pw"
              checked={form.clearPassword}
              onChange={(e) => set("clearPassword", e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-red-500"
            />
            <label htmlFor="edit-clear-pw" className="text-xs" style={{ color: "var(--night-muted)" }}>
              {t("passwordClear")}
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
