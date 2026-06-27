from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings


def create_access_token(user_id: str, is_anon: bool = False, expire_minutes: int | None = None) -> str:
    minutes = expire_minutes or (
        settings.ANON_JWT_EXPIRE_MINUTES if is_anon else settings.JWT_EXPIRE_MINUTES
    )
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    payload = {
        "sub": user_id,
        "anon": is_anon,
        "iat": datetime.now(UTC),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


# Maximum seconds past expiry that we still allow a refresh (30 days)
REFRESH_GRACE_SECONDS = 30 * 24 * 3600


def decode_access_token_allow_expired(token: str) -> dict:
    """Decode JWT verifying signature but not expiry. Only for the refresh endpoint."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc

    exp = payload.get("exp")
    if exp is not None and datetime.now(UTC).timestamp() > exp + REFRESH_GRACE_SECONDS:
        raise ValueError("Token too old to refresh")

    return payload
