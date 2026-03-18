# summarize exam-level insights based on topic summaries and question results

def rank_topics_by_score(topic_summaries):
    return sorted(
        topic_summaries,
        key=lambda t: t.get("averageScore", 0)
    )

def extract_exam_misconceptions(topic_summaries):
    misconceptions = []

    for topic in topic_summaries:
        for m in topic.get("keyMisconceptions", []):
            misconceptions.append({
                "topicId": topic["topicId"],
                "label": m["label"],
                "severity": m.get("severity")
            })

    return misconceptions

def summarize_exam(exam_id, topic_summaries, llm):
    """
    Generate an exam-level AI summary based on topic-level summaries.
    """

    if not topic_summaries:
        return None
    
    weakest_topics = rank_topics_by_score(topic_summaries)
    all_misconceptions = extract_exam_misconceptions(topic_summaries)

    return llm.summarize({
        "task": "Summarize exam-level performance and misconceptions",
        "examId": exam_id,
        "topics": topic_summaries,
        "weakestTopics": weakest_topics[:3],
        "misconceptions": all_misconceptions,
        "instructions": [
            "Identify recurring misconceptions across topics",
            "Highlight 3 weakest and strongest topics based on averageScore",
            "Detect systemic conceptual issues",
            "Provide high-level instructional recommendations"
        ]
    })
