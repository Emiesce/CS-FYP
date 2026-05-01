"""
HKUST CSE Exam Platform – Coding Complexity Router

Uses a cheap flash model (xiaomi/mimo-v2-flash) to classify a coding question
as "simple" or "complex" before committing to a quality LLM for grading.

Simple  → grade with the cheap model (fast, low cost)
Complex → grade with the quality model pool (accurate, more expensive)

Fast-path bypasses the router entirely when:
  • question points ≤ cheap_points_threshold  (trivially simple)
  • a Python syntax error was detected         (context needed → quality)
"""

from __future__ import annotations

import logging

from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.settings import get_grading_settings

logger = logging.getLogger(__name__)

_ROUTER_SYSTEM = """\
You are a coding question complexity classifier for an exam grading system.
Given a coding question prompt, rubric, and student answer, decide whether a \
lightweight grading model is sufficient or a full quality model is required.

Respond with ONLY one word — either:
  simple   — the question/answer is short and the rubric is straightforward \
(single concept, ≤ 2 criteria, trivial logic, or clearly wrong/blank answer)
  complex  — the question requires nuanced reasoning, has intricate partial-credit \
rules, multi-step logic, NumPy/library usage, or the rubric has ≥ 3 distinct criteria

Do NOT output anything else — just the single word.
"""


async def classify_coding_complexity(
    *,
    question_prompt: str,
    rubric_text: str,
    student_answer: str,
    max_points: float,
    syntax_error: str | None,
) -> str:
    """
    Returns "simple" or "complex".

    Fast-path rules (no LLM call):
      - Syntax error present → "complex" (model needs full context to reason about it)
      - max_points ≤ threshold → "simple" (not worth routing overhead)
    """
    s = get_grading_settings()

    # Fast-path: syntax error always goes to quality model
    if syntax_error:
        logger.debug("coding_router: syntax error detected → complex")
        return "complex"

    # Fast-path: very low-point questions → cheap
    if max_points <= s.coding_cheap_points_threshold:
        logger.debug("coding_router: %.1f pts ≤ threshold → simple", max_points)
        return "simple"

    # LLM classification
    snippet = (
        f"Question ({max_points} pts):\n{question_prompt[:600]}\n\n"
        f"Rubric:\n{rubric_text[:400]}\n\n"
        f"Student answer:\n{student_answer[:400]}"
    )

    client = get_openrouter_client()
    try:
        result = await client.chat_completion(
            model=s.coding_router_model,
            messages=[
                {"role": "system", "content": _ROUTER_SYSTEM},
                {"role": "user", "content": snippet},
            ],
            temperature=0.0,
            max_tokens=8,          # we only need one word
            json_schema=None,      # plain text response
            use_cache=True,        # identical questions always route the same way
            max_retries=1,         # don't waste time retrying a routing call
        )
        decision = (result.get("content") or "").strip().lower().split()[0]
        if decision not in ("simple", "complex"):
            logger.warning("coding_router: unexpected response %r → defaulting to complex", decision)
            return "complex"
        logger.debug("coding_router: classified as %s (model=%s)", decision, s.coding_router_model)
        return decision
    except Exception as exc:
        # If the router itself fails, fall back to quality to be safe
        logger.warning("coding_router: classification failed (%s) → defaulting to complex", exc)
        return "complex"
