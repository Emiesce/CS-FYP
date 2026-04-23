# analyze question's misconceptions & topic assessment

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from .db import get_aggregated_topic_scores_by_exam

model = SentenceTransformer('all-MiniLM-L6-v2')

# prepare input for AI models that consists of feedbacks from students who got the question wrong
def prepare_feedbacks(grades):
    return [
        {
            "studentId": g["studentId"],
            "feedback": g["feedback"]
        }
        for g in grades
        if g["score"] < g["maxScore"] and g["feedback"]
    ]

# turn text feedbacks into embeddings (vectors)
def embed_feedbacks(feedbacks):
    texts = [f["feedback"] for f in feedbacks]
    return model.encode(texts)

# cluster the feedback embeddings to find common themes (into k misconceptions labels)
def cluster_feedbacks(embeddings, k):
    n_samples = len(embeddings)

    if n_samples <= 1:
        return [0] * n_samples  # single cluster

    k = min(k, n_samples)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)

    labels = kmeans.fit_predict(embeddings)

    # convert to plain Python ints
    return [int(l) for l in labels]

def compute_topic_scores(db, exam_id):
    rows = get_aggregated_topic_scores_by_exam(db, exam_id)

    topic_scores = []

    for r in rows:
        percentage = 0
        if r["totalMaxScore"] > 0:
            percentage = (r["totalScore"] / r["totalMaxScore"]) * 100

        topic_scores.append({
            "topicId": r["topicId"],
            "totalScore": r["totalScore"],
            "totalMaxScore": r["totalMaxScore"],
            "averagePercentage": round(percentage, 2)
        })

    return topic_scores

def rank_topics(topic_scores):
    # lowest average first = weakest
    sorted_topics = sorted(
        topic_scores,
        key=lambda x: x["averagePercentage"]
    )

    for i, topic in enumerate(sorted_topics, start=1):
        topic["rank"] = i

    return sorted_topics

def aggregate_topic_misconceptions(question_results):
    topic_map = {}

    for q in question_results:
        topic_id = q["topicId"]
        topic_map.setdefault(topic_id, [])
        
        for m in q["misconceptions"]:
            topic_map[topic_id].append({
                "questionId": q["questionId"],
                "summary": m["summary"],
                "count": m["count"]
            })

    return topic_map