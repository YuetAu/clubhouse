import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

interface ProviderConfig {
  id: string;
  client_id: string;
  client_secret?: string;
  name?: string;
  issuer_url?: string;
  authorization_url?: string;
  token_url?: string;
  userinfo_url?: string;
  // Overrides the token endpoint auth method. Use "client_secret_post" when
  // the registered OAuth2 client is set to post (not basic) authentication.
  client_auth_method?: "client_secret_basic" | "client_secret_post" | "none";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuiltInFactory = (cfg: ProviderConfig) => any;

const BUILT_IN: Record<string, BuiltInFactory> = {
  google: (cfg) => GoogleProvider({ clientId: cfg.client_id, clientSecret: cfg.client_secret! }),
  github: (cfg) => GithubProvider({ clientId: cfg.client_id, clientSecret: cfg.client_secret! }),
  discord: (cfg) => DiscordProvider({ clientId: cfg.client_id, clientSecret: cfg.client_secret! }),
};

function buildProviders() {
  const configs: ProviderConfig[] = JSON.parse(process.env.OAUTH_PROVIDERS_JSON ?? "[]");

  return configs
    .filter((c) => {
      if (!c.client_id) return false;
      // Built-in providers (Google, GitHub, Discord) always need a secret.
      if (c.id in BUILT_IN) return !!c.client_secret;
      // Custom OIDC providers may be public clients (PKCE only, no secret).
      return true;
    })
    .map((c) => {
      const factory = BUILT_IN[c.id];
      if (factory) return factory(c);

      // Generic OIDC / OAuth2 provider
      return {
        id: c.id,
        name: c.name ?? c.id,
        type: "oauth" as const,
        ...(c.issuer_url
          ? { wellKnown: `${c.issuer_url.replace(/\/$/, "")}/.well-known/openid-configuration` }
          : {}),
        ...(c.authorization_url ? { authorization: c.authorization_url } : {}),
        ...(c.token_url ? { token: c.token_url } : {}),
        ...(c.userinfo_url ? { userinfo: c.userinfo_url } : {}),
        clientId: c.client_id,
        clientSecret: c.client_secret ?? "",
        // Pass token_endpoint_auth_method to openid-client so it uses the
        // correct auth scheme (post vs basic) to match the registered client.
        ...(c.client_auth_method
          ? { client: { token_endpoint_auth_method: c.client_auth_method } }
          : {}),
        idToken: !!c.issuer_url,
        checks: ["pkce", "state"] as ["pkce", "state"],
        profile(profile: Record<string, unknown>) {
          return {
            id: String(profile.sub ?? profile.id ?? ""),
            name: String(profile.name ?? profile.preferred_username ?? profile.login ?? profile.username ?? ""),
            image: (profile.picture ?? profile.avatar_url ?? null) as string | null,
          };
        },
      };
    });
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.provider = token.provider as string | undefined;
      return session;
    },
  },
  pages: {
    error: "/auth/error",
  },
};
