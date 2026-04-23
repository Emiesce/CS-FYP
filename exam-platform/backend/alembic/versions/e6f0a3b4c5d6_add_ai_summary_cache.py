"""Add ai_summary_cache table

Revision ID: e6f0a3b4c5d6
Revises: d5e9f1a2b3c4
Create Date: 2026-04-23 16:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e6f0a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d5e9f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_summary_cache",
        sa.Column("exam_id", sa.String(), nullable=False),
        sa.Column("grading_hash", sa.String(), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("exam_id", "grading_hash"),
    )


def downgrade() -> None:
    op.drop_table("ai_summary_cache")
