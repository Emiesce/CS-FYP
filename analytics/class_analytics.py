# analyze class-level exam's performance

import numpy as np

from collections import defaultdict
from repository import get_grades_by_exam, get_grades_by_exam_question, get_grades_by_exam_topic, get_exam_info_by_exam
from utils import compute_class_statistics

def compute_exam_score_distribution(db, exam_id):
    grades = get_grades_by_exam(db, exam_id)

    if not grades:
        return None

    by_student = defaultdict(lambda: {"score": 0, "max": 0})

    for g in grades:
        by_student[g["studentId"]]["score"] += g["score"]
        by_student[g["studentId"]]["max"] += g["maxScore"]

    percentages = [
        v["score"] / v["max"]
        for v in by_student.values()
        if v["max"] > 0
    ]

    return compute_class_statistics(percentages)

def compute_topic_class_score(db, exam_id, topic_id):
    grades = get_grades_by_exam_topic(db, exam_id, topic_id)

    if not grades:
        return None

    total_score = sum(g["score"] for g in grades)
    total_max = sum(g["maxScore"] for g in grades)

    return {
        "topicId": topic_id,
        "aggregateScore": total_score / total_max
    }

def compute_completion_time(db, exam_id):
    exam_info = get_exam_info_by_exam(db, exam_id)

    if not exam_info:
        return None

    arr = np.array([e["totalDuration"] for e in exam_info])

    return {
        "avgCompletionTime": arr.mean(),
        "completionTimeDistribution": np.histogram(arr, bins=5)[0].tolist() # get the counts only, [1] is the bin edges
    }

def compute_question_class_score(db, exam_id, question_id):
    grades = get_grades_by_exam_question(db, exam_id, question_id)

    if not grades:
        return None

    total_score = 0
    total_max = 0
    total_answers = 0

    wrong_answer_counts = defaultdict(int)

    for g in grades:
        total_score += g["score"]
        total_max += g["maxScore"]
        total_answers += 1

        # MCQ base case: wrong if score < maxScore
        if g["score"] < g["maxScore"]:
            wrong_answer_counts[g["answer"]] += 1

    # Convert counts to distribution
    common_wrong_answers = [
        {
            "answer": ans,
            "count": count,
            "percentage": count / total_answers
        }
        for ans, count in sorted(
            wrong_answer_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )
    ]

    return {
        "questionId": question_id,
        "topicId": grades[0]["topicId"],
        "aggregateScore": total_score / total_max,
        "commonWrongAnswers": common_wrong_answers
    }