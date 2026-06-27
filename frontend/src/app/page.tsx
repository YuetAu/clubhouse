"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getRooms, createInstantRoom, ApiError } from "@/lib/api";
import { RoomCard } from "@/components/room/RoomCard";
import { RoomSearch } from "@/components/room/RoomSearch";
import { UserMenu } from "@/components/auth/UserMenu";
import { LoginModal } from "@/components/auth/LoginModal";
import { AnonNicknameModal } from "@/components/auth/AnonNicknameModal";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useIdentity } from "@/hooks/useIdentity";
import { useLocale } from "@/contexts/LocaleContext";

function useScheduledLabel() {
  const t = useTranslations("Home");
  const { locale } = useLocale();
  const dateLocale = locale === "zh-TW" ? "zh-TW" : locale === "zh-CN" ? "zh-CN" : "en";

  return (isoString: string): string => {
    const date = new Date(isoString);
    const today = new Date();
    const timeStr = date.toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit" });

    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    if (isToday) return t("tonightAt", { time: timeStr });

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow =
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate();
    if (isTomorrow) return t("tomorrowAt", { time: timeStr });

    const dateStr = date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
    return t("dateAt", { date: dateStr, time: timeStr });
  };
}

export default function HomePage() {
  const router = useRouter();
  const identity = useIdentity();
  const t = useTranslations("Home");
  const tNav = useTranslations("Nav");
  const [showLogin, setShowLogin] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [showAnon, setShowAnon] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const getScheduledLabel = useScheduledLabel();

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
    refetchInterval: 15000,
  });

  const now = new Date();
  const liveRooms = rooms.filter((r) => !r.scheduled_at || new Date(r.scheduled_at) <= now);
  const upcomingRooms = rooms.filter((r) => r.scheduled_at && new Date(r.scheduled_at) > now);

  const ownedRoom =
    identity.type === "oauth"
      ? liveRooms.find((r) => r.owner_id === identity.peerId)
      : undefined;

  const handleShowCreateLogin = () => {
    setCreateMode(true);
    setShowLogin(true);
  };

  const handleStartNow = async () => {
    if (identity.type !== "oauth") {
      handleShowCreateLogin();
      return;
    }
    setStartLoading(true);
    setStartError(null);
    try {
      const room = await createInstantRoom();
      router.push(`/rooms/${room.id}`);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409 && typeof e.data === "object" && e.data !== null) {
        const data = e.data as { room_id?: string };
        if (data.room_id) {
          router.push(`/rooms/${data.room_id}`);
          return;
        }
      }
      setStartError((e as Error).message);
    } finally {
      setStartLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-[#f0ede8]" style={{ background: "var(--night-bg)" }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ background: "color-mix(in srgb, var(--night-bg) 85%, transparent)", backdropFilter: "blur(12px)" }}
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-tight"
          style={{ color: "var(--night-text)" }}
        >
          {tNav("brand")}
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <LocaleSwitcher />
          {ownedRoom ? (
            <Link
              href={`/rooms/${ownedRoom.id}`}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{ background: "var(--night-warm)", color: "#080910" }}
            >
              {tNav("returnToRoom")}
            </Link>
          ) : (
            <button
              onClick={handleStartNow}
              disabled={startLoading}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: "var(--night-warm)", color: "#080910" }}
            >
              {startLoading ? tNav("opening") : tNav("openRoom")}
            </button>
          )}
          <button
            onClick={() => {
              if (identity.type !== "oauth") {
                handleShowCreateLogin();
              } else {
                router.push("/rooms/create");
              }
            }}
            className="text-sm transition-colors"
            style={{ color: "var(--night-muted)" }}
          >
            {tNav("schedule")}
          </button>
          <UserMenu onLoginClick={() => { setCreateMode(false); setShowLogin(true); }} />
        </div>
      </header>

      {/* Hero */}
      <div className="relative px-6 pt-14 pb-10 text-center overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)",
          }}
        />
        <h1 className="relative text-3xl font-semibold mb-2" style={{ color: "var(--night-text)" }}>
          {t("hero")}
        </h1>
        <p className="relative text-sm" style={{ color: "var(--night-muted)" }}>
          {t("subHero")}
        </p>
      </div>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        {startError && (
          <div
            className="mb-6 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(239,68,68,0.1)",
              color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {startError}
          </div>
        )}

        <div className="mb-8">
          <Suspense fallback={null}>
            <RoomSearch />
          </Suspense>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-2xl animate-pulse"
                style={{ background: "var(--night-card)" }}
              />
            ))}
          </div>
        ) : liveRooms.length === 0 && upcomingRooms.length === 0 ? (
          <div className="text-center py-24" style={{ color: "var(--night-muted)" }}>
            <p className="text-4xl mb-4">🌃</p>
            <p className="text-base font-medium" style={{ color: "var(--night-text)" }}>
              {t("empty")}
            </p>
            <p className="text-sm mt-1">{t("emptyHint")}</p>
          </div>
        ) : (
          <>
            {liveRooms.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {liveRooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            )}

            {upcomingRooms.length > 0 && (
              <div className="mt-12">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest mb-5"
                  style={{ color: "var(--night-muted)" }}
                >
                  {t("comingUp")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {upcomingRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      scheduledLabel={getScheduledLabel(room.scheduled_at!)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <LoginModal
        open={showLogin}
        onClose={() => { setShowLogin(false); setCreateMode(false); }}
        onAnonClick={createMode ? undefined : () => {
          setShowLogin(false);
          setShowAnon(true);
        }}
        hideAnon={createMode}
        subtitle={createMode ? tNav("signInToCreate") : undefined}
      />
      <AnonNicknameModal
        open={showAnon}
        onClose={() => setShowAnon(false)}
        onSuccess={() => setShowAnon(false)}
      />
    </div>
  );
}
