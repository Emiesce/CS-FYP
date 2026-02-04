# analyze question's misconceptions & topic assessment

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans

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
def cluster_feedbacks(embeddings, k=3):
    n_samples = len(embeddings)

    if n_samples <= 1:
        return [0] * n_samples  # single cluster

    k = min(k, n_samples)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    return kmeans.fit_predict(embeddings)

def summarize_clusters(feedbacks, labels, llm):
    clusters = {}

    # group feedbacks by their cluster labels
    for f, label in zip(feedbacks, labels):
        clusters.setdefault(label, []).append(f["feedback"])

    summaries = []
    # summarize each cluster's feedbacks (#llm calls = number of clusters)
    for label, texts in clusters.items():
        summary = llm.summarize(texts)
        summaries.append({
            "clusterId": label,
            "summary": summary,
            "count": len(texts)
        })

    return summaries

def aggregate_topic_misconceptions(question_results):
    topic_misconceptions = []

    for q in question_results:
        for m in q["misconceptions"]:
            topic_misconceptions.append({
                "questionId": q["questionId"],
                "label": m["summary"],
                "count": m["count"],
                "percentage": m.get("percentage")
            })

    return topic_misconceptions

def summarize_topic(topic_id, misconceptions, llm):
    return llm.summarize({
        "task": "Summarize recurring misconceptions and topic-level weaknesses",
        "topicId": topic_id,
        "misconceptions": misconceptions,
        "instructions": [
            "Group similar misconceptions",
            "Highlight the most frequent issues",
            "Suggest instructional focus areas"
        ]
    })
