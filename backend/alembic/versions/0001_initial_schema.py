"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_anon", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("anon_token", sa.String(64), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "oauth_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_uid", sa.String(256), nullable=False),
        sa.Column("access_token", sa.Text, nullable=True),
        sa.Column("refresh_token", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_uid", name="uq_oauth_provider_uid"),
    )

    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("title", sa.String(128), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("topic_tags", postgresql.ARRAY(sa.String(32)), nullable=True),
        sa.Column("is_private", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("max_speakers", sa.SmallInteger, nullable=False, server_default="10"),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Full-text search index on rooms
    op.execute(
        "CREATE INDEX idx_rooms_fts ON rooms USING gin(to_tsvector('english', title || ' ' || coalesce(description, '')))"
    )

    op.create_table(
        "room_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("role", sa.String(16), nullable=False, server_default="listener"),
        sa.Column("has_raised_hand", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_muted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("room_id", "user_id", name="uq_room_participant"),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_chat_messages_room_created", "chat_messages", ["room_id", sa.text("created_at DESC")])

    op.create_table(
        "media_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE")),
        sa.Column("slot_type", sa.String(16), nullable=False),
        sa.Column("source_url", sa.Text, nullable=False),
        sa.Column("label", sa.String(64), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("media_slots")
    op.drop_table("chat_messages")
    op.drop_table("room_participants")
    op.execute("DROP INDEX IF EXISTS idx_rooms_fts")
    op.drop_table("rooms")
    op.drop_table("oauth_accounts")
    op.drop_table("users")
