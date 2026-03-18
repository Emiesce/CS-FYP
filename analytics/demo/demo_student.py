# main.py
# Demonstrates end-to-end analytics + AI workflow on dummy data

#from repository import get_grades_by_exam_question, get_grades_by_student_exam
from analytics.services.student_analytics import compute_student_analytics

from analytics.services.db import DB

# set up dummy database connection
db = DB("test_analytics.db")

# format_student_report.py

def format_student_analytics(student_analytics):
    lines = []

    exam = student_analytics["examPerformance"]
    position = student_analytics["classPosition"]
    topics = student_analytics["topicPerformance"]

    # -------------------------------
    # Header
    # -------------------------------
    lines.append(f"Student Performance Report")
    lines.append(f"Student ID: {exam['studentId']}")
    lines.append("-" * 40)

    # -------------------------------
    # Overall performance
    # -------------------------------
    percentage = exam["percentage"] * 100
    lines.append("Overall Exam Performance")
    lines.append(f"- Total Score: {exam['totalScore']:.1f}")
    lines.append(f"- Percentage: {percentage:.1f}%")
    lines.append("")

    # -------------------------------
    # Class position
    # -------------------------------
    lines.append("Class Position")
    lines.append(
        f"- You are performing better than approximately "
        f"{round(position['percentileRank']*100, 2)}% of the class."
    )
    lines.append(
        f"- Class Average: {position['classAverage'] * 100:.1f}%"
    )
    lines.append("")

    # -------------------------------
    # Topic-level performance
    # -------------------------------
    lines.append("Topic Performance Analysis")

    for t in topics:
        status = t["status"]
        diff = t["difference"] * 100

        lines.append(
            f"- Topic {t['topicId']}: "
            f"Your score is {t['studentScore'] * 100:.1f}% "
            f"(Class avg: {t['classAverage'] * 100:.1f}%) → {status}"
        )

    lines.append("")
    lines.append("End of Report")

    return "\n".join(lines)

# analyze student exam performance
def demo_student_analytics(db, student_id, exam_id, topic_ids):
    student_analytics = compute_student_analytics(db, exam_id, student_id)
    report = format_student_analytics(student_analytics)

    print(report)

demo_student_analytics(db, "S3", "EXAM1", ["T1", "T2", "T3", "T4", "T5"])