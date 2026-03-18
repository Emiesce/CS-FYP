import sqlite3

class DB:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(
            path,
            check_same_thread=False  # ✅ allow use in FastAPI threadpool
        )
        self.conn.row_factory = sqlite3.Row

    def query(self, sql, params=()):
        cur = self.conn.cursor()
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
    
    def close(self):
        self.conn.close()

def get_db_connection():
    db = DB("test_analytics.db")
    try:
        yield db
    finally:
        db.close()

# get grades (for all questions) for a specific student in a specific exam
def get_grades_by_student_exam(db, student_id, exam_id):
    return db.query("""
        SELECT questionId, score, maxScore, topicId
        FROM grades
        WHERE studentId = ?
          AND examId = ?
    """, (student_id, exam_id))

# get grades for all students in a specific exam
def get_grades_by_exam(db, exam_id):
    return db.query("""
        SELECT studentId, questionId, score, maxScore, topicId, feedback
        FROM grades
        WHERE examId = ?
    """, (exam_id,))

# get exam info (completion time) for all students in a specific exam
def get_exam_info_by_exam(db, exam_id):
    return db.query("""
        SELECT studentId, totalDuration
        FROM exam_info
        WHERE examId = ?
    """, (exam_id,))

# get grades for a specific exam question across all students (include answer later)
def get_grades_by_exam_question(db, exam_id, question_id):
    return db.query("""
        SELECT studentId, score, maxScore, topicId, feedback
        FROM grades
        WHERE examId = ?
          AND questionId = ?
    """, (exam_id, question_id))

# get grades for a specific exam topics across all students
def get_grades_by_exam_topic(db, exam_id, topic_id):
    return db.query("""
        SELECT studentId, score, maxScore
        FROM grades
        WHERE examId = ?
          AND topicId = ?
    """, (exam_id, topic_id))

def get_grades_by_student_exam_topic(db, student_id, exam_id, topic_id):
    return db.query("""
        SELECT score, maxScore
        FROM grades
        WHERE studentId = ?
          AND examId = ?
          AND topicId = ?
    """, (student_id, exam_id, topic_id))

def get_aggregated_topic_scores_by_exam(db, exam_id):
    return db.query("""
        SELECT topicId, SUM(score) as totalScore, SUM(maxScore) as totalMaxScore
        FROM grades
        WHERE examId = ?
        GROUP BY topicId
    """, (exam_id,))