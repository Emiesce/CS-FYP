import pytest


from services.exam_summary import (
    extract_exam_misconceptions,
    rank_topics_by_score,
    summarize_exam,
)


def test_rank_topics_by_score_sorts_ascending_and_defaults_missing_score_to_zero():
    topics = [
        {"topicId": "t1", "averageScore": 50},
        {"topicId": "t2"},  # defaults to 0
        {"topicId": "t3", "averageScore": 10},
        {"topicId": "t4", "averageScore": -5},
    ]

    ranked = rank_topics_by_score(topics)

    assert [t["topicId"] for t in ranked] == ["t4", "t2", "t3", "t1"]


def test_extract_exam_misconceptions_flattens_and_keeps_optional_severity():
    topic_summaries = [
        {
            "topicId": "algebra",
            "keyMisconceptions": [
                {"label": "sign errors", "severity": "high"},
                {"label": "order of operations"},
            ],
        },
        {"topicId": "geometry", "keyMisconceptions": []},
        {
            "topicId": "calculus",
            "keyMisconceptions": [{"label": "derivative meaning", "severity": None}],
        },
    ]

    misconceptions = extract_exam_misconceptions(topic_summaries)

    assert misconceptions == [
        {"topicId": "algebra", "label": "sign errors", "severity": "high"},
        {"topicId": "algebra", "label": "order of operations", "severity": None},
        {"topicId": "calculus", "label": "derivative meaning", "severity": None},
    ]


def test_summarize_exam_returns_none_when_no_topics(mocker):
    llm = mocker.Mock()

    assert summarize_exam("exam-1", [], llm) is None
    llm.summarize.assert_not_called()


def test_summarize_exam_calls_llm_with_expected_payload(mocker):
    llm = mocker.Mock()
    llm.summarize.return_value = {"summary": "ok"}

    topic_summaries = [
        {
            "topicId": "tA",
            "averageScore": 80,
            "keyMisconceptions": [{"label": "m1", "severity": "low"}],
        },
        {
            "topicId": "tB",
            "averageScore": 20,
            "keyMisconceptions": [{"label": "m2"}],
        },
        {"topicId": "tC", "averageScore": 50, "keyMisconceptions": []},
        {"topicId": "tD", "averageScore": 10, "keyMisconceptions": [{"label": "m3"}]},
    ]

    result = summarize_exam("exam-42", topic_summaries, llm)

    assert result == {"summary": "ok"}
    llm.summarize.assert_called_once()

    (payload,), _kwargs = llm.summarize.call_args

    assert payload["task"] == "Summarize exam-level performance and misconceptions"
    assert payload["examId"] == "exam-42"
    assert payload["topics"] == topic_summaries

    # Weakest topics are the lowest scores, first 3.
    assert [t["topicId"] for t in payload["weakestTopics"]] == ["tD", "tB", "tC"]

    assert payload["misconceptions"] == [
        {"topicId": "tA", "label": "m1", "severity": "low"},
        {"topicId": "tB", "label": "m2", "severity": None},
        {"topicId": "tD", "label": "m3", "severity": None},
    ]

    assert payload["instructions"] == [
        "Identify recurring misconceptions across topics",
        "Highlight 3 weakest and strongest topics based on averageScore",
        "Detect systemic conceptual issues",
        "Provide high-level instructional recommendations",
    ]

