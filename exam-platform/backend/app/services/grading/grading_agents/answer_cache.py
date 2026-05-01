"""
HKUST CSE Exam Platform – Short-Answer Similarity Cache

Cross-student in-memory cache keyed by (question_id, normalised_answer).
When two students give essentially the same short answer, the second grading
call is skipped and the cached QuestionGradeResult is cloned with the new
student's answer text.

The normalisation is deliberately aggressive (lowercase, collapse whitespace,
strip punctuation) so that trivial variations ("yes", "Yes.", "YES") all hit
the same cache entry.

Thread/async safety: the cache is a plain dict. Because CPython's GIL ensures
dict reads/writes are atomic at the bytecode level, and our grading is
async (single-threaded event loop), no lock is needed.
"""

from __future__ import annotations

import copy
import logging
import re
import unicodedata
from typing import Optional

from app.models.grading_models import QuestionGradeResult, GradingLane, QuestionGradingStatus

logger = logging.getLogger(__name__)

# Module-level cache:  (question_id, normalised_answer) → QuestionGradeResult
_answer_cache: dict[tuple[str, str], QuestionGradeResult] = {}


def _normalise(text: str) -> str:
    """Aggressive normalisation for cache-key matching."""
    # Unicode NFC + remove accents
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    # Lowercase, strip punctuation, collapse whitespace
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_cached_result(question_id: str, student_answer: str) -> Optional[QuestionGradeResult]:
    """Return a cached grading result for this (question, answer) pair, or None."""
    key = (question_id, _normalise(student_answer))
    cached = _answer_cache.get(key)
    if cached is None:
        return None
    logger.info(
        "Answer similarity cache HIT for question %s — reusing prior grading result (skipping LLM call)",
        question_id,
    )
    # Deep-copy so callers can mutate (e.g. set question_id, student_answer)
    clone = copy.deepcopy(cached)
    clone.student_answer = student_answer
    return clone


def cache_result(question_id: str, student_answer: str, result: QuestionGradeResult) -> None:
    """Store a grading result in the cache (only for successfully graded results)."""
    # Only cache clean graded results — not escalated / incomplete / failed
    if result.status not in (
        QuestionGradingStatus.GRADED,
        QuestionGradingStatus.REVIEWED,
    ):
        return
    key = (question_id, _normalise(student_answer))
    if key not in _answer_cache:
        logger.info(
            "Answer similarity cache STORE for question %s — result cached for future students",
            question_id,
        )
        _answer_cache[key] = copy.deepcopy(result)


def clear_cache(question_id: Optional[str] = None) -> int:
    """Clear cache entries. If question_id given, clear only that question."""
    global _answer_cache
    if question_id is None:
        count = len(_answer_cache)
        _answer_cache = {}
        return count
    removed = [k for k in _answer_cache if k[0] == question_id]
    for k in removed:
        del _answer_cache[k]
    return len(removed)


def cache_stats() -> dict:
    """Return cache statistics for observability."""
    by_question: dict[str, int] = {}
    for qid, _ in _answer_cache:
        by_question[qid] = by_question.get(qid, 0) + 1
    return {"total_entries": len(_answer_cache), "by_question": by_question}
