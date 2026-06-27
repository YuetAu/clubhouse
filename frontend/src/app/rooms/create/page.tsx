"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createRoom, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useIdentity } from "@/hooks/useIdentity";
import { LoginModal } from "@/components/auth/LoginModal";

export default function CreateRoomPage() {
  const router = useRouter();
  const t = useTranslations("CreateRoom");
  const tNav = useTranslations("Nav");
  const identity = useIdentity();
  const [showLogin, setShowLogin] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    topic_tags: "",
    room_type: "chitchat" as "stage" | "chitchat",
    is_private: false,
    password: "",
    schedule_enabled: false,
    scheduled_at: "",
    max_speakers: 10,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [existingRoomId, setExistingRoomId] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const autoSlug = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);

  const handleSubmit = async () => {
    if (identity.type !== "oauth" && identity.type !== "loading") {
      setShowLogin(true);
      return;
    }
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = t("required");
    if (!form.slug.trim()) errs.slug = t("required");
    if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = t("slugError");
    if (form.schedule_enabled && !form.scheduled_at) errs.scheduled_at = t("dateRequired");
    if (form.schedule_enabled && form.scheduled_at && new Date(form.scheduled_at) <= new Date()) {
      errs.scheduled_at = t("dateFuture");
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setExistingRoomId(null);
    try {
      const room = await createRoom({
        slug: form.slug,
        title: form.title,
        description: form.description || undefined,
        topic_tags: form.topic_tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        room_type: form.room_type,
        is_private: form.is_private,
        password: form.password.trim() || undefined,
        scheduled_at:
          form.schedule_enabled && form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : undefined,
        max_speakers: form.max_speakers,
      });
      router.push(`/rooms/${room.id}`);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409) {
        const data = e.data as { room_id?: string; message?: string } | undefined;
        if (data?.room_id) {
          setExistingRoomId(data.room_id);
          setErrors({ form: data.message ?? t("alreadyHaveRoom") });
        } else {
          setErrors({ form: (e as Error).message });
        }
      } else {
        setErrors({ form: (e as Error).message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--night-bg)] text-[var(--night-text)]">
      <header className="border-b border-[var(--night-border)] px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-[var(--night-text)] tracking-tight">
          {tNav("brand")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="text-sm text-[var(--night-muted)] hover:text-[var(--night-text)] transition-colors">
            {t("back")}
          </Link>
        </div>
      </header>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} hideAnon />

      {identity.type === "loading" ? null : identity.type !== "oauth" ? (
        <main className="max-w-lg mx-auto px-4 py-10 text-center">
          <p className="text-[var(--night-muted)] mb-4">{t("signInToCreate")}</p>
          <Button onClick={() => setShowLogin(true)}>{t("signIn")}</Button>
        </main>
      ) : (
      <main className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold mb-6 text-[var(--night-text)]">{t("pageTitle")}</h1>

        <div className="space-y-4 bg-[var(--night-card)] rounded-2xl p-6 border border-[var(--night-border)] shadow-sm">
          {/* Room type selector */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "var(--night-muted)" }}>{t("roomType")}</p>
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
                  <div className="text-xs mt-0.5" style={{ color: "var(--night-muted)" }}>
                    {type === "stage" ? t("typeStageDesc") : t("typeChitchatDesc")}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Input
            label={t("roomTitle")}
            value={form.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (!form.slug) set("slug", autoSlug(e.target.value));
            }}
            placeholder={t("roomTitlePlaceholder")}
            error={errors.title}
          />
          <Input
            label={t("slug")}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder={t("slugPlaceholder")}
            error={errors.slug}
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

          {/* Schedule toggle */}
          <div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="schedule"
                checked={form.schedule_enabled}
                onChange={(e) => set("schedule_enabled", e.target.checked)}
                className="w-4 h-4 rounded accent-[#00C853]"
              />
              <label htmlFor="schedule" className="text-sm text-[var(--night-muted)] font-medium">
                {t("scheduleForLater")}
              </label>
            </div>
            {form.schedule_enabled && (
              <div className="mt-3">
                <Input
                  label={t("dateAndTime")}
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => set("scheduled_at", e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  error={errors.scheduled_at}
                />
              </div>
            )}
          </div>

          {/* Password — available for all room types */}
          <Input
            label={t("password")}
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={t("passwordPlaceholder")}
          />

          {errors.form && (
            <div className="space-y-1">
              <p className="text-sm text-red-500">{errors.form}</p>
              {existingRoomId && (
                <Link
                  href={`/rooms/${existingRoomId}`}
                  className="text-sm text-[#00C853] hover:underline"
                >
                  {t("goToExisting")}
                </Link>
              )}
            </div>
          )}

          <Button shimmer className="w-full justify-center" onClick={handleSubmit} disabled={loading}>
            {loading ? t("creating") : form.schedule_enabled ? t("scheduleRoom") : t("createRoom")}
          </Button>
        </div>
      </main>
      )}
    </div>
  );
}
