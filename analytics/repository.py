# get student's and class-level grades for analytics from the database

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
        SELECT studentId, questionId, score, maxScore, topicId
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


