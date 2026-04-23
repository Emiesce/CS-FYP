"""Add auth and catalog fields

Revision ID: c4f8e2a1b7d9
Revises: 9c943803c081
Create Date: 2026-04-22 03:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f8e2a1b7d9"
down_revision: Union[str, Sequence[str], None] = "9c943803c081"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("student_number", sa.String(), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.add_column("courses", sa.Column("semester_id", sa.String(), nullable=True))
    op.add_column("courses", sa.Column("updated_at", sa.DateTime(), nullable=True))

    op.add_column("exams", sa.Column("semester_id", sa.String(), nullable=True))
    op.add_column("exams", sa.Column("status", sa.String(), nullable=True))

    op.execute("UPDATE users SET first_name = name, last_name = '', password_hash = 'legacy-user', updated_at = COALESCE(created_at, NOW())")
    op.execute("UPDATE courses SET semester_id = '2025-26-spring', updated_at = COALESCE(created_at, NOW())")
    op.execute("UPDATE exams SET semester_id = '2025-26-spring', status = 'past'")

    op.alter_column("users", "first_name", nullable=False)
    op.alter_column("users", "last_name", nullable=False)
    op.alter_column("users", "password_hash", nullable=False)
    op.alter_column("users", "updated_at", nullable=False)
    op.alter_column("courses", "semester_id", nullable=False)
    op.alter_column("courses", "updated_at", nullable=False)
    op.alter_column("exams", "semester_id", nullable=False)
    op.alter_column("exams", "status", nullable=False)

    op.drop_column("users", "name")


def downgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(), nullable=True))
    op.execute("UPDATE users SET name = TRIM(first_name || ' ' || last_name)")

    op.drop_column("exams", "status")
    op.drop_column("exams", "semester_id")
    op.drop_column("courses", "updated_at")
    op.drop_column("courses", "semester_id")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "student_number")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
