import pytest


def test_summarize_clusters_parses_llm_response_and_counts(ai_service, mocker):
    ai_service.llm.chat.return_value = "\n".join(
        [
            "Cluster 0: Misconception A",
            "Cluster 1: Misconception B",
        ]
    )

    feedback_objects = [
        {"feedback": "f0"},
        {"feedback": "f1"},
        {"feedback": "f2"},
    ]
    labels = [0, 1, 1]

    out = ai_service.summarize_clusters(feedback_objects, labels)

    assert out == [
        {"summary": "Misconception A", "count": 1},
        {"summary": "Misconception B", "count": 2},
    ]
    ai_service.llm.chat.assert_called_once()


def test_summarize_clusters_llm_error_returns_empty_list(ai_service):
    ai_service.llm.chat.side_effect = RuntimeError("rate limit")
    out = ai_service.summarize_clusters([{"feedback": "x"}], [0])
    assert out == []


def test_question_analysis_sets_empty_misconceptions_when_no_feedback(ai_service, mocker, dummy_db):
    import services.ai_services as mod

    mocker.patch.object(
        mod,
        "compute_question_results",
        return_value=[
            {"questionId": 1, "feedbacks": []},
        ],
    )
    embed = mocker.patch.object(mod, "embed_feedbacks")
    cluster = mocker.patch.object(mod, "cluster_feedbacks")
    summarize = mocker.patch.object(ai_service, "summarize_clusters")

    out = ai_service.question_analysis(dummy_db, exam_id=123, k_clusters=3)

    assert out == [{"questionId": 1, "feedbacks": [], "misconceptions": []}]
    embed.assert_not_called()
    cluster.assert_not_called()
    summarize.assert_not_called()


def test_question_analysis_limits_k_to_number_of_feedbacks(ai_service, mocker, dummy_db):
    import services.ai_services as mod

    mocker.patch.object(
        mod,
        "compute_question_results",
        return_value=[
            {"questionId": 1, "feedbacks": ["a", "b"]},
        ],
    )
    mocker.patch.object(mod, "embed_feedbacks", return_value=[[0.1], [0.2]])
    cluster = mocker.patch.object(mod, "cluster_feedbacks", return_value=[0, 1])
    mocker.patch.object(ai_service, "summarize_clusters", return_value=[{"summary": "s", "count": 2}])

    out = ai_service.question_analysis(dummy_db, exam_id=123, k_clusters=99)

    # k should be min(k_clusters, len(feedbacks)) = 2
    cluster.assert_called_once()
    assert cluster.call_args.kwargs["k"] == 2
    assert out[0]["misconceptions"] == [{"summary": "s", "count": 2}]


def test_topic_analysis_calls_llm_only_when_misconceptions_present(ai_service, mocker, dummy_db):
    import services.ai_services as mod

    mocker.patch.object(
        mod,
        "aggregate_topic_misconceptions",
        return_value={
            "T1": [
                {"questionId": 1, "summary": "m1", "count": 2},
            ],
            "T2": [],
        },
    )
    mocker.patch.object(mod, "compute_topic_scores", return_value=[{"topicId": "T1"}, {"topicId": "T2"}])
    mocker.patch.object(
        mod,
        "rank_topics",
        return_value=[
            {"topicId": "T1", "averagePercentage": 40.0, "rank": 1},
            {"topicId": "T2", "averagePercentage": 80.0, "rank": 2},
        ],
    )
    summarize_topic = mocker.patch.object(ai_service, "summarize_topic_misconceptions", return_value="TOPIC_SUMMARY")

    out = ai_service.topic_analysis(dummy_db, exam_id=123, question_results=[{"questionId": 1}])

    assert len(out) == 2
    t1 = next(t for t in out if t["topicId"] == "T1")
    t2 = next(t for t in out if t["topicId"] == "T2")

    assert t1["summary"] == "TOPIC_SUMMARY"
    assert t1["averagePercentage"] == 40.0
    assert t2["summary"] is None

    summarize_topic.assert_called_once_with("T1", mocker.ANY, 40.0)


def test_exam_summary_analysis_parses_common_and_recommendations(ai_service):
    ai_service.llm.chat.return_value = "\n".join(
        [
            "### Common Misconceptions",
            "Students confuse X with Y.",
            "### Recommendations",
            "Re-teach concept Z.",
        ]
    )

    out = ai_service.exam_summary_analysis(
        topic_results=[
            {"topicId": "T1", "averagePercentage": 40, "summary": "something"},
        ]
    )

    assert out == {
        "commonMisconceptions": "Students confuse X with Y.",
        "recommendations": "Re-teach concept Z.",
    }


def test_full_exam_analysis_caches_result(ai_service, mocker, dummy_db):
    question_analysis = mocker.patch.object(ai_service, "question_analysis", return_value=[{"questionId": 1}])
    topic_analysis = mocker.patch.object(ai_service, "topic_analysis", return_value=[{"topicId": "T1"}])
    exam_summary_analysis = mocker.patch.object(
        ai_service, "exam_summary_analysis", return_value={"commonMisconceptions": "c", "recommendations": "r"}
    )

    r1 = ai_service.full_exam_analysis(dummy_db, exam_id=1)
    r2 = ai_service.full_exam_analysis(dummy_db, exam_id=1)

    assert r1 == r2
    question_analysis.assert_called_once()
    topic_analysis.assert_called_once()
    exam_summary_analysis.assert_called_once()


def test_chat_about_exam_uses_cached_analysis_and_strips_response(ai_service, mocker, dummy_db):
    import services.ai_services as mod

    ai_service._exam_cache[99] = {"questions": [], "topics": [], "examSummary": {}}
    mocker.patch.object(mod, "compute_exam_score_distribution", return_value={"bins": []})

    ai_service.llm.chat.return_value = "  hello  "
    out = ai_service.chat_about_exam(dummy_db, exam_id=99, user_message="hi")
    assert out == "hello"

