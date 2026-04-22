"""
HKUST CSE Exam Platform – Analytics AI Service

AI summaries and chat over analytics snapshots via OpenRouter.
Switch models by changing AI_MODEL in .env or the default below.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from app.models.analytics_models import AnalyticsAISummaryOut, ExamAnalyticsSnapshotOut

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
_API_KEY  = os.getenv("OPENROUTER_API_KEY")
_BASE_URL = "https://openrouter.ai/api/v1"
_MODEL    = os.getenv("AI_MODEL", "deepseek/deepseek-v3-2")  # override via .env
_HAS_AI   = bool(_API_KEY)


def _make_client():
    """Return a configured async OpenAI-compatible client."""
    import openai
    return openai.AsyncOpenAI(api_key=_API_KEY, base_url=_BASE_URL)


async def _chat_completion(messages: list[dict], temperature: float, max_tokens: int, json_mode: bool = False) -> str:
    """Low-level helper – call the model and return the text content."""
    client = _make_client()
    kwargs = dict(
        model=_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=messages,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


# ── Snapshot context builder ─────────────────────────────────────────────────

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
    for q in sorted(snapshot.questions, key=lambda q: q.success_rate)[:10]:
        lines.append(
            f"  {q.question_id} ({q.question_type}): mean={q.mean_score}/{q.max_points}, "
            f"success={q.success_rate}%, overrides={q.override_count}"
        )
    if snapshot.topics:
        lines += ["", "Topics (sorted by % asc):"]
        for t in sorted(snapshot.topics, key=lambda t: t.percentage):
            lines.append(
                f"  {t.topic_label}: mean={t.mean_score}/{t.max_possible} ({t.percentage}%), "
                f"questions={t.question_count}"
            )
    return "\n".join(lines)[:max_chars]


# ── Public API ───────────────────────────────────────────────────────────────

async def generate_ai_summary(
    snapshot: ExamAnalyticsSnapshotOut,
) -> Optional[AnalyticsAISummaryOut]:
    """Generate an AI summary of the exam analytics. Returns None if AI is unavailable."""
    if not _HAS_AI:
        logger.info("OPENROUTER_API_KEY not set; skipping AI summary")
        return None

    try:
        raw = await _chat_completion(
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
                {"role": "user", "content": _snapshot_context(snapshot)},
            ],
            temperature=0.3,
            max_tokens=500,
            json_mode=True,
        )
        data = json.loads(raw or "{}")
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
    """Answer a question about the analytics snapshot. Returns the reply string."""
    if not _HAS_AI:
        return "AI chat is unavailable (OPENROUTER_API_KEY not configured). The analytics data is displayed in the dashboard above."

    try:
        system_msg = {
            "role": "system",
            "content": (
                "You are an AI analytics assistant for educators.\n"
                f"Use only the following exam analytics snapshot:\n{_snapshot_context(snapshot)}\n\n"
                "If the answer cannot be supported by the snapshot, say the data is unavailable.\n"
                "Keep responses under 180 words. Do not invent statistics."
            ),
        }
        prior = [{"role": h.get("role", "user"), "content": h.get("content", "")} for h in history[-6:]]
        messages = [system_msg, *prior, {"role": "user", "content": message}]

        return await _chat_completion(messages=messages, temperature=0.4, max_tokens=400)
    except Exception as e:
        logger.warning("Analytics chat failed: %s", e)
        return f"AI chat encountered an error: {e}"
