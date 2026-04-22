"""Add topic_ids_json to exam_questions

Revision ID: d5e9f1a2b3c4
Revises: c4f8e2a1b7d9
Create Date: 2026-04-23 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "d5e9f1a2b3c4"
down_revision: Union[str, Sequence[str], None] = "c4f8e2a1b7d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exam_questions",
        sa.Column("topic_ids_json", JSONB, nullable=True, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("exam_questions", "topic_ids_json")
