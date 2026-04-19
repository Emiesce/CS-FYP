"""
HKUST CSE Exam Platform – Verification Agent

Verifies grading results by checking reasoning and scoring consistency
using a separate model (DeepSeek V3.2). Runs after each question is graded.

Responsibilities (per AGENTS_3.md):
- Check schema validity
- Check total score consistency
- Verify evidence exists for non-zero scored criteria
- Flag obviously inconsistent scores vs rationale
- Suggest score adjustments if needed
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from app.models.grading_models import (
    QuestionGradeResult,
    QuestionGradingStatus,
)
from app.services.grading.llm.json_extraction import extract_json_dict
from app.services.grading.llm.openrouter_client import get_openrouter_client
from app.services.grading.settings import get_grading_settings

logger = logging.getLogger(__name__)

VERIFICATION_SYSTEM = """\
You are a grading verification assistant for the HKUST CSE Exam Platform.
Your job is to review an AI grading result and check for errors or inconsistencies.

Check for:
1. Score consistency: Does the raw_score match the sum of criterion scores? Is it within [0, max_points]?
2. Rationale alignment: Does the rationale support the assigned score? A high score with negative rationale (or vice versa) is suspicious.
3. Evidence quality: Are evidence spans present for non-trivial scored criteria?
4. Rubric adherence: Does the grading follow the rubric criteria properly?
5. Obvious errors: Hallucinated content, scores exceeding max_points, negative scores.

Return a JSON object with:
{
  "verified": true/false,
  "issues": ["list of issues found"],
  "suggested_score": null or adjusted score (number),
  "reasoning": "brief explanation of verification outcome"
}
"""

VERIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "verified": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "string"}},
        "suggested_score": {"type": ["number", "null"]},
        "reasoning": {"type": "string"},
    },
    "required": ["verified", "issues", "reasoning"],
}


async def verify_question_result(
    *,
    question_id: str,
    question_prompt: str,
    student_answer: str,
    grading_result: QuestionGradeResult,
    max_points: float,
) -> QuestionGradeResult:
    """
    Verify a single question's grading result using the verification model.
    Returns the (possibly adjusted) result.
    """
    settings = get_grading_settings()
    model = settings.verification_model
    client = get_openrouter_client()

    # Build the verification prompt
    result_summary = {
        "question_id": grading_result.question_id,
        "question_type": grading_result.question_type,
        "raw_score": grading_result.raw_score,
        "max_points": grading_result.max_points,
        "rationale": grading_result.rationale,
        "confidence": grading_result.confidence,
        "criterion_results": [
            {
                "criterion_id": cr.criterion_id,
                "criterion_label": cr.criterion_label,
                "score": cr.score,
                "max_points": cr.max_points,
                "rationale": cr.rationale,
            }
            for cr in (grading_result.criterion_results or [])
        ],
    }

    user_prompt = (
        f"## Question ({grading_result.question_type}, {max_points} points)\n"
        f"{question_prompt}\n\n"
        f"## Student Answer\n{student_answer}\n\n"
        f"## Grading Result to Verify\n{json.dumps(result_summary, indent=2)}\n\n"
        f"Verify this grading result. Check for score consistency, rationale alignment, "
        f"and obvious errors. Return your verification as JSON."
    )

    try:
        api_result = await client.chat_completion(
            model=model,
            messages=[
                {"role": "system", "content": VERIFICATION_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
            json_schema=VERIFICATION_SCHEMA,
            max_tokens=1024,
            use_cache=False,  # Don't cache verification results
        )

        verification = extract_json_dict(
            api_result["content"], context=f"verify:{question_id}"
        )

        verified = verification.get("verified", True)
        issues = verification.get("issues", [])
        suggested = verification.get("suggested_score")
        reasoning = verification.get("reasoning", "")

        if issues:
            logger.info(
                "Verification issues for %s: %s", question_id, issues
            )

        # If verification found issues and suggested a score adjustment, apply it
        if not verified and suggested is not None:
            old_score = grading_result.raw_score
            new_score = max(0, min(float(suggested), max_points))
            if abs(new_score - old_score) > 0.01:
                logger.info(
                    "Verification adjusted %s score: %.1f → %.1f (%s)",
                    question_id, old_score, new_score, reasoning,
                )
                grading_result.raw_score = new_score
                grading_result.normalized_score = (
                    new_score / max_points if max_points > 0 else 0
                )
                # Append verification note to rationale
                grading_result.rationale = (
                    grading_result.rationale
                    + f"\n\n[Verification: score adjusted from {old_score:.1f} to {new_score:.1f}. {reasoning}]"
                )

        # Mark verification notes in escalation_notes
        if issues:
            existing = grading_result.escalation_notes or ""
            issue_text = "; ".join(issues)
            grading_result.escalation_notes = (
                f"{existing}\n[Verification: {issue_text}]".strip()
            )

        return grading_result

    except Exception as e:
        # Verification failure should NOT block grading
        logger.warning(
            "Verification failed for %s (non-blocking): %s", question_id, e
        )
        return grading_result
