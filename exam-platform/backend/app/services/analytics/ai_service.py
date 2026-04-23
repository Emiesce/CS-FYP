"""
HKUST CSE Exam Platform – Analytics AI Service

AI summaries and chat over analytics snapshots via OpenRouter.
Uses httpx directly (no openai SDK required) – works on Python 3.9+.
Switch models by setting AI_MODEL in .env.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING

import httpx

from app.models.analytics_models import AnalyticsAISummaryOut, ExamAnalyticsSnapshotOut
from app.models.grading_models import GradingRunOut

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
_API_KEY  = os.getenv("OPENROUTER_API_KEY")
_BASE_URL = "https://openrouter.ai/api/v1"
_MODEL    = os.getenv("AI_MODEL", "deepseek/deepseek-chat")   # override via .env
_HAS_AI   = bool(_API_KEY)

# ── Context cache (in-memory, rebuilt per process) ────────────────────────────
# Stores the prebuilt LLM context string keyed by grading_hash so chat turns
# don't rebuild it every message. This is cheap to rebuild so in-memory is fine.
_context_cache: dict[str, str] = {}
_MAX_CACHE = 32  # max entries


def _grading_hash(exam_id: str, grading_runs: list[GradingRunOut]) -> str:
    """Stable hash that changes only when grading data changes.

    Keyed on exam_id + sorted run IDs + graded count so that:
    - Adding a new student grade → new hash → regenerate summary
    - Reloading the same data → same hash → DB cache hit, no LLM call
    """
    run_ids = sorted(str(r.id) for r in grading_runs)
    raw = f"{exam_id}|{len(grading_runs)}|{'|'.join(run_ids)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _cache_key(snapshot: ExamAnalyticsSnapshotOut) -> str:
    """Legacy key used only for the context string cache."""
    raw = f"{snapshot.exam_id}|{snapshot.generated_at}|{snapshot.overview.graded_count}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def _chat_completion(
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    json_mode: bool = False,
) -> str:
    """Call the OpenRouter chat-completion endpoint and return the text content."""
    payload: dict = {
        "model": _MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://hkust-exam-platform",
        "X-Title": "HKUST Exam Platform Analytics",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"] or ""


# ── Snapshot context builder ─────────────────────────────────────────────────

def _snapshot_context(snapshot: ExamAnalyticsSnapshotOut, max_chars: int = 5000) -> str:
    """Rich text representation of aggregated analytics for the LLM."""
    o = snapshot.overview
    lines = [
        "=== EXAM ANALYTICS SNAPSHOT ===",
        f"Course  : {snapshot.course_code} – {snapshot.course_name}",
        f"Exam    : {snapshot.exam_title}",
        f"Generated: {snapshot.generated_at}",
        "",
        "── CLASS OVERVIEW ──",
        f"  Total students   : {o.student_count}",
        f"  Graded students  : {o.graded_count}",
        f"  Max total points : {o.max_total_points}",
        f"  Mean score       : {o.mean_score:.2f}  ({o.mean_percentage:.1f}%)",
        f"  Median score     : {o.median_score:.2f}",
        f"  Highest score    : {o.highest_score:.2f}",
        f"  Lowest score     : {o.lowest_score:.2f}",
        f"  Std deviation    : {o.std_dev:.2f}",
        f"  Pass rate        : {o.pass_rate:.1f}%",
    ]

    if o.score_distribution:
        lines += ["", "  Score distribution:"]
        for b in o.score_distribution:
            lines.append(f"    {b.label}: {b.count} student(s)")

    if snapshot.questions:
        lines += ["", "── QUESTION BREAKDOWN (sorted by success rate, ascending) ──"]
        for q in sorted(snapshot.questions, key=lambda q: q.success_rate):
            topic_str = f", topics={q.topic_ids}" if q.topic_ids else ""
            lines.append(
                f"  [{q.question_id}] {q.question_title} ({q.question_type}){topic_str}"
            )
            lines.append(
                f"    mean={q.mean_score:.2f}/{q.max_points}, "
                f"median={q.median_score:.2f}, "
                f"min={q.min_score:.2f}, max={q.max_score:.2f}, "
                f"std={q.std_dev:.2f}, success={q.success_rate:.1f}%, "
                f"overrides={q.override_count}"
            )
            if q.score_distribution:
                dist_str = ", ".join(f"{b.label}:{b.count}" for b in q.score_distribution)
                lines.append(f"    distribution: {dist_str}")

    if snapshot.topics:
        lines += ["", "── TOPIC PERFORMANCE (sorted by % score, ascending) ──"]
        for t in sorted(snapshot.topics, key=lambda t: t.percentage):
            weakest = f", weakest_q={t.weakest_question_id}" if t.weakest_question_id else ""
            lines.append(
                f"  {t.topic_label}: {t.mean_score:.2f}/{t.max_possible} "
                f"({t.percentage:.1f}%), {t.question_count} question(s){weakest}"
            )

    if snapshot.students:
        lines += ["", "── STUDENT SUMMARY (sorted by score, ascending) ──"]
        for s in sorted(snapshot.students, key=lambda s: s.percentage):
            risk = ""
            if s.risk_score is not None:
                risk = f", risk={s.risk_score:.0f}"
                if s.high_severity_event_count:
                    risk += f" (high-sev events={s.high_severity_event_count})"
            lines.append(
                f"  {s.student_name} ({s.student_id}): "
                f"{s.total_score:.1f}/{s.max_score:.1f} ({s.percentage:.1f}%)"
                f", overrides={s.review_override_count}{risk}"
            )

    return "\n".join(lines)[:max_chars]


def _grading_feedback_context(
    grading_runs: list[GradingRunOut],
    max_chars: int = 4000,
) -> str:
    """
    Build an AGGREGATED grading-feedback block rather than per-student detail.

    Strategy (keeps token count small while preserving analytical value):
    - Per question: collect all student scores and group by criterion.
    - Per criterion: emit mean score, pass-rate, and up to 3 representative
      rationale snippets (sampled from students who failed the criterion).
    - Per student: one summary line only (total score + worst 2 criterion labels).
    - Override comments (instructor edits) are included as-is — they are rare.
    """
    if not grading_runs:
        return ""

    from collections import defaultdict

    # ── 1. Aggregate per question → per criterion ─────────────────────────────
    # q_data[qid] = {"title": ..., "max": ..., "type": ...,
    #                "scores": [...], "criteria": {label: {"max": float, "scores":[], "fails":[rationale,...]}}}
    q_data: dict = defaultdict(lambda: {
        "title": "", "max": 0.0, "type": "", "scores": [], "criteria": defaultdict(lambda: {"max": 0.0, "scores": [], "fails": []})
    })

    student_summaries: list[str] = []

    for run in grading_runs:
        worst: list[tuple[float, str]] = []  # (score_frac, criterion_label)

        for qr in run.question_results:
            qid = str(qr.question_id)
            q = q_data[qid]
            # QuestionGradeResult has no question_title field — use question_id as label
            q["title"] = q["title"] or qid
            q["max"] = qr.max_points
            q["type"] = qr.question_type or ""
            q["scores"].append(qr.raw_score)

            for cr in qr.criterion_results:
                label = cr.criterion_label or str(cr.criterion_id)
                cdata = q["criteria"][label]
                cdata["max"] = cr.max_points  # store the authoritative max_points
                cdata["scores"].append(cr.score)
                frac = cr.score / cr.max_points if cr.max_points else 1.0
                worst.append((frac, label))
                # Collect up to 5 failure rationale snippets per criterion
                if frac < 1.0 and cr.rationale and len(cdata["fails"]) < 5:
                    cdata["fails"].append(cr.rationale[:120])
                # Override comments are rare — always include
                if cr.override_score is not None and cr.reviewer_rationale:
                    over_line = (
                        f"[Override {cr.override_score}/{cr.max_points}] "
                        f"{cr.reviewer_rationale[:100]}"
                    )
                    if over_line not in cdata.get("overrides", []):
                        cdata.setdefault("overrides", []).append(over_line)

        # One summary line per student listing their two worst criteria
        worst.sort()
        bad_labels = ", ".join(lbl for _, lbl in worst[:2]) if worst else "—"
        student_summaries.append(
            f"  {run.student_id}: {run.total_score}/{run.max_total_points} "
            f"(weakest: {bad_labels})"
        )

    # ── 2. Render ─────────────────────────────────────────────────────────────
    lines = ["", "── GRADING FEEDBACK (aggregated) ──"]

    for qid, q in q_data.items():
        scores = q["scores"]
        if not scores:
            continue
        n = len(scores)
        mean = sum(scores) / n
        lines.append(
            f"\nQ[{qid}] {q['title']} ({q['type']}) | "
            f"mean={mean:.2f}/{q['max']} | n={n}"
        )
        for label, cdata in q["criteria"].items():
            cs = cdata["scores"]
            if not cs:
                continue
            c_mean = sum(cs) / len(cs)
            c_max = cdata["max"]
            pass_rate = sum(1 for s in cs if s >= c_max) / len(cs) * 100 if c_max else 0
            lines.append(f"  Criterion '{label}': mean={c_mean:.2f}/{c_max:.1f}, pass={pass_rate:.0f}%")
            # Up to 3 representative failure snippets
            for snippet in cdata["fails"][:3]:
                lines.append(f"    • {snippet}")
            # Override comments
            for ov in cdata.get("overrides", [])[:2]:
                lines.append(f"    ★ {ov}")

    # Student summary table
    lines += ["", "── STUDENT SCORE SUMMARY ──"]
    lines += student_summaries

    return "\n".join(lines)[:max_chars]


def _build_full_context(
    snapshot: ExamAnalyticsSnapshotOut,
    grading_runs: list[GradingRunOut],
) -> str:
    """Combine the snapshot overview and grading feedback into one context string.
    Result is cached so subsequent chat turns reuse it without rebuilding."""
    key = _cache_key(snapshot)
    if key in _context_cache:
        return _context_cache[key]

    # Reserve ~4 000 chars for overview, ~3 000 for aggregated feedback
    overview = _snapshot_context(snapshot, max_chars=4000)
    feedback = _grading_feedback_context(grading_runs, max_chars=3000)
    combined = overview + feedback

    # Evict oldest entry if cache is full
    if len(_context_cache) >= _MAX_CACHE:
        oldest = next(iter(_context_cache))
        del _context_cache[oldest]

    _context_cache[key] = combined
    return combined


# ── Public API ───────────────────────────────────────────────────────────────

async def generate_ai_summary(
    snapshot: ExamAnalyticsSnapshotOut,
    grading_runs: Optional[list[GradingRunOut]] = None,
    db: Optional["Session"] = None,
) -> Optional[AnalyticsAISummaryOut]:
    """Generate an AI summary of the exam analytics. Returns None if AI is unavailable.

    Caching strategy (DB-backed):
    - Hash = SHA-256 of (exam_id + sorted run IDs + run count).
    - On page load: query ai_summary_cache for this hash → return immediately, no LLM call.
    - Hash only changes when a new grading run is added or removed, so edits that
      don't change the set of runs (e.g. overrides) keep the cached summary.
    - Old rows for the same exam_id with a different hash are deleted to avoid stale data.
    """
    if not _HAS_AI:
        logger.info("OPENROUTER_API_KEY not set; skipping AI summary")
        return None

    runs = grading_runs or []
    g_hash = _grading_hash(snapshot.exam_id, runs)

    # ── 1. DB cache lookup ────────────────────────────────────────────────────
    if db is not None:
        from app.db.models.analytics import AiSummaryCache
        row = db.query(AiSummaryCache).filter_by(
            exam_id=snapshot.exam_id, grading_hash=g_hash
        ).first()
        if row:
            logger.debug("AI summary DB cache hit for exam=%s hash=%s", snapshot.exam_id, g_hash)
            try:
                data = json.loads(row.payload)
                return AnalyticsAISummaryOut(**data)
            except Exception:
                pass  # corrupt row — fall through to regenerate

    # ── 2. Build context and call LLM ─────────────────────────────────────────
    context = (
        _build_full_context(snapshot, runs)
        if runs
        else _snapshot_context(snapshot)
    )

    try:
        raw = await _chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an academic performance analyst.\n"
                        "Given exam analytics data including student answers and grading feedback, "
                        "identify concrete patterns and return JSON only:\n"
                        '{"commonMisconceptions":["..."],"recommendations":["..."],"confidence":"high|medium|low"}\n'
                        "Rules:\n"
                        "- Max 3 items per list.\n"
                        "- Only use evidence from the provided data. Do not invent statistics.\n"
                        "- commonMisconceptions: specific, concrete knowledge gaps shown by low-scoring "
                        "  answers/rationale — not generic statements.\n"
                        "- recommendations: actionable teaching advice tied to specific weaknesses.\n"
                        "- confidence: 'high' if graded_count>=10, 'medium' if >=5, else 'low'."
                    ),
                },
                {"role": "user", "content": context},
            ],
            temperature=0.3,
            max_tokens=600,
            json_mode=True,
        )
        data = json.loads(raw or "{}")
        result = AnalyticsAISummaryOut(
            common_misconceptions=data.get("commonMisconceptions", [])[:3],
            recommendations=data.get("recommendations", [])[:3],
            confidence=data.get("confidence", "medium"),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

        # ── 3. Persist to DB ──────────────────────────────────────────────────
        if db is not None:
            from app.db.models.analytics import AiSummaryCache
            # Remove any stale rows for this exam (different hash = old grading data)
            db.query(AiSummaryCache).filter(
                AiSummaryCache.exam_id == snapshot.exam_id,
                AiSummaryCache.grading_hash != g_hash,
            ).delete(synchronize_session=False)
            # Upsert the new row
            db.merge(AiSummaryCache(
                exam_id=snapshot.exam_id,
                grading_hash=g_hash,
                payload=json.dumps(result.dict()),
            ))
            db.commit()
            logger.debug("AI summary written to DB for exam=%s hash=%s", snapshot.exam_id, g_hash)

        return result
    except Exception as e:
        logger.warning("AI summary failed: %s", e)
        return None


async def analytics_chat(
    snapshot: ExamAnalyticsSnapshotOut,
    message: str,
    history: list[dict[str, str]],
    grading_runs: Optional[list[GradingRunOut]] = None,
) -> str:
    """Answer a question about the analytics snapshot. Returns the reply string."""
    if not _HAS_AI:
        return (
            "AI chat is unavailable: OPENROUTER_API_KEY is not configured. "
            "All analytics data is displayed in the dashboard above."
        )

    # Use cached full context (includes student answers + rationale) when runs are available
    context = (
        _build_full_context(snapshot, grading_runs)
        if grading_runs
        else _snapshot_context(snapshot)
    )

    try:
        system_msg = {
            "role": "system",
            "content": (
                "You are an AI analytics assistant helping educators understand exam results.\n\n"
                f"EXAM ANALYTICS DATA (includes aggregated stats, student answers, and AI grading rationale):\n"
                f"{context}\n\n"
                "Instructions:\n"
                "1. Answer only using the data above. If the answer is not in the data, say so explicitly.\n"
                "2. Structure your answer: direct answer → evidence from the data → brief interpretation.\n"
                "3. Keep responses under 200 words unless the user asks for detail.\n"
                "4. When citing scores, always include the max (e.g. '4.2/10').\n"
                "5. Do not invent numbers, student names, or conclusions not supported by the data.\n"
                "6. For questions about common mistakes, cite specific student answers and grading rationale.\n"
                "7. For questions about specific students, reference them by name and ID as shown in the data."
            ),
        }
        # Keep last 8 turns of history for richer multi-turn conversations
        prior = [
            {"role": h.get("role", "user"), "content": h.get("content", "")}
            for h in history[-8:]
        ]
        messages = [system_msg, *prior, {"role": "user", "content": message}]

        return await _chat_completion(messages=messages, temperature=0.4, max_tokens=500)
    except Exception as e:
        logger.warning("Analytics chat failed: %s", e)
        return f"AI chat encountered an error: {e}"
