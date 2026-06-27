import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token, decode_access_token_allow_expired
from app.auth.oauth import PROVIDERS, get_userinfo_url, normalize_profile
from app.database import get_db
from app.models.user import OAuthAccount, User
from app.schemas.user import AnonRegisterIn, OAuthCallbackIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


@router.post("/callback/{provider}", response_model=TokenOut)
async def oauth_callback(
    provider: str,
    body: OAuthCallbackIn,
    db: AsyncSession = Depends(get_db),
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider: {provider}")

    headers = {"Authorization": f"Bearer {body.provider_access_token}"}

    async with httpx.AsyncClient() as client:
        userinfo_url = await get_userinfo_url(provider, client)
        resp = await client.get(userinfo_url, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid provider token")
        raw_profile = resp.json()

    profile = normalize_profile(provider, raw_profile)

    # Upsert OAuthAccount → User
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_uid == profile["uid"],
        )
    )
    oauth_account = result.scalar_one_or_none()

    if oauth_account:
        user = await db.get(User, oauth_account.user_id)
        user.display_name = profile["display_name"]
        user.avatar_url = profile["avatar_url"]
        user.is_verified = True
        oauth_account.access_token = body.provider_access_token
    else:
        user = User(
            id=uuid.uuid4(),
            display_name=profile["display_name"],
            avatar_url=profile["avatar_url"],
            is_verified=True,
            is_anon=False,
        )
        db.add(user)
        await db.flush()

        oauth_account = OAuthAccount(
            id=uuid.uuid4(),
            user_id=user.id,
            provider=provider,
            provider_uid=profile["uid"],
            access_token=body.provider_access_token,
        )
        db.add(oauth_account)

    await db.flush()
    token = create_access_token(str(user.id), is_anon=False)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/anon", response_model=TokenOut)
async def anon_register(body: AnonRegisterIn, db: AsyncSession = Depends(get_db)):
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Display name required")

    result = await db.execute(select(User).where(User.anon_token == body.anon_token))
    user = result.scalar_one_or_none()

    if user:
        user.display_name = display_name
    else:
        user = User(
            id=uuid.uuid4(),
            display_name=display_name,
            is_verified=False,
            is_anon=True,
            anon_token=body.anon_token,
        )
        db.add(user)

    await db.flush()
    token = create_access_token(str(user.id), is_anon=True)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/refresh", response_model=TokenOut)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token_allow_expired(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token = create_access_token(str(user.id), is_anon=user.is_anon)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_anon:
        current_user.anon_token = None
    # JWT is stateless; client must drop the token. For anon users, invalidate the matching token.
