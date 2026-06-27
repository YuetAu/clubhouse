"""
OAuth/OIDC provider registry driven by OAUTH_PROVIDERS_JSON.

Configure providers in .env:
  OAUTH_PROVIDERS_JSON=[
    {"id":"google","client_id":"...","client_secret":"..."},
    {"id":"github","client_id":"...","client_secret":"..."},
    {"id":"myoidc","client_id":"...","client_secret":"...","issuer_url":"https://sso.example.com"}
  ]

Well-known providers (google, github, discord) have built-in defaults.
Custom providers need "issuer_url" (OIDC discovery) or explicit "userinfo_url".
Profile field overrides: uid_field, name_field, name_fallback_field, avatar_field.
"""

import httpx

from app.config import settings

# Defaults for providers whose endpoints and profile shapes are well-known.
_WELL_KNOWN: dict[str, dict] = {
    "google": {
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "uid_field": "sub",
        "name_field": "name",
        "avatar_field": "picture",
    },
    "github": {
        "userinfo_url": "https://api.github.com/user",
        "emails_url": "https://api.github.com/user/emails",
        "uid_field": "id",
        "name_field": "name",
        "name_fallback_field": "login",
        "avatar_field": "avatar_url",
    },
    "discord": {
        "userinfo_url": "https://discord.com/api/users/@me",
        "uid_field": "id",
        "name_field": "global_name",
        "name_fallback_field": "username",
        "avatar_computed": "discord",
    },
    "kioubit": {
        "userinfo_url": "https://dn42.g-load.eu/oauth2/userinfo",
        "uid_field": "sub",
        "name_field": "name",
        "name_fallback_field": "preferred_username",
    },
}

# Cache for OIDC-discovered userinfo URLs (issuer_url → userinfo_endpoint).
_discovery_cache: dict[str, str] = {}


def _build_providers() -> dict[str, dict]:
    result: dict[str, dict] = {}
    for entry in settings.oauth_providers:
        pid = entry["id"]
        # Merge well-known defaults (entry values take precedence).
        cfg = {**_WELL_KNOWN.get(pid, {}), **entry}
        result[pid] = cfg
    return result


PROVIDERS = _build_providers()


async def get_userinfo_url(provider_id: str, client: httpx.AsyncClient) -> str:
    cfg = PROVIDERS[provider_id]
    if "userinfo_url" in cfg:
        return cfg["userinfo_url"]

    issuer_url = cfg.get("issuer_url", "").rstrip("/")
    if not issuer_url:
        raise ValueError(f"Provider '{provider_id}' has no userinfo_url or issuer_url configured")

    if issuer_url not in _discovery_cache:
        resp = await client.get(f"{issuer_url}/.well-known/openid-configuration")
        resp.raise_for_status()
        _discovery_cache[issuer_url] = resp.json()["userinfo_endpoint"]

    return _discovery_cache[issuer_url]


def normalize_profile(provider: str, raw: dict) -> dict:
    cfg = PROVIDERS[provider]

    uid_field = cfg.get("uid_field", "sub")
    uid = str(raw[uid_field])

    name_field = cfg.get("name_field", "name")
    fallback_field = cfg.get("name_fallback_field", "")
    display_name = raw.get(name_field) or (raw.get(fallback_field) if fallback_field else None) or uid

    avatar_computed = cfg.get("avatar_computed")
    if avatar_computed == "discord":
        avatar_hash = raw.get("avatar")
        avatar_url = f"https://cdn.discordapp.com/avatars/{uid}/{avatar_hash}.png" if avatar_hash else None
    else:
        avatar_field = cfg.get("avatar_field", "picture")
        avatar_url = raw.get(avatar_field)

    return {"uid": uid, "display_name": display_name, "avatar_url": avatar_url}
