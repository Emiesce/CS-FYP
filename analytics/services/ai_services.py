import os
from .llm import AzureLLM
from dotenv import load_dotenv
from .question_analytics_services import embed_feedbacks, cluster_feedbacks, aggregate_topic_misconceptions, compute_topic_scores, rank_topics
from .class_analytics_services import compute_exam_score_distribution, compute_question_results

load_dotenv()

#print("DEBUG AZURE_API_KEY:", os.getenv("AZURE_API_KEY"))
#print("DEBUG AZURE_ENDPOINT:", os.getenv("AZURE_ENDPOINT"))

class AIService:
    def __init__(self):
        self.llm = AzureLLM(
            api_key=os.getenv("AZURE_API_KEY"), # change
            endpoint=os.getenv("AZURE_ENDPOINT") # change
        )

        self._exam_cache = {}  # cache entire analysis per exam

    # ---- Question Level Analysis ----
    def summarize_clusters(self, feedbacks, labels):
        clusters = {}

        # group feedbacks by their cluster labels
        for f, label in zip(feedbacks, labels):
            # ensure label is a plain int
            label = int(label)
            clusters.setdefault(label, []).append(f["feedback"])

        # summarize each cluster's feedbacks (#llm calls = number of clusters)
        # update: summarize all clusters at once due to LLM rate limits (might be adjusted)
        formatted_clusters = ""
        for cluster_id, texts in clusters.items():
            content = "\n".join(f"- {t}" for t in texts if t.strip())
            formatted_clusters += f"\nCluster {cluster_id}:\n{content}\n"

        prompt = f"""
            You are an educational analytics assistant.

            For each cluster below:
            - Identify the main shared misconception.
            - Return ONE concise sentence per cluster.
            - Format strictly as:

            Cluster 0: ...
            Cluster 1: ...
            Cluster 2: ...

            Clusters:
            {formatted_clusters}
            """

        try:
            response = self.llm.chat([
                {"role": "system", "content": "You are an expert in education learning analytics."},
                {"role": "user", "content": prompt}
            ])
            print(f"LLM Feedback Embedding Call for Question")
        except Exception as e:
            print("LLM ERROR:", e)
            return []

        # parse response into dictionary
        misconceptions = []

        for line in response.split("\n"):
            if line.startswith("Cluster"):
                parts = line.split(":", 1)
                if len(parts) == 2:
                    label = int(parts[0].removeprefix("Cluster").strip())
                    count = len(clusters[label])
                    misconceptions.append({
                        "summary": parts[1].strip(),
                        "count": count
                    })

        return misconceptions

    def question_analysis(self, db, exam_id, k_clusters: int = 3):

        # get all questions (aggregated from all students)
        question_results = compute_question_results(db, exam_id)

        for question in question_results:
            feedbacks = question.get("feedbacks", [])

            # no feedbacks → no misconceptions
            if not feedbacks:
                question["misconceptions"] = []
                continue

            # turn plain texts into the format expected by embed_feedbacks
            feedback_objects = [{"feedback": f} for f in feedbacks]

            embeddings = embed_feedbacks(feedback_objects)
            
            # avoid clustering more than available feedbacks
            k = min(k_clusters, len(feedbacks))
            labels = cluster_feedbacks(embeddings, k=k)

            misconceptions = self.summarize_clusters(feedback_objects, labels)

            question["misconceptions"] = misconceptions

        return question_results

     # ---- Exam Level ----
    
    # ---- Topic Level Analysis ----
    def summarize_topic_misconceptions(self, topic_id, misconceptions,  avg_score):
        """
        misconceptions: list of dicts with
            - questionId
            - summary
            - count
        """

        formatted = "\n".join(
            f"- {m['questionId']} ({m['count']} students): {m['summary']}"
            for m in misconceptions
        )

        prompt = f"""
            You are an education analytics expert.

            Topic ID: {topic_id}
            Average Topic Score: {avg_score:.2f}%

            Below are recurring misconceptions detected across multiple questions
            belonging to this topic.

            Your task:
            1. Group similar misconceptions.
            2. Identify the most dominant conceptual weaknesses.
            3. Summarize overall topic-level learning gaps.
            4. Suggest instructional focus areas.

            Misconceptions:
            {formatted}

            Return:
            - A structured paragraph summary.
            - Clear, concise, actionable. You don't want to overwhelm the educator with too much information.
            """

        return self.llm.chat([
            {"role": "system", "content": "You are an expert in learning analytics."},
            {"role": "user", "content": prompt}
        ])

    def topic_analysis(self, db, exam_id, question_results):
        """
        question_results: output from question_analysis()
        """

        topic_map = aggregate_topic_misconceptions(question_results)

        topic_scores = compute_topic_scores(db, exam_id)
        ranked_topics = rank_topics(topic_scores)
    
        # convert to lookup dict
        score_lookup = {t["topicId"]: t for t in ranked_topics}

        topic_summaries = []

        for topic_id, misconceptions in topic_map.items():

            score_data = score_lookup.get(topic_id, {})

            summary = None
            if misconceptions:
                summary = self.summarize_topic_misconceptions(
                    topic_id,
                    misconceptions,
                    score_data.get("averagePercentage")
                )
                print(f"LLM Topic Summary Call for Topic {topic_id}")

            topic_summaries.append({
                "topicId": topic_id,
                **score_data,
                "misconceptions": misconceptions,
                "summary": summary
            })

        return topic_summaries

    # ---- Exam Summary Analysis ----
    def exam_summary_analysis(self, topic_results):

        # collect topic summaries only
        formatted = "\n".join(
            f"- Topic {t['topicId']} ({t['averagePercentage']}% avg): {t['summary']}"
            for t in topic_results
            if t.get("summary")
        )

        prompt = f"""
            You are an academic performance analyst.

            Below are topic-level analyses from an exam.

            Your task:

            1. Identify recurring conceptual misunderstandings across topics.
            2. Summarize overall exam performance patterns.
            3. Provide high-level instructional recommendations.
            4. Focus on systemic improvement strategies.

            Do NOT repeat individual topic rankings.
            Do NOT restate statistics.
            Synthesize cross-topic insights.
            Keep it concise and actionable, you don't want to overwhelm the educator with too much information.

            Topic Analyses:
            {formatted}

            Return a concise, structured summary with:
            - Common Misconceptions
            - Recommendations
            """
        
        print("LLM Exam Summary Call")
        response = self.llm.chat([
            {"role": "system", "content": "You are an expert in learning analytics."},
            {"role": "user", "content": prompt}
        ])

        parts = response.split("### Recommendations")
        
        common = parts[0].replace("### Common Misconceptions", "").strip()
        recommendations = parts[1].strip() if len(parts) > 1 else ""
        
        return {
            "commonMisconceptions": common,
            "recommendations": recommendations
        }

    # ---- Full Exam Analysis Pipeline ----
    def full_exam_analysis(self, db, exam_id):
        '''return {
            "strongest_topics": ["Topic A"],
            "weakest_topics": ["Topic B"],
            "hardest_questions": [3],
            "easiest_questions": [1]
        } '''

        
      # 1️⃣ Check cache first
        if exam_id in self._exam_cache:
            return self._exam_cache[exam_id]

        # 2️⃣ Question-level analysis
        question_results = self.question_analysis(db, exam_id)

        # 3️⃣ Topic-level analysis (reuse question_results)
        topic_results = self.topic_analysis(
            db,
            exam_id,
            question_results
        )

        # 4️⃣ Exam-level summary
        exam_summary = self.exam_summary_analysis(topic_results)

        full_result = {
            "questions": question_results,
            "topics": topic_results,
            "examSummary": exam_summary
        }

        # 5️⃣ Cache it
        self._exam_cache[exam_id] = full_result


        return full_result
    
    # ---- Chat Interface ----
    def chat_about_exam(self, db, exam_id, user_message):

        # check cache first to avoid redundant analysis
        if exam_id in self._exam_cache:
            analysis = self._exam_cache[exam_id]
        else:
            analysis = self.full_exam_analysis(db, exam_id)

        examStatistics = compute_exam_score_distribution(db, exam_id)

        system_prompt = f"""
        You are an AI analytics assistant helping educators interpret exam performance data.

        STRICT RULES:
        - Use ONLY the provided exam data.
        - Do NOT invent numbers.
        - If information is missing, explicitly say it is not available.
        - Provide analytical insights, not generic advice.
        - Be concise but insightful.

        When relevant:
        - Identify patterns
        - Highlight weak concepts
        - Suggest instructional improvements
        - Reference specific statistics from the data

        When answering:
        - Start with a direct answer.
        - Then provide supporting evidence from the data.
        - Then provide interpretation.
        - Keep your explanation concise! You don't want to overwhelm the educator with too much information.

        Exam Data:
        {analysis}
        Exam Statistics:
        {examStatistics}
        """
        response = self.llm.chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ])

        return response.strip()
    
# function to use if decided to summarize cluster one by one
    def summarize_feedback_cluster(self, texts: list[str]):

        content = "\n".join(f"- {t}" for t in texts if t.strip())

        prompt = f"""
            You are an educational analytics assistant.

            Your task:
            Identify the main misconception shared across these student feedbacks.

            Return:
            - 1 sentence concise misconception summary.
            - Avoid repeating student wording. Straight to the point of the misconception.
            - Focus on conceptual misunderstanding.

            Student Feedback:
            {content}
            """

        return self.llm.chat([
            {"role": "system", "content": "You are an expert in education analytics."},
            {"role": "user", "content": prompt}
        ])