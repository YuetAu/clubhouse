"""add password, is_temporary, scheduled_at, last_emptied_at to rooms

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("rooms", sa.Column("password_hash", sa.String(128), nullable=True))
    op.add_column(
        "rooms",
        sa.Column("is_temporary", sa.Boolean, nullable=False, server_default="false"),
    )
    op.add_column("rooms", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("rooms", sa.Column("last_emptied_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index(
        "idx_rooms_last_emptied",
        "rooms",
        ["last_emptied_at"],
        postgresql_where=sa.text("last_emptied_at IS NOT NULL AND closed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_rooms_last_emptied", table_name="rooms")
    op.drop_column("rooms", "last_emptied_at")
    op.drop_column("rooms", "scheduled_at")
    op.drop_column("rooms", "is_temporary")
    op.drop_column("rooms", "password_hash")
