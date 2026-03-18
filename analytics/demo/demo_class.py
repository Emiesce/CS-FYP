from collections import defaultdict
from openai import AzureOpenAI
from set_up_demo import GRADES
from analytics.services.question_analytics_services import (
    prepare_feedbacks,
    embed_feedbacks,
    cluster_feedbacks,
    summarize_clusters,
    aggregate_topic_misconceptions,
    summarize_topic
)
from analytics.services.exam_summary import (
    rank_topics_by_score,
    extract_exam_misconceptions,
    summarize_exam
)
from analytics.services.llm import AzureLLM

# Initialize Azure OpenAI client
llm = AzureLLM(
    api_key="8abd07a4a03c4cfeb64d35ac199d8335",
    endpoint="https://hkust.azure-api.net/"
)

# ---------- Question-level pipeline ----------
def analyze_questions_from_grades(grades, llm):
    """
    Returns:
    [
        {
            questionId,
            topicId,
            misconceptions
        }
    ]
    """

    question_map = defaultdict(list)

    # group rows by question
    for row in grades:
        studentId, examId, questionId, topicId, score, maxScore, feedback = row
        question_map[(questionId, topicId)].append({
            "studentId": studentId,
            "score": score,
            "maxScore": maxScore,
            "feedback": feedback
        })

    question_results = []

    for (question_id, topic_id), rows in question_map.items():
        feedbacks = prepare_feedbacks(rows)

        if not feedbacks:
            continue

        embeddings = embed_feedbacks(feedbacks)
        labels = cluster_feedbacks(embeddings, k=3)

        misconceptions = summarize_clusters(feedbacks, labels, llm)

        question_results.append({
                "questionId": question_id,
                "topicId": topic_id,
                "misconceptions": misconceptions
            })

    return question_results

# ---------- Topic-level pipeline ----------
def analyze_topics_from_questions(question_results, llm):
    topic_map = defaultdict(list)

    for q in question_results:
        topic_map[q["topicId"]].append(q)

    topic_summaries = []

    for topic_id, questions in topic_map.items():
        misconceptions = aggregate_topic_misconceptions(questions)
        summary = summarize_topic(topic_id, misconceptions, llm)

        topic_summaries.append({
            "topicId": topic_id,
            "misconceptions": misconceptions,
            "summary": summary
        })

    return topic_summaries

# ---------- Exam-level pipeline ----------
def analyze_exam_from_topics(exam_id, topic_summaries, llm):
    return {
        "examId": exam_id,
        "rankedTopics": rank_topics_by_score(topic_summaries),
        "misconceptions": extract_exam_misconceptions(topic_summaries),
        "summary": summarize_exam(exam_id, topic_summaries, llm)
    }

def demo_full_exam_analysis(grades, exam_id, llm):
    print("\n========== QUESTION ANALYSIS ==========")
    question_results = analyze_questions_from_grades(grades, llm)

    for q in question_results:
        print(f"\n{q['questionId']} (Topic {q['topicId']})")
        for m in q["misconceptions"]:
            print(f" {m['summary']} ({m['count']} students)")

    print("\n========== TOPIC ANALYSIS ==========")
    topic_summaries = analyze_topics_from_questions(question_results, llm)

    for t in topic_summaries:
        print(f"\nTopic {t['topicId']}")
        print(t["summary"])

    print("\n========== EXAM ANALYSIS ==========")
    exam_summary = analyze_exam_from_topics(exam_id, topic_summaries, llm)
    print(exam_summary["summary"])

demo_full_exam_analysis(
    grades=GRADES,
    exam_id="EXAM1",
    llm=llm
)