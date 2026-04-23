import pytest


def test_compute_exam_score_distribution_none_when_no_grades(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(cas, "get_grades_by_exam", return_value=[])

    assert cas.compute_exam_score_distribution(dummy_db, exam_id="e1") is None


def test_compute_exam_score_distribution_groups_by_student_and_calls_statistics(mocker, dummy_db):
    from services import class_analytics_services as cas

    # Two students, each with multiple rows; percentages should be:
    # s1: (2+1)/(4+1)=0.6, s2: (3)/(6)=0.5
    mocker.patch.object(
        cas,
        "get_grades_by_exam",
        return_value=[
            {"studentId": "s1", "score": 2, "maxScore": 4},
            {"studentId": "s1", "score": 1, "maxScore": 1},
            {"studentId": "s2", "score": 3, "maxScore": 6},
        ],
    )

    seen = {}

    def fake_stats(percentages):
        seen["percentages"] = list(percentages)
        return {"ok": True}

    mocker.patch.object(cas, "compute_class_statistics", side_effect=fake_stats)

    out = cas.compute_exam_score_distribution(dummy_db, exam_id="e1")

    assert out == {"ok": True}
    assert sorted(seen["percentages"]) == pytest.approx(sorted([0.6, 0.5]))


def test_compute_topic_class_score_none_when_no_grades(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(cas, "get_grades_by_exam_topic", return_value=[])

    assert cas.compute_topic_class_score(dummy_db, exam_id="e1", topic_id="t1") is None


def test_compute_topic_class_score_aggregates_score_fraction(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(
        cas,
        "get_grades_by_exam_topic",
        return_value=[
            {"score": 3, "maxScore": 4},
            {"score": 1, "maxScore": 2},
        ],
    )

    out = cas.compute_topic_class_score(dummy_db, exam_id="e1", topic_id="t1")

    assert out["topicId"] == "t1"
    assert out["aggregateScore"] == pytest.approx(4 / 6)


def test_compute_completion_time_none_when_no_exam_info(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(cas, "get_exam_info_by_exam", return_value=[])

    assert cas.compute_completion_time(dummy_db, exam_id="e1") is None


def test_compute_completion_time_returns_mean_and_histogram_counts(mocker, dummy_db):
    from services import class_analytics_services as cas

    rows = [
        {"totalDuration": 10},
        {"totalDuration": 20},
        {"totalDuration": 30},
        {"totalDuration": 40},
        {"totalDuration": 50},
    ]
    mocker.patch.object(cas, "get_exam_info_by_exam", return_value=rows)

    out = cas.compute_completion_time(dummy_db, exam_id="e1")

    assert out["avgCompletionTime"] == pytest.approx(30.0)
    assert isinstance(out["completionTimeDistribution"], list)
    assert len(out["completionTimeDistribution"]) == 5
    assert sum(out["completionTimeDistribution"]) == len(rows)


def test_compute_question_class_score_none_when_no_grades(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(cas, "get_grades_by_exam_question", return_value=[])

    assert cas.compute_question_class_score(dummy_db, exam_id="e1", question_id="q1") is None


def test_compute_question_class_score_counts_common_wrong_answers_sorted(mocker, dummy_db):
    from services import class_analytics_services as cas

    # 4 answers total, 3 wrong (score < maxScore)
    mocker.patch.object(
        cas,
        "get_grades_by_exam_question",
        return_value=[
            {"score": 0, "maxScore": 1, "answer": "A", "topicId": "t1"},
            {"score": 0, "maxScore": 1, "answer": "B", "topicId": "t1"},
            {"score": 0, "maxScore": 1, "answer": "B", "topicId": "t1"},
            {"score": 1, "maxScore": 1, "answer": "C", "topicId": "t1"},  # correct
        ],
    )

    out = cas.compute_question_class_score(dummy_db, exam_id="e1", question_id="q1")

    assert out["questionId"] == "q1"
    assert out["topicId"] == "t1"
    assert out["aggregateScore"] == pytest.approx(25.0)
    assert out["commonWrongAnswers"] == [
        {"answer": "B", "count": 2, "percentage": 0.5},
        {"answer": "A", "count": 1, "percentage": 0.25},
    ]


def test_compute_question_results_groups_questions_computes_scores_and_feedbacks(mocker, dummy_db):
    from services import class_analytics_services as cas

    mocker.patch.object(
        cas,
        "get_grades_by_exam",
        return_value=[
            # q1 / t1: 1/2 and 2/2 => aggregate 3/4=0.75
            {"questionId": "q1", "topicId": "t1", "score": 1, "maxScore": 2, "feedback": "confused"},
            {"questionId": "q1", "topicId": "t1", "score": 2, "maxScore": 2, "feedback": None},
            # q2 / t2: 0/1 => aggregate 0
            {"questionId": "q2", "topicId": "t2", "score": 0, "maxScore": 1, "feedback": ""},
        ],
    )

    out = cas.compute_question_results(dummy_db, exam_id="exam-1", num_bins=4)
    out_by_q = {(r["questionId"], r["topicId"]): r for r in out}

    assert set(out_by_q.keys()) == {("q1", "t1"), ("q2", "t2")}

    q1 = out_by_q[("q1", "t1")]
    assert q1["examId"] == "exam-1"
    assert q1["aggregateScore"] == pytest.approx(0.75)
    assert q1["successRate"] == 75.0
    assert isinstance(q1["scoreDistribution"], list)
    assert len(q1["scoreDistribution"]) == 4
    assert sum(q1["scoreDistribution"]) == 2
    assert q1["feedbacks"] == ["confused"]

    q2 = out_by_q[("q2", "t2")]
    assert q2["aggregateScore"] == 0.0
    assert q2["successRate"] == 0.0
    assert sum(q2["scoreDistribution"]) == 1
    assert q2["feedbacks"] == []

