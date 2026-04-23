import importlib
import types


def test_db_init_connects_with_check_same_thread_false_and_sets_row_factory(mocker):
    db_mod = importlib.import_module("services.db")

    fake_conn = mocker.Mock()
    connect = mocker.patch.object(db_mod.sqlite3, "connect", autospec=True, return_value=fake_conn)

    db = db_mod.DB("some.db")

    connect.assert_called_once_with("some.db", check_same_thread=False)
    assert db.conn is fake_conn
    assert fake_conn.row_factory is db_mod.sqlite3.Row


def test_db_query_executes_sql_and_returns_list_of_dicts(mocker):
    db_mod = importlib.import_module("services.db")

    fake_cursor = mocker.Mock()
    fake_conn = mocker.Mock()
    fake_conn.cursor.return_value = fake_cursor

    rows = [{"a": 1}, {"a": 2}]
    fake_cursor.fetchall.return_value = rows

    mocker.patch.object(db_mod.sqlite3, "connect", autospec=True, return_value=fake_conn)
    db = db_mod.DB(":memory:")

    sql = "SELECT a FROM t WHERE b = ?"
    params = ("x",)
    result = db.query(sql, params)

    fake_conn.cursor.assert_called_once_with()
    fake_cursor.execute.assert_called_once_with(sql, params)
    fake_cursor.fetchall.assert_called_once_with()
    assert result == [{"a": 1}, {"a": 2}]


def test_db_close_closes_connection(mocker):
    db_mod = importlib.import_module("services.db")

    fake_conn = mocker.Mock()
    mocker.patch.object(db_mod.sqlite3, "connect", autospec=True, return_value=fake_conn)
    db = db_mod.DB(":memory:")

    db.close()

    fake_conn.close.assert_called_once_with()


def test_get_db_connection_yields_db_and_closes_after(mocker):
    db_mod = importlib.import_module("services.db")

    created = {}

    class FakeDB:
        def __init__(self, path):
            created["path"] = path
            self.close = mocker.Mock()

    mocker.patch.object(db_mod, "DB", FakeDB)

    gen = db_mod.get_db_connection()
    db = next(gen)
    assert isinstance(db, FakeDB)
    assert created["path"] == "test_analytics.db"

    # Exhaust generator to trigger finally.
    gen.close()
    db.close.assert_called_once_with()


def _assert_query_call(db, call, expected_params, must_contain):
    assert call is not None
    sql = call.args[0]
    params = call.args[1]
    assert params == expected_params
    for fragment in must_contain:
        assert fragment in sql


def test_query_helpers_call_db_query_with_expected_params(mocker):
    db_mod = importlib.import_module("services.db")

    db = mocker.Mock()
    db.query.return_value = [{"ok": True}]

    assert db_mod.get_grades_by_student_exam(db, "s1", "e1") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("s1", "e1"),
        ["FROM grades", "WHERE studentId = ?", "AND examId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_grades_by_exam(db, "e2") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("e2",),
        ["FROM grades", "WHERE examId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_exam_info_by_exam(db, "e3") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("e3",),
        ["FROM exam_info", "WHERE examId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_grades_by_exam_question(db, "e4", "q9") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("e4", "q9"),
        ["FROM grades", "WHERE examId = ?", "AND questionId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_grades_by_exam_topic(db, "e5", "t7") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("e5", "t7"),
        ["FROM grades", "WHERE examId = ?", "AND topicId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_grades_by_student_exam_topic(db, "s2", "e6", "t8") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("s2", "e6", "t8"),
        ["FROM grades", "WHERE studentId = ?", "AND examId = ?", "AND topicId = ?"],
    )

    db.query.reset_mock()
    assert db_mod.get_aggregated_topic_scores_by_exam(db, "e7") == [{"ok": True}]
    _assert_query_call(
        db,
        db.query.call_args,
        ("e7",),
        ["FROM grades", "WHERE examId = ?", "GROUP BY topicId", "SUM(score)"],
    )

