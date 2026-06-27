"""add room_bans table

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "room_bans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("banned_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("banned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_room_bans_lookup", "room_bans", ["room_id", "user_id"])


def downgrade() -> None:
    op.drop_index("idx_room_bans_lookup", table_name="room_bans")
    op.drop_table("room_bans")
