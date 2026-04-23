import ast
import os
import sqlite3
import sys
import types
import importlib
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def seeded_db_path(tmp_path_factory):
    """
    Build a fresh, temporary seeded SQLite DB once per test session.

    This avoids coupling tests to the checked-in `test_analytics.db` file which may
    be re-generated (or accidentally committed) with duplicated rows.
    """
    analytics_root = Path(__file__).resolve().parents[1]
    demo_seed_path = analytics_root / "demo" / "set_up_demo.py"

    src = demo_seed_path.read_text(encoding="utf-8")
    module = ast.parse(src)

    grades = None
    for node in module.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id == "GRADES":
                grades = ast.literal_eval(node.value)
                break

    assert grades, f"Could not load GRADES from {demo_seed_path}"

    tmp_dir = tmp_path_factory.mktemp("seeded_analytics_db")
    db_path = tmp_dir / "test_analytics.db"

    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS grades (
                studentId TEXT,
                examId TEXT,
                questionId TEXT,
                topicId TEXT,
                score REAL,
                maxScore REAL,
                feedback TEXT
            )
            """
        )
        cur.executemany(
            "INSERT INTO grades VALUES (?, ?, ?, ?, ?, ?, ?)",
            grades,
        )
        conn.commit()
    finally:
        conn.close()

    return str(db_path)


@pytest.fixture()
def seeded_db(seeded_db_path):
    from services.db import DB

    db = DB(seeded_db_path)
    try:
        # Fail fast if schema/data is missing.
        rows = db.query("SELECT COUNT(*) as n FROM grades")
        assert rows and rows[0]["n"] > 0
        yield db
    finally:
        db.close()


def test_compute_exam_score_distribution_matches_seeded_db(seeded_db):
    from services.class_analytics_services import compute_exam_score_distribution
    from services.utils import compute_class_statistics

    rows = seeded_db.query(
        "SELECT studentId, score, maxScore FROM grades WHERE examId = ?",
        ("EXAM1",),
    )
    assert rows

    by_student = {}
    for r in rows:
        s = r["studentId"]
        by_student.setdefault(s, {"score": 0.0, "max": 0.0})
        by_student[s]["score"] += float(r["score"])
        by_student[s]["max"] += float(r["maxScore"])

    percentages = [
        v["score"] / v["max"]
        for v in by_student.values()
        if v["max"] > 0
    ]
    expected = compute_class_statistics(percentages)

    out = compute_exam_score_distribution(seeded_db, exam_id="EXAM1")
    assert out == expected
    assert out["scoreDistribution"] is not None
    assert sum(out["scoreDistribution"]) == len(percentages)


def test_compute_question_results_returns_expected_shape_and_q1_values(seeded_db):
    from services.class_analytics_services import compute_question_results

    out = compute_question_results(seeded_db, exam_id="EXAM1", num_bins=10)
    assert isinstance(out, list)
    assert out, "Expected seeded DB to produce question results"

    by_q = {r["questionId"]: r for r in out}
    assert set(by_q.keys()) == {f"Q{i}" for i in range(1, 9)}

    q1 = by_q["Q1"]
    assert q1["examId"] == "EXAM1"
    assert q1["topicId"] == "T1"
    assert q1["aggregateScore"] == pytest.approx(0.4)
    assert q1["successRate"] == pytest.approx(40.0)
    assert isinstance(q1["scoreDistribution"], list)
    assert len(q1["scoreDistribution"]) == 10
    # The seeded DB may be re-generated multiple times during development; assert
    # against the actual number of grade rows for this question.
    q1_rows = seeded_db.query(
        "SELECT feedback FROM grades WHERE examId = ? AND questionId = ?",
        ("EXAM1", "Q1"),
    )
    assert sum(q1["scoreDistribution"]) == len(q1_rows)
    expected_feedback_count = sum(1 for r in q1_rows if r["feedback"])
    assert len(q1["feedbacks"]) == expected_feedback_count


@pytest.fixture()
def class_analytics_test_app(mocker, seeded_db_path):
    """
    Minimal FastAPI app with router under test, using dependency overrides
    to point to the real seeded DB.
    """
    from services.db import DB
    from routers import classAnalytics as router_mod

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")

    def _override_db():
        db = DB(seeded_db_path)
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[router_mod.get_db_connection] = _override_db

    return app, router_mod


def test_router_exam_statistics_uses_seeded_db(class_analytics_test_app):
    app, _router_mod = class_analytics_test_app
    client = TestClient(app)

    r = client.get("/api/exam/EXAM1/statistics")
    assert r.status_code == 200
    data = r.json()
    assert "averageScore" in data
    assert data["averageScore"] is not None
    assert "scoreDistribution" in data


def test_router_questions_statistics_uses_seeded_db(class_analytics_test_app):
    app, _router_mod = class_analytics_test_app
    client = TestClient(app)

    r = client.get("/api/exam/EXAM1/questionsStatistics")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert {d["questionId"] for d in data} == {f"Q{i}" for i in range(1, 9)}


def test_router_questionsAnalysis_topics_summary_mock_ai_service(class_analytics_test_app, mocker):
    app, router_mod = class_analytics_test_app
    client = TestClient(app)

    fake = mocker.Mock()
    fake.full_exam_analysis.return_value = {
        "questions": [{"questionId": "Q1"}],
        "topics": [{"topicId": "T1"}],
        "examSummary": {"commonMisconceptions": "x", "recommendations": "y"},
    }
    mocker.patch.object(router_mod, "ai_service", fake)

    r1 = client.get("/api/exam/EXAM1/questionsAnalysis")
    assert r1.status_code == 200
    assert r1.json() == [{"questionId": "Q1"}]

    r2 = client.get("/api/exam/EXAM1/topics")
    assert r2.status_code == 200
    assert r2.json() == [{"topicId": "T1"}]

    r3 = client.get("/api/exam/EXAM1/summary")
    assert r3.status_code == 200
    assert r3.json() == {"commonMisconceptions": "x", "recommendations": "y"}


def test_router_chat_validates_messages_and_uses_mocked_ai_service(class_analytics_test_app, mocker):
    app, router_mod = class_analytics_test_app
    client = TestClient(app)

    fake = mocker.Mock()
    fake.chat_about_exam.return_value = "hello there"
    mocker.patch.object(router_mod, "ai_service", fake)

    r0 = client.post("/api/chat", json={"exam_id": "EXAM1", "messages": []})
    assert r0.status_code == 200
    assert r0.json() == {"error": "No messages provided"}

    r1 = client.post(
        "/api/chat",
        json={
            "exam_id": "EXAM1",
            "messages": [{"role": "user", "content": "How did students do?"}],
        },
    )
    assert r1.status_code == 200
    data = r1.json()
    assert data["choices"][0]["message"]["role"] == "assistant"
    assert data["choices"][0]["message"]["content"] == "hello there"
    fake.chat_about_exam.assert_called_once()


def test_ai_service_full_pipeline_with_real_db_and_mocked_heavy_deps(seeded_db_path, mocker):
    """
    Integration-ish test: use the real DB, but mock embedding/clustering + LLM calls
    so we exercise orchestration without downloads/network.
    """
    # Inject a fake `sentence_transformers` module before importing services.ai_services,
    # since `services.question_analytics_services` builds a model at import time.
    fake_sentence_transformers = types.ModuleType("sentence_transformers")
    fake_sentence_transformers.SentenceTransformer = lambda _name: mocker.Mock()
    sys.modules["sentence_transformers"] = fake_sentence_transformers

    sys.modules.pop("services.question_analytics_services", None)
    sys.modules.pop("services.ai_services", None)
    ai_mod = importlib.import_module("services.ai_services")

    from services.db import DB

    mocker.patch.object(ai_mod, "embed_feedbacks", side_effect=lambda feedbacks: [[0.0] for _ in feedbacks])
    mocker.patch.object(ai_mod, "cluster_feedbacks", side_effect=lambda embeddings, k: [0 for _ in embeddings])

    svc = ai_mod.AIService()
    def _fake_chat(messages, *args, **kwargs):
        # summarize_clusters() needs "Cluster X: ..." lines to parse.
        user_text = messages[-1]["content"] if messages else ""
        if "Clusters:" in user_text:
            return "Cluster 0: A shared misconception"
        # exam_summary_analysis() expects these headings.
        if "Topic Analyses:" in user_text:
            return "### Common Misconceptions\nC\n### Recommendations\nR"
        # topic summaries can be any plain text.
        return "A topic summary"

    svc.llm.chat = mocker.Mock(side_effect=_fake_chat)

    db = DB(seeded_db_path)
    try:
        out = svc.full_exam_analysis(db, exam_id="EXAM1")
    finally:
        db.close()

    assert set(out.keys()) == {"questions", "topics", "examSummary"}
    assert isinstance(out["questions"], list) and out["questions"]
    assert isinstance(out["topics"], list) and out["topics"]
    assert out["examSummary"]["commonMisconceptions"] == "C"
    assert out["examSummary"]["recommendations"] == "R"
