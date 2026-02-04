import math

from repository import get_grades_by_student_exam
from collections import defaultdict
from class_analytics import compute_topic_class_score, compute_exam_score_distribution
from utils import classify_topic_performance, classify_z_score

def compute_student_exam_score(db, exam_id, student_id):
    """
    Compute student's total score and percentage
    """
    grades = get_grades_by_student_exam(db, student_id, exam_id)

    total_score = sum(g["score"] for g in grades)
    total_max = sum(g["maxScore"] for g in grades)

    return {
        "studentId": student_id,
        "totalScore": total_score,
        "percentage": total_score / total_max if total_max > 0 else 0.0
    }

def compute_student_position(student_score, class_avg, class_std):
    if class_std == 0:
        z_score = 0
    else:
        z_score = (student_score - class_avg) / class_std

    return {
        "zScore": z_score,
        "classAverage": class_avg,
        "deltaFromAverage": student_score - class_avg,
        "performanceBand": classify_z_score(z_score),
        "percentileRank": 0.5 * (1 + math.erf(z_score / math.sqrt(2)))  # Using the error function to compute percentile rank
    }

def compute_student_topic_performance(db, exam_id, student_id):
    """
    Student's performance per topic compared to class
    """
    grades = get_grades_by_student_exam(db, student_id, exam_id)

    by_topic = defaultdict(lambda: {"score": 0.0, "max": 0.0})

    for g in grades:
        by_topic[g["topicId"]]["score"] += g["score"]
        by_topic[g["topicId"]]["max"] += g["maxScore"]

    results = []

    for topic_id, data in by_topic.items():
        student_pct = data["score"] / data["max"] if data["max"] > 0 else 0.0
        class_pct = compute_topic_class_score(db, exam_id, topic_id)["aggregateScore"]

        results.append({
            "topicId": topic_id,
            "studentScore": round(student_pct, 2),
            "classAverage": round(class_pct, 2),
            "difference": round(student_pct - class_pct, 2),
            "status": classify_topic_performance(student_pct - class_pct)
        })

    return results

def compute_student_analytics(db, exam_id, student_id):
    """
    Single entry point for frontend / API
    """
    examPerformance = compute_student_exam_score(db, exam_id, student_id)
    classPerformance = compute_exam_score_distribution(db, exam_id)

    return {
        "examPerformance": examPerformance,
        "classPosition": compute_student_position(examPerformance["percentage"], classPerformance["averageScore"], classPerformance["stdDeviation"]),
        "topicPerformance": compute_student_topic_performance(db, exam_id, student_id)
    }