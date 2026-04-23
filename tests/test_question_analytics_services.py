def test_prepare_feedbacks_filters_only_incorrect_with_feedback(import_question_analytics_services):
    qas, _ = import_question_analytics_services

    grades = [
        {"studentId": 1, "score": 0, "maxScore": 5, "feedback": "I thought X meant Y"},
        {"studentId": 2, "score": 5, "maxScore": 5, "feedback": "Perfect"},  # correct
        {"studentId": 3, "score": 1, "maxScore": 5, "feedback": ""},  # empty feedback
        {"studentId": 4, "score": 1, "maxScore": 5, "feedback": None},  # None feedback
    ]

    assert qas.prepare_feedbacks(grades) == [
        {"studentId": 1, "feedback": "I thought X meant Y"},
    ]


def test_embed_feedbacks_calls_model_encode_with_texts(import_question_analytics_services):
    qas, fake_model = import_question_analytics_services
    fake_model.encode.return_value = [[0.1, 0.2], [0.3, 0.4]]

    feedbacks = [
        {"studentId": 1, "feedback": "alpha"},
        {"studentId": 2, "feedback": "beta"},
    ]

    embeddings = qas.embed_feedbacks(feedbacks)

    fake_model.encode.assert_called_once_with(["alpha", "beta"])
    assert embeddings == [[0.1, 0.2], [0.3, 0.4]]


def test_cluster_feedbacks_n_samples_zero_or_one_returns_single_cluster(import_question_analytics_services):
    qas, _ = import_question_analytics_services

    assert qas.cluster_feedbacks([], k=3) == []
    assert qas.cluster_feedbacks([[1.0, 2.0]], k=3) == [0]


def test_cluster_feedbacks_caps_k_to_n_samples_and_converts_labels_to_int(mocker, import_question_analytics_services):
    qas, _ = import_question_analytics_services

    created = {}

    class FakeKMeans:
        def __init__(self, n_clusters, random_state, n_init):
            created["n_clusters"] = n_clusters
            created["random_state"] = random_state
            created["n_init"] = n_init

        def fit_predict(self, _embeddings):
            # return numpy-ish scalar types (or strings) to ensure int() conversion is exercised
            return [1, 0, 1]

    mocker.patch.object(qas, "KMeans", FakeKMeans)

    embeddings = [[0.0], [1.0], [2.0]]
    labels = qas.cluster_feedbacks(embeddings, k=999)

    assert created["n_clusters"] == 3
    assert created["random_state"] == 42
    assert created["n_init"] == 10
    assert labels == [1, 0, 1]
    assert all(isinstance(x, int) for x in labels)


def test_compute_topic_scores_rounds_and_handles_zero_max(mocker, import_question_analytics_services):
    qas, _ = import_question_analytics_services

    mocker.patch.object(
        qas,
        "get_aggregated_topic_scores_by_exam",
        return_value=[
            {"topicId": "t1", "totalScore": 5, "totalMaxScore": 10},
            {"topicId": "t2", "totalScore": 0, "totalMaxScore": 0},  # division by zero guard
            {"topicId": "t3", "totalScore": 1, "totalMaxScore": 3},
        ],
    )

    result = qas.compute_topic_scores(db=mocker.Mock(), exam_id="exam-1")

    assert result == [
        {"topicId": "t1", "totalScore": 5, "totalMaxScore": 10, "averagePercentage": 50.0},
        {"topicId": "t2", "totalScore": 0, "totalMaxScore": 0, "averagePercentage": 0},
        {"topicId": "t3", "totalScore": 1, "totalMaxScore": 3, "averagePercentage": 33.33},
    ]


def test_rank_topics_sorts_ascending_and_assigns_rank_in_order(import_question_analytics_services):
    qas, _ = import_question_analytics_services

    topics = [
        {"topicId": "t2", "averagePercentage": 90.0},
        {"topicId": "t1", "averagePercentage": 10.0},
        {"topicId": "t3", "averagePercentage": 50.0},
    ]

    ranked = qas.rank_topics(topics)

    assert [t["topicId"] for t in ranked] == ["t1", "t3", "t2"]
    assert [t["rank"] for t in ranked] == [1, 2, 3]


def test_aggregate_topic_misconceptions_groups_by_topic_and_flattens(import_question_analytics_services):
    qas, _ = import_question_analytics_services

    question_results = [
        {
            "questionId": "q1",
            "topicId": "t1",
            "misconceptions": [
                {"summary": "mis-1", "count": 2},
                {"summary": "mis-2", "count": 1},
            ],
        },
        {
            "questionId": "q2",
            "topicId": "t1",
            "misconceptions": [
                {"summary": "mis-3", "count": 5},
            ],
        },
        {
            "questionId": "q3",
            "topicId": "t2",
            "misconceptions": [],
        },
    ]

    topic_map = qas.aggregate_topic_misconceptions(question_results)

    assert topic_map == {
        "t1": [
            {"questionId": "q1", "summary": "mis-1", "count": 2},
            {"questionId": "q1", "summary": "mis-2", "count": 1},
            {"questionId": "q2", "summary": "mis-3", "count": 5},
        ],
        "t2": [],
    }

