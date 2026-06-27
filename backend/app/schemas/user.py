import uuid
from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    display_name: str
    avatar_url: str | None
    is_verified: bool
    is_anon: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AnonRegisterIn(BaseModel):
    anon_token: str
    display_name: str


class OAuthCallbackIn(BaseModel):
    provider_access_token: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
