import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from app.config import settings
from app.database import AsyncSessionLocal, engine
from app.models.room import Room
from app.routers import auth, chat, media, rooms, stage, ws

logger = logging.getLogger(__name__)


async def _auto_close_empty_rooms() -> None:
    while True:
        await asyncio.sleep(300)  # check every 5 minutes
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Room)
                    .where(Room.last_emptied_at <= cutoff, Room.closed_at.is_(None))
                    .values(closed_at=datetime.now(timezone.utc))
                )
                await db.commit()
        except Exception:
            logger.exception("Error in auto-close background task")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_auto_close_empty_rooms())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(title="Clubhouse API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(rooms.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(stage.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
