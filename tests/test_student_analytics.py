import math

import pytest


def test_compute_student_exam_score_sums_and_percentage(mocker, dummy_db):
    from services import student_analytics as sa

    mocker.patch.object(
        sa,
        "get_grades_by_student_exam",
        return_value=[
            {"score": 2, "maxScore": 4, "topicId": "t1"},
            {"score": 3, "maxScore": 6, "topicId": "t1"},
        ],
    )

    out = sa.compute_student_exam_score(dummy_db, exam_id="exam1", student_id="stu1")

    assert out["studentId"] == "stu1"
    assert out["totalScore"] == 5
    assert out["percentage"] == 5 / 10


def test_compute_student_exam_score_zero_max_gives_zero(mocker, dummy_db):
    from services import student_analytics as sa

    mocker.patch.object(
        sa,
        "get_grades_by_student_exam",
        return_value=[
            {"score": 2, "maxScore": 0, "topicId": "t1"},
            {"score": 3, "maxScore": 0, "topicId": "t2"},
        ],
    )

    out = sa.compute_student_exam_score(dummy_db, exam_id="exam1", student_id="stu1")
    assert out["totalScore"] == 5
    assert out["percentage"] == 0.0


def test_compute_student_position_std_zero(mocker):
    from services import student_analytics as sa

    out = sa.compute_student_position(student_score=0.75, class_avg=0.6, class_std=0)

    assert out["zScore"] == 0
    assert out["classAverage"] == 0.6
    assert out["deltaFromAverage"] == pytest.approx(0.15)
    assert out["performanceBand"] == "Average"
    assert out["percentileRank"] == pytest.approx(0.5)


def test_compute_student_position_nonzero_std_percentile_matches_erf():
    from services import student_analytics as sa

    out = sa.compute_student_position(student_score=0.9, class_avg=0.7, class_std=0.1)
    expected_z = (0.9 - 0.7) / 0.1
    expected_pct = 0.5 * (1 + math.erf(expected_z / math.sqrt(2)))

    assert out["zScore"] == pytest.approx(expected_z)
    assert out["percentileRank"] == pytest.approx(expected_pct)
    assert out["performanceBand"] == "Above average"


def test_compute_student_topic_performance_groups_by_topic_and_rounds(mocker, dummy_db):
    from services import student_analytics as sa

    mocker.patch.object(
        sa,
        "get_grades_by_student_exam",
        return_value=[
            {"score": 3, "maxScore": 4, "topicId": "t1"},
            {"score": 2, "maxScore": 4, "topicId": "t1"},
            {"score": 1, "maxScore": 2, "topicId": "t2"},
        ],
    )

    def fake_topic_class_score(_db, _exam_id, topic_id):
        # t1: student 5/8=0.625 vs class 0.5 => delta 0.125 => Strong
        # t2: student 1/2=0.5 vs class 0.61 => delta -0.11 => Needs improvement
        return {"aggregateScore": {"t1": 0.5, "t2": 0.61}[topic_id]}

    mocker.patch.object(sa, "compute_topic_class_score", side_effect=fake_topic_class_score)

    out = sa.compute_student_topic_performance(dummy_db, exam_id="exam1", student_id="stu1")

    out_by_topic = {r["topicId"]: r for r in out}
    assert set(out_by_topic.keys()) == {"t1", "t2"}

    assert out_by_topic["t1"] == {
        "topicId": "t1",
        "studentScore": 0.62,
        "classAverage": 0.5,
        "difference": 0.12,
        "status": "Strong",
    }
    assert out_by_topic["t2"] == {
        "topicId": "t2",
        "studentScore": 0.5,
        "classAverage": 0.61,
        "difference": -0.11,
        "status": "Needs improvement",
    }


def test_compute_student_analytics_wires_subcomponents(mocker, dummy_db):
    from services import student_analytics as sa

    mocker.patch.object(sa, "compute_student_exam_score", return_value={"studentId": "s1", "totalScore": 10, "percentage": 0.8})
    mocker.patch.object(sa, "compute_exam_score_distribution", return_value={"averageScore": 0.6, "stdDeviation": 0.2})
    mocker.patch.object(sa, "compute_student_topic_performance", return_value=[{"topicId": "t1"}])

    out = sa.compute_student_analytics(dummy_db, exam_id="e1", student_id="s1")

    assert out["examPerformance"]["percentage"] == 0.8
    assert out["classPosition"]["classAverage"] == 0.6
    assert out["topicPerformance"] == [{"topicId": "t1"}]
