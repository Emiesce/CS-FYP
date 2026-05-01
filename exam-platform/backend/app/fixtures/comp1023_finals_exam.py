"""
COMP1023 Final Examination – Fixture Data

Builds the COMP1023 Finals exam definition from the bundled JSON file.
Used by the seed script to populate the database with a finished examination.
"""

from __future__ import annotations

import json
import os
from datetime import datetime

from app.models.exam_models import (
    CodingQuestionData,
    ExamDefinitionOut,
    ExamQuestionIn,
    LongAnswerQuestionData,
    McqOption,
    McqQuestionData,
    QuestionRubric,
    ShortAnswerQuestionData,
)
from app.models.grading_models import RubricCriterion, StructuredRubric

EXAM_ID = "comp1023-finals-f25"

# Path to the JSON source (relative to this file, two levels up to exam-platform root)
_JSON_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",  # app/
    "..",  # backend/
    "..",  # exam-platform/
    "comp1023finals.json",
)


_ID_PREFIX = "finals-"


def _build_question(raw: dict) -> ExamQuestionIn:
    """Convert a raw JSON question dict into an ExamQuestionIn model."""
    td = raw["type_data"]
    q_type = td["type"]

    if q_type == "mcq":
        type_data = McqQuestionData(
            type="mcq",
            options=[
                McqOption(id=opt["id"], label=opt["label"], is_correct=opt["is_correct"])
                for opt in td["options"]
            ],
            allow_multiple=td.get("allow_multiple", False),
        )
    elif q_type == "short_answer":
        type_data = ShortAnswerQuestionData(
            type="short_answer",
            max_length=td.get("max_length"),
            placeholder=td.get("placeholder"),
        )
    elif q_type == "long_answer":
        type_data = LongAnswerQuestionData(
            type="long_answer",
            expected_length_hint=td.get("expected_length_hint"),
        )
    elif q_type == "coding":
        type_data = CodingQuestionData(
            type="coding",
            language=td.get("language", "python"),
            starter_code=td.get("starter_code", ""),
            constraints=td.get("constraints"),
        )
    else:
        raise ValueError(f"Unsupported question type: {q_type!r}")

    rubric_raw = raw.get("rubric")
    rubric = QuestionRubric(text=rubric_raw["text"]) if rubric_raw else None

    return ExamQuestionIn(
        id=_ID_PREFIX + raw["id"],
        order=raw["order"],
        title=raw.get("title", ""),
        prompt=raw.get("prompt", ""),
        points=float(raw["points"]),
        required=raw.get("required", True),
        rubric=rubric,
        type_data=type_data,
        topic_ids=raw.get("topic_ids", []),
    )


def build_comp1023_finals_exam() -> ExamDefinitionOut:
    """Return a fully-populated ExamDefinitionOut for the COMP1023 Finals."""
    json_path = os.path.normpath(_JSON_PATH)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = [_build_question(q) for q in data["questions"]]
    total_points = sum(q.points for q in questions)

    now = datetime.utcnow()
    return ExamDefinitionOut(
        id=EXAM_ID,
        course_code=data["course_code"],
        course_name=data["course_name"],
        title=data["title"],
        date=data["date"],
        start_time=data["start_time"],
        duration_seconds=data["duration_seconds"],
        location=data["location"],
        instructions=data["instructions"],
        questions=questions,
        total_points=total_points,
        created_at=now,
        updated_at=now,
    )


def build_comp1023_finals_rubrics() -> dict[str, StructuredRubric]:
    """Build structured rubrics for all COMP1023 Finals questions from the JSON rubric text."""
    json_path = os.path.normpath(_JSON_PATH)
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rubrics: dict[str, StructuredRubric] = {}
    for raw in data["questions"]:
        qid = _ID_PREFIX + raw["id"]
        rubric_raw = raw.get("rubric")
        if not rubric_raw:
            continue
        rubric_text = rubric_raw.get("text", "")
        points = float(raw["points"])
        rubrics[qid] = StructuredRubric(
            question_id=qid,
            criteria=[
                RubricCriterion(
                    id="correctness",
                    label="Correctness",
                    description=rubric_text,
                    max_points=points,
                )
            ],
            total_points=points,
        )
    return rubrics
