"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { getAnonIdentity } from "@/lib/anon";
import { BACKEND_JWT_KEY } from "@/lib/constants";
import { loginOAuth, refreshToken, clearToken } from "@/lib/api";

export type Identity =
  | { type: "oauth"; peerId: string; displayName: string; avatarUrl: string | null; isVerified: true }
  | { type: "anon"; peerId: string; displayName: string; isVerified: false }
  | { type: "loading" }
  | { type: "none" };

function readBackendJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BACKEND_JWT_KEY);
}

function parseJwtPayload(jwt: string): Record<string, unknown> {
  const base64Url = jwt.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload);
}

function isJwtExpired(jwt: string): boolean {
  try {
    const { exp } = parseJwtPayload(jwt);
    return typeof exp === "number" && Date.now() / 1000 > exp;
  } catch {
    return true;
  }
}

function jwtSecondsRemaining(jwt: string): number {
  try {
    const { exp } = parseJwtPayload(jwt);
    if (typeof exp !== "number") return 0;
    return exp - Date.now() / 1000;
  } catch {
    return 0;
  }
}

// Refresh the backend JWT when less than 1 hour remains
const REFRESH_THRESHOLD_SECONDS = 3600;

export function useIdentity(): Identity {
  const { data: session, status } = useSession();
  const [backendJwt, setBackendJwt] = useState<string | null>(() => readBackendJwt());
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeFailed, setExchangeFailed] = useState(false);
  // true while we're attempting to refresh an expired backend JWT
  const [isRefreshing, setIsRefreshing] = useState(() => {
    const jwt = readBackendJwt();
    return jwt !== null && isJwtExpired(jwt);
  });

  // Listen for token changes via custom DOM event
  useEffect(() => {
    const handleTokenChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ token: string | null }>;
      const token = customEvent.detail.token;
      if (token && !isJwtExpired(token)) {
        setBackendJwt(token);
      } else {
        setBackendJwt(null);
      }
    };

    window.addEventListener("tokenChanged", handleTokenChange);
    return () => window.removeEventListener("tokenChanged", handleTokenChange);
  }, []);

  // When backend JWT is expired: try to refresh it; if that fails, sign out
  useEffect(() => {
    if (!backendJwt || !isJwtExpired(backendJwt)) return;

    setIsRefreshing(true);
    refreshToken()
      .then(() => {
        setBackendJwt(readBackendJwt());
        setIsRefreshing(false);
      })
      .catch(() => {
        clearToken();
        setBackendJwt(null);
        setIsRefreshing(false);
        signOut({ callbackUrl: "/" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // run once on mount — backendJwt won't change between expired state transitions

  // Exchange NextAuth provider token for backend JWT when needed
  useEffect(() => {
    if (!session?.accessToken || !session.provider) return;
    if (exchangeFailed) return;
    if (isRefreshing) return; // wait for the refresh attempt to finish first

    const existing = readBackendJwt();
    if (existing && !isJwtExpired(existing)) {
      try {
        const p = parseJwtPayload(existing);
        if (!p.anon) return; // already have a valid authenticated backend JWT
      } catch {
        // fall through to exchange
      }
    }

    setIsExchanging(true);
    loginOAuth(session.provider as string, session.accessToken as string)
      .then(() => setBackendJwt(readBackendJwt()))
      .catch(() => {
        // Provider access token is likely expired; force a fresh OAuth sign-in
        // so the user gets a new provider token and the exchange can succeed.
        setExchangeFailed(true);
        signIn(session!.provider as string, { callbackUrl: window.location.href });
      })
      .finally(() => setIsExchanging(false));
  }, [session?.accessToken, session?.provider, exchangeFailed]);

  // Proactive refresh: renew the backend JWT before it expires
  useEffect(() => {
    if (!backendJwt || isJwtExpired(backendJwt)) return;

    const remaining = jwtSecondsRemaining(backendJwt);
    if (remaining <= 0) return;

    const delay = Math.max(0, (remaining - REFRESH_THRESHOLD_SECONDS) * 1000);
    const timer = setTimeout(() => {
      refreshToken()
        .then(() => setBackendJwt(readBackendJwt()))
        .catch(() => { }); // will retry when user navigates or token changes
    }, delay);

    return () => clearTimeout(timer);
  }, [backendJwt]);

  // Return "loading" while:
  // - NextAuth is hydrating
  // - a refresh of an expired backend JWT is in flight
  // - an exchange is in flight
  // - we have an OAuth session but no valid backend JWT yet (exchange is about to start)
  const hasValidJwt = !!backendJwt && !isJwtExpired(backendJwt);
  const needsExchange =
    status === "authenticated" &&
    !!session?.accessToken &&
    !!session?.provider &&
    !exchangeFailed &&
    !hasValidJwt &&
    !isRefreshing;

  if (status === "loading" || isRefreshing || (status === "authenticated" && (isExchanging || needsExchange))) {
    return { type: "loading" };
  }

  if (session?.user && hasValidJwt) {
    try {
      const payload = parseJwtPayload(backendJwt!);
      if (!payload.anon) {
        return {
          type: "oauth",
          peerId: payload.sub as string,
          displayName: session.user.name ?? "",
          avatarUrl: session.user.image ?? null,
          isVerified: true,
        };
      }
    } catch {
      // fall through
    }
  }

  if (hasValidJwt) {
    try {
      const payload = parseJwtPayload(backendJwt!);
      const anonId = getAnonIdentity();
      return {
        type: "anon",
        peerId: payload.sub as string,
        displayName: anonId?.displayName ?? "Anonymous",
        isVerified: false,
      };
    } catch {
      // fall through
    }
  }

  return { type: "none" };
}
