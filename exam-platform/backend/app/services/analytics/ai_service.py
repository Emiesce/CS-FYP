"""
HKUST CSE Exam Platform – Analytics AI Service

Optional AI summaries and chat over analytics snapshots.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from app.models.analytics_models import AnalyticsAISummaryOut, ExamAnalyticsSnapshotOut

logger = logging.getLogger(__name__)

_HAS_OPENAI = bool(os.getenv("OPENAI_API_KEY"))


def _snapshot_context(snapshot: ExamAnalyticsSnapshotOut, max_chars: int = 4000) -> str:
    """Compact text representation of snapshot for LLM context."""
    o = snapshot.overview
    lines = [
        f"Exam: {snapshot.course_code} – {snapshot.exam_title}",
        f"Students: {o.student_count}, Mean: {o.mean_score}/{o.max_total_points} ({o.mean_percentage}%)",
        f"Median: {o.median_score}, StdDev: {o.std_dev}, Pass rate: {o.pass_rate}%",
        "",
        "Questions (sorted by success rate asc):",
    ]
    sorted_q = sorted(snapshot.questions, key=lambda q: q.success_rate)
    for q in sorted_q[:10]:
        lines.append(
            f"  {q.question_id} ({q.question_type}): mean={q.mean_score}/{q.max_points}, "
            f"success={q.success_rate}%, overrides={q.override_count}"
        )
    if snapshot.topics:
        lines.append("")
        lines.append("Topics (sorted by % asc):")
        sorted_t = sorted(snapshot.topics, key=lambda t: t.percentage)
        for t in sorted_t:
            lines.append(
                f"  {t.topic_label}: mean={t.mean_score}/{t.max_possible} ({t.percentage}%), "
                f"questions={t.question_count}"
            )
    ctx = "\n".join(lines)
    return ctx[:max_chars]


async def generate_ai_summary(
    snapshot: ExamAnalyticsSnapshotOut,
) -> Optional[AnalyticsAISummaryOut]:
    """Generate AI summary. Returns None if AI unavailable."""
    if not _HAS_OPENAI:
        logger.info("OPENAI_API_KEY not set; skipping AI summary")
        return None

    try:
        import openai
        client = openai.AsyncOpenAI()
        ctx = _snapshot_context(snapshot)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an academic performance analyst. "
                        "Given exam analytics data, return JSON only:\n"
                        '{"commonMisconceptions":["..."],"recommendations":["..."],"confidence":"high|medium|low"}\n'
                        "Rules: max 3 items per list, no invented numbers, use only provided data. "
                        "If evidence is weak, set confidence to low."
                    ),
                },
                {"role": "user", "content": ctx},
            ],
        )

        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        return AnalyticsAISummaryOut(
            common_misconceptions=data.get("commonMisconceptions", [])[:3],
            recommendations=data.get("recommendations", [])[:3],
            confidence=data.get("confidence", "medium"),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        logger.warning("AI summary failed: %s", e)
        return None


async def analytics_chat(
    snapshot: ExamAnalyticsSnapshotOut,
    message: str,
    history: list[dict[str, str]],
) -> str:
    """Chat over analytics snapshot. Returns reply string."""
    if not _HAS_OPENAI:
        return "AI chat is unavailable (OPENAI_API_KEY not configured). The analytics data is displayed in the dashboard above."

    try:
        import openai
        client = openai.AsyncOpenAI()
        ctx = _snapshot_context(snapshot)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an AI analytics assistant for educators.\n"
                    f"Use only the following exam analytics snapshot:\n{ctx}\n\n"
                    "If the answer cannot be supported by the snapshot, say the data is unavailable.\n"
                    "Keep responses under 180 words. Do not invent statistics."
                ),
            },
        ]
        for h in history[-6:]:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
        messages.append({"role": "user", "content": message})

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            max_tokens=400,
            messages=messages,
        )
        return response.choices[0].message.content or "No response generated."
    except Exception as e:
        logger.warning("Analytics chat failed: %s", e)
        return f"AI chat encountered an error: {e}"
