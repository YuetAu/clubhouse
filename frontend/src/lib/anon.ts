import { ANON_IDENTITY_KEY } from "./constants";

export interface AnonIdentity {
  anonToken: string;
  displayName: string;
}

function generateToken(): string {
  return crypto.randomUUID();
}

export function getAnonIdentity(): AnonIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ANON_IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnonIdentity;
  } catch {
    return null;
  }
}

export function setAnonIdentity(displayName: string): AnonIdentity {
  const identity: AnonIdentity = {
    anonToken: getAnonIdentity()?.anonToken ?? generateToken(),
    displayName,
  };
  localStorage.setItem(ANON_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function clearAnonIdentity(): void {
  localStorage.removeItem(ANON_IDENTITY_KEY);
}
