"""
HKUST CSE Exam Platform – Prompt Templates

Stable, reusable prompt components for grading agents.
System prompts go first (prefix-cacheable), variable content last.
"""

from __future__ import annotations

# ---- System prompt prefix (stable across all grading calls) ----------

GRADING_SYSTEM_PREFIX = """\
You are an expert academic grading assistant for the HKUST CSE Exam Platform.
Your task is to grade a student's answer to an exam question according to the provided rubric.

RULES:
1. Grade strictly according to the rubric criteria.
2. Assign a score within the allowed range for each criterion.
3. Provide a concise rationale grounded in the rubric (2-3 sentences max per criterion).
4. Identify evidence spans from the student answer that justify each criterion score.
5. Be fair, consistent, and objective.
6. Do NOT hallucinate content that is not in the student answer.
7. Return structured JSON output ONLY.
"""

EVIDENCE_SYSTEM_PREFIX = """\
You are an evidence extraction assistant. Given a student answer and grading results,
identify the exact text spans in the answer that support each criterion score.
Return structured JSON with start_index, end_index, quote, criterion_id, and reason.
"""

RUBRIC_GENERATION_SYSTEM_PREFIX = """\
You are a rubric design assistant for university-level computer science exams.
Given a question prompt, type, and point value, generate a structured grading rubric.
Each criterion must have a label, description, max points, and at least two score bands.
Ensure the total of all criteria max_points equals the question's total points.
Return structured JSON output ONLY.
"""


# ---- User prompt builders -------------------------------------------

def build_grading_user_prompt(
    *,
    question_prompt: str,
    question_type: str,
    rubric_json: str,
    student_answer: str,
    max_points: float,
    lecture_context: str | None = None,
) -> str:
    parts = [
        f"## Question ({question_type}, {max_points} points)\n{question_prompt}",
        f"## Rubric\n{rubric_json}",
    ]
    if lecture_context:
        parts.append(f"## Reference Context\n{lecture_context}")
    parts.append(f"## Student Answer\n{student_answer}")
    return "\n\n".join(parts)


def build_evidence_user_prompt(
    *,
    student_answer: str,
    grading_result_json: str,
) -> str:
    return (
        f"## Student Answer\n{student_answer}\n\n"
        f"## Grading Result\n{grading_result_json}\n\n"
        "Identify the exact text spans in the student answer that justify each criterion score."
    )


def build_rubric_generation_prompt(
    *,
    question_prompt: str,
    question_type: str,
    points: float,
    instructor_notes: str | None = None,
    support_text: str | None = None,
    model_answer: str | None = None,
) -> str:
    parts = [
        f"## Question ({question_type}, {points} points)\n{question_prompt}",
    ]
    if model_answer:
        parts.append(f"## Model Answer\n{model_answer}")
    if instructor_notes:
        parts.append(f"## Instructor Notes\n{instructor_notes}")
    if support_text:
        parts.append(f"## Support Material\n{support_text}")
    parts.append(
        "Generate a structured rubric for this question. "
        "The criteria max_points must sum exactly to the question points. "
        "If a model answer is provided, use it to produce detailed and specific "
        "score band descriptions that explain what level of quality corresponds to each band."
    )
    return "\n\n".join(parts)


# ---- JSON schemas for structured output ------------------------------

GRADING_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "raw_score": {"type": "number"},
        "normalized_score": {"type": "number"},
        "rationale": {"type": "string"},
        "criterion_results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "criterion_id": {"type": "string"},
                    "criterion_label": {"type": "string"},
                    "score": {"type": "number"},
                    "max_points": {"type": "number"},
                    "rationale": {"type": "string"},
                    "evidence_spans": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "start_index": {"type": "integer"},
                                "end_index": {"type": "integer"},
                                "quote": {"type": "string"},
                                "criterion_id": {"type": "string"},
                                "reason": {"type": "string"},
                            },
                            "required": ["start_index", "end_index", "quote", "criterion_id", "reason"],
                        },
                    },
                },
                "required": ["criterion_id", "criterion_label", "score", "max_points", "rationale", "evidence_spans"],
            },
        },
    },
    "required": ["raw_score", "normalized_score", "rationale", "criterion_results"],
}

RUBRIC_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "criteria": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "label": {"type": "string"},
                    "description": {"type": "string"},
                    "max_points": {"type": "number"},
                    "score_bands": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string"},
                                "min_points": {"type": "number"},
                                "max_points": {"type": "number"},
                                "description": {"type": "string"},
                            },
                            "required": ["label", "min_points", "max_points", "description"],
                        },
                    },
                },
                "required": ["id", "label", "description", "max_points", "score_bands"],
            },
        },
        "total_points": {"type": "number"},
    },
    "required": ["criteria", "total_points"],
}

EVIDENCE_OUTPUT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "evidence_spans": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "start_index": {"type": "integer"},
                    "end_index": {"type": "integer"},
                    "quote": {"type": "string"},
                    "criterion_id": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["start_index", "end_index", "quote", "criterion_id", "reason"],
            },
        },
    },
    "required": ["evidence_spans"],
}
