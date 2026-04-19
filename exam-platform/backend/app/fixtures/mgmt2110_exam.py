"""
MGMT2110 Essay Grading Test Fixture

Builds an essay-only exam definition and structured rubric from the
user-provided rubric JSON so the grading sandbox can exercise the
long-answer / essay path on a realistic dataset.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from app.models.exam_models import (
    EssayQuestionData,
    ExamDefinitionOut,
    ExamQuestionIn,
    QuestionRubric,
)
from app.models.grading_models import (
    RubricCriterion,
    RubricScoreBand,
    StructuredRubric,
)

EXAM_ID = "mgmt2110-ob-essay-test-s26"
QUESTION_ID = "q1"

_WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
_EXAM_PLATFORM_ROOT = Path(__file__).resolve().parents[3]
_RUBRIC_PATH = _WORKSPACE_ROOT / "mgmtrubric.json"
_ANSWERS_PATH = _EXAM_PLATFORM_ROOT / "mgmtAns.json"
ESSAY_PROMPT = (
    "Explain the psychology factor of planning fallacy. Discuss the "
    "Inside-Outside Model, relevant biases and attribution, motivated "
    "reasoning, and support your explanation with examples or evidence."
)


def _load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _load_rubric_payload() -> dict:
    payload = _load_json(_RUBRIC_PATH)
    if not isinstance(payload, dict):
        raise ValueError("MGMT2110 rubric JSON must be an object.")
    return payload


def load_answer_dataset() -> list[dict]:
    payload = _load_json(_ANSWERS_PATH)
    if not isinstance(payload, list):
        raise ValueError("MGMT2110 answer JSON must be an array.")
    return payload


def _build_question_rubric_text(criteria: list[dict]) -> str:
    lines = ["Criteria:"]
    for index, criterion in enumerate(criteria, start=1):
        name = str(criterion.get("name", f"Criterion {index}")).strip()
        bands = criterion.get("scoreLevels", [])
        top_band = bands[0]["description"] if bands else ""
        lines.append(f"{index}. {name}: {top_band}")
    return "\n".join(lines)


def build_mgmt2110_exam() -> ExamDefinitionOut:
    payload = _load_rubric_payload()
    question = payload["questions"][0]
    criteria = question.get("criteria", [])
    now = datetime.utcnow()

    return ExamDefinitionOut(
        id=EXAM_ID,
        course_code="MGMT2110",
        course_name="Organizationl Behaviour",
        title="Essay Grading Test Module",
        date="2026-04-17",
        start_time="12:00",
        duration_seconds=5400,
        location="Take-home Dataset",
        instructions=(
            "This exam has already been completed. Grade the seeded essay "
            "responses using the supplied management rubric."
        ),
        questions=[
            ExamQuestionIn(
                id=QUESTION_ID,
                order=1,
                title=question.get("title", "Management Essay"),
                prompt=ESSAY_PROMPT,
                points=float(question.get("maxScore", 20)),
                type_data=EssayQuestionData(
                    type="essay",
                    expected_length_hint="400-700 words",
                ),
                rubric=QuestionRubric(
                    text=_build_question_rubric_text(criteria),
                ),
            )
        ],
        total_points=float(question.get("maxScore", 20)),
        created_at=now,
        updated_at=now,
    )


def build_mgmt2110_rubrics() -> dict[str, StructuredRubric]:
    payload = _load_rubric_payload()
    question = payload["questions"][0]
    criteria = question.get("criteria", [])
    question_total = float(question.get("maxScore", 20))

    # The uploaded rubric defines four criteria with 0-10 bands each even
    # though the overall question total is 20. Scale the rubric so the
    # structured version remains internally consistent for the grader.
    raw_total = sum(
        max(
            (float(level.get("maxPoints", 0)) for level in criterion.get("scoreLevels", [])),
            default=0.0,
        )
        for criterion in criteria
    )
    scale = question_total / raw_total if raw_total > 0 else 1.0

    rubric_criteria: list[RubricCriterion] = []
    for index, criterion in enumerate(criteria, start=1):
        score_levels = criterion.get("scoreLevels", [])
        criterion_max = max(
            (float(level.get("maxPoints", 0)) for level in score_levels),
            default=0.0,
        ) * scale

        rubric_criteria.append(
            RubricCriterion(
                id=f"mgmt-criterion-{index}",
                label=str(criterion.get("name", f"Criterion {index}")).strip(),
                description=" ".join(
                    str(level.get("description", "")).strip()
                    for level in score_levels
                    if str(level.get("description", "")).strip()
                ),
                max_points=round(criterion_max, 2),
                score_bands=[
                    RubricScoreBand(
                        label=str(level.get("scoreRange", "")).strip() or f"Band {band_index}",
                        min_points=round(float(level.get("minPoints", 0)) * scale, 2),
                        max_points=round(float(level.get("maxPoints", 0)) * scale, 2),
                        description=str(level.get("description", "")).strip(),
                    )
                    for band_index, level in enumerate(score_levels, start=1)
                ],
            )
        )

    total_points = round(sum(criterion.max_points for criterion in rubric_criteria), 2)
    if total_points != question_total and total_points > 0:
        delta = round(question_total - total_points, 2)
        rubric_criteria[-1].max_points = round(rubric_criteria[-1].max_points + delta, 2)
        total_points = question_total

    return {
        QUESTION_ID: StructuredRubric(
            question_id=QUESTION_ID,
            criteria=rubric_criteria,
            total_points=question_total,
        )
    }
