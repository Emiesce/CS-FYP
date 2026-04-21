"""Add proctoring tables

Revision ID: a1b2c3d4e5f6
Revises: 0cb2fa6d0d74
Create Date: 2026-04-21 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '0cb2fa6d0d74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'proctoring_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('exam_id', sa.String(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('student_name', sa.String(), nullable=False, server_default=''),
        sa.Column('student_number', sa.String(), nullable=False, server_default=''),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('session_status', sa.String(), nullable=False, server_default='live'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('rolling_average', sa.Float(), nullable=False, server_default='0'),
        sa.Column('event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('high_severity_event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'live_status_json',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_proctoring_sessions_exam_id', 'proctoring_sessions', ['exam_id'])
    op.create_index('ix_proctoring_sessions_student_id', 'proctoring_sessions', ['student_id'])

    op.create_table(
        'proctoring_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('exam_id', sa.String(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('severity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('message', sa.Text(), nullable=False, server_default=''),
        sa.Column('has_evidence_clip', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['proctoring_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_proctoring_events_session_id', 'proctoring_events', ['session_id'])
    op.create_index('ix_proctoring_events_exam_id', 'proctoring_events', ['exam_id'])
    op.create_index('ix_proctoring_events_student_id', 'proctoring_events', ['student_id'])

    op.create_table(
        'proctoring_buckets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('bucket_index', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['session_id'], ['proctoring_sessions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_proctoring_buckets_session_id', 'proctoring_buckets', ['session_id'])


def downgrade() -> None:
    op.drop_index('ix_proctoring_buckets_session_id', table_name='proctoring_buckets')
    op.drop_table('proctoring_buckets')
    op.drop_index('ix_proctoring_events_student_id', table_name='proctoring_events')
    op.drop_index('ix_proctoring_events_exam_id', table_name='proctoring_events')
    op.drop_index('ix_proctoring_events_session_id', table_name='proctoring_events')
    op.drop_table('proctoring_events')
    op.drop_index('ix_proctoring_sessions_student_id', table_name='proctoring_sessions')
    op.drop_index('ix_proctoring_sessions_exam_id', table_name='proctoring_sessions')
    op.drop_table('proctoring_sessions')
