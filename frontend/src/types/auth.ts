import type { DefaultSession } from "next-auth";

export interface ClubhouseUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_anon: boolean;
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    provider?: string;
    backendJwt?: string;
  }

  interface JWT {
    accessToken?: string;
    provider?: string;
  }
}
