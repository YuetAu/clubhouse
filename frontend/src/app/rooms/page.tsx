"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getRooms } from "@/lib/api";
import { RoomCard } from "@/components/room/RoomCard";
import { RoomSearch } from "@/components/room/RoomSearch";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import Link from "next/link";

function RoomsContent() {
  const params = useSearchParams();
  const q = params.get("q") ?? undefined;
  const t = useTranslations("RoomsPage");
  const tNav = useTranslations("Nav");

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms", q],
    queryFn: () => getRooms({ q }),
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen bg-[var(--night-bg)] text-[var(--night-text)]">
      <header className="border-b border-[var(--night-border)] px-4 py-3 flex items-center gap-4 sticky top-0 bg-[var(--night-bg)]/95 backdrop-blur z-40">
        <Link href="/" className="text-lg font-semibold text-[var(--night-text)] tracking-tight shrink-0">
          {tNav("brand")}
        </Link>
        <div className="flex-1">
          <RoomSearch />
        </div>
        <ThemeToggle />
        <Link href="/rooms/create">
          <ShimmerButton className="px-4 py-2 text-sm font-semibold whitespace-nowrap">
            {t("startRoom")}
          </ShimmerButton>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {q && (
          <p className="text-[var(--night-muted)] text-sm mb-4">
            {t("resultsFor", { q })}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-36 bg-[var(--night-card)] rounded-2xl animate-pulse border border-[var(--night-border)]"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-[var(--night-muted)]">
            <p>{q ? t("noRoomsFor", { q }) : t("noRooms")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsContent />
    </Suspense>
  );
}
