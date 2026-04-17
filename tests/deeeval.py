"""
DeepEval evaluation suite for the RAG grading system.

Evaluates two main areas:
1. Grading Answer Relevancy  - does the AI grading response stay relevant to the rubric/question?
2. Lecture Notes Extraction  - does the RAG pipeline correctly retrieve lecture note context?

Run with:
    python tests/deeeval.py

Requirements:
    pip install deepeval
    Set environment variables (or .env):
        AZURE_OPENAI_ENDPOINT, OPENAI_API_KEY, AZURE_OPENAI_API_VERSION,
        AZURE_OPENAI_DEPLOYMENT, AZURE_EMBEDDING_DEPLOYMENT
"""

import os
import sys
import asyncio
import time
from pathlib import Path

# Allow imports from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    AnswerRelevancyMetric,
    ContextualRecallMetric,
    ContextualPrecisionMetric,
    ContextualRelevancyMetric,
    FaithfulnessMetric,
)
from deepeval.models import AzureOpenAIModel

# ---------------------------------------------------------------------------
# Judge model — uses your Azure deployment to evaluate
# ---------------------------------------------------------------------------
judge_model = AzureOpenAIModel(
    model=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
    deployment_name=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
    api_key=os.getenv("OPENAI_API_KEY", ""),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
    base_url=os.getenv("AZURE_OPENAI_ENDPOINT", "https://hkust.azure-api.net"),
    temperature=0,
)

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
answer_relevancy   = AnswerRelevancyMetric(threshold=0.7, model=judge_model)
faithfulness       = FaithfulnessMetric(threshold=0.7, model=judge_model)
ctx_precision      = ContextualPrecisionMetric(threshold=0.7, model=judge_model)
ctx_recall         = ContextualRecallMetric(threshold=0.7, model=judge_model)
ctx_relevancy      = ContextualRelevancyMetric(threshold=0.7, model=judge_model)


# ---------------------------------------------------------------------------
# Helper: ensure lecture notes are indexed in ChromaDB for a given rubric
# ---------------------------------------------------------------------------
async def ensure_lecture_notes_indexed(system, rubric_id: str) -> int:
    """
    Re-index any lecture notes associated with rubric_id that aren't yet in ChromaDB.
    Returns the number of notes indexed.
    """
    from src.utils.lecture_notes_storage import get_default_lecture_notes_storage

    storage = get_default_lecture_notes_storage()
    notes = storage.get_notes_for_rubric(rubric_id)
    indexed = 0
    for note in notes:
        if note.extracted_content:
            await system.grading_service.add_lecture_note_to_rag(
                note_content=note.extracted_content,
                note_id=note.id,
                rubric_ids=note.associated_rubrics,
            )
            indexed += 1
    if indexed:
        print(f"  Re-indexed {indexed} lecture note(s) for rubric {rubric_id}")
    return indexed


# ---------------------------------------------------------------------------
# Helper: run the real RAG grading pipeline and capture outputs
# ---------------------------------------------------------------------------
async def run_grading_pipeline(
    student_answer: str,
    rubric_id: str,
    question_id: str,
) -> tuple[str, list[str]]:
    """
    Calls the real RAG grading system and returns:
        (actual_output, retrieval_context)

    actual_output    — the AI justification text for the first criterion result
    retrieval_context — list of rubric/lecture-note chunks retrieved from ChromaDB
    """
    from src.grading_system import create_system
    from src.models.grading_models import GradingRequest

    system = await create_system()

    # Ensure lecture notes for this rubric are indexed in ChromaDB
    await ensure_lecture_notes_indexed(system, rubric_id)

    request = GradingRequest(
        student_id="eval_student",
        marking_scheme_id=rubric_id,
        question_answers={question_id: student_answer},
    )

    response = await system.grade_answer(request, save_result=False)

    # Collect justification text from all criteria results
    actual_output = "\n\n".join(
        f"[{r.criterion_name}] Score: {r.score}/{r.max_score}\n{r.justification}"
        for r in response.results
    )

    # Re-run similarity search to capture what was retrieved (mirrors what grading used)
    retrieval_context: list[str] = []
    for r in response.results:
        chunks = await system.vector_store.similarity_search_with_rubric_context(
            query=f"How to grade: {r.criterion_name}",
            rubric_id=rubric_id,
            k=5,
        )
        retrieval_context.extend(c.content for c in chunks)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique_ctx: list[str] = []
    for c in retrieval_context:
        if c not in seen:
            seen.add(c)
            unique_ctx.append(c)

    return actual_output, unique_ctx


# ---------------------------------------------------------------------------
# Test dataset
# Each entry represents one student submission to evaluate.
# Adjust rubric_id / question_id to match your rubrics.json data.
# ---------------------------------------------------------------------------
GRADING_TEST_CASES = [
    {
        "name": "strong_essay_answer",
        "rubric_id": "rubric-1776183292802",                  # matches lecture note association
        "question_id": "q-1776183197272",          # real question ID from rubric
        "student_answer": (
            "The planning fallacy is primarily driven by the Inside-Outside Model, where individuals rely on 'singular information' (the unique features of the current task) rather than 'distributional information' (past experiences). This 'inside view' leads to a narrow focus on successful future scenarios while neglecting potential impediments. This neglect is furthered by attributional processes, where past failures are discounted as being caused by external, unstable, or specific factors (e.g., 'that delay was just a one-time accident') rather than reflecting a persistent planning issue. Furthermore, motivated reasoning biases the process; the desire to finish quickly enhances the accessibility of information consistent with a successful outcome. Finally, the conjunctive-events bias leads planners to overestimate the likelihood that a series of necessary steps will all go right, failing to account for the high cumulative probability that at least one setback will occur. An example of this is the 1976 curriculum project where experts predicted 18–30 months, ignoring distributional data showing similar projects took 7–10 years."
        ),
        "expected_output": (
           "This excellent answer succeeds by accurately integrating all four key psychological mechanisms identified in the course materials to provide a comprehensive explanation of the planning fallacy. First, it correctly applies the Inside-Outside Model by highlighting the failure to use distributional information" 
           "from the past in favor of singular information"
           " about the current task. Second, it explains the role of attributional processes in discounting past failures as external or unstable accidents," 
           "and motivated reasoning in focusing on successful plans to reach a goal. Finally, the answer uses the conjunctive-events bias to explain how planners overestimate the likelihood of every project step succeeding simultaneously, supporting its logic with the classic Kahneman curriculum project example."
        ),
    },
    {
        "name": "weak_essay_answer",
        "rubric_id": "rubric-1776183292802",
        "question_id": "q-1776183197272",
        "student_answer": "Planning fallacy is when you think you can finish a project faster than you actually can. This happens because people are naturally optimistic and don't like to think about failing. We usually just look at the task we are doing right now and don't think about the past. If we had a problem in the past, we just say it was bad luck and won't happen again. Also, if we are in a hurry, we might make even worse predictions because we want to be done. Examples of this include IT projects in the U.S. that are often way over budget and take much longer than planned.",
        "expected_output": (
            "The answer is incomplete and too short.because it lacks specific terminology like 'singular vs. distributional information,' 'conjunctive-events bias,' or 'Inside-Outside Model' as defined in the course material."
            " despite that the vast majority of similar projects have failed to proceed "
            "as planned. It should explain the concept and provide a real-world example with sufficient elbaoration."
        ),
    },
]

# ---------------------------------------------------------------------------
# Test dataset for lecture notes retrieval quality
# These test whether the RAG system retrieves relevant lecture note chunks
# when lecture notes are associated with a rubric.
# ---------------------------------------------------------------------------
LECTURE_NOTES_TEST_CASES = [
    {
        "name": "lecture_notes_retrieval_planning_fallacy",
        "rubric_id": "rubric-1",
        "query": "planning fallacy inside view outside view",
        # Paste a snippet you KNOW is in your uploaded lecture notes
        "expected_context_snippet": " Planning fallacy is the tendency to underestimate the resources"
        " (time and money) needed for project completion, despite that the vast majority of similar"
        "projects have failed to proceed as planned.",
    }
]


# ---------------------------------------------------------------------------
# Build LLMTestCase objects for grading evaluation
# ---------------------------------------------------------------------------
async def build_grading_test_cases() -> list[LLMTestCase]:
    test_cases = []
    for tc in GRADING_TEST_CASES:
        print(f"  Running pipeline for: {tc['name']} ...")
        actual_output, retrieval_context = await run_grading_pipeline(
            student_answer=tc["student_answer"],
            rubric_id=tc["rubric_id"],
            question_id=tc["question_id"],
        )
        test_cases.append(
            LLMTestCase(
                input=tc["student_answer"],
                actual_output=actual_output,
                expected_output=tc["expected_output"],
                retrieval_context=retrieval_context,
                # name is used for display in the report
                additional_metadata={"name": tc["name"]},
            )
        )
    return test_cases


# ---------------------------------------------------------------------------
# Build LLMTestCase objects for lecture notes retrieval evaluation
# ---------------------------------------------------------------------------
async def build_lecture_notes_test_cases() -> list[LLMTestCase]:
    from src.grading_system import create_system

    system = await create_system()
    test_cases = []

    for tc in LECTURE_NOTES_TEST_CASES:
        print(f"  Retrieving context for: {tc['name']} ...")
        # Make sure lecture notes are indexed before querying
        await ensure_lecture_notes_indexed(system, tc["rubric_id"])
        chunks = await system.vector_store.similarity_search_with_rubric_context(
            query=tc["query"],
            rubric_id=tc["rubric_id"],
            k=5,
        )
        retrieval_context = [c.content for c in chunks]

        # actual_output: simulate what the grader would say given this context
        context_text = "\n\n".join(retrieval_context) if retrieval_context else "No context retrieved."

        test_cases.append(
            LLMTestCase(
                input=tc["query"],
                # The "output" here is the retrieved context itself — we're testing
                # whether the retrieval is faithful and relevant to the query.
                actual_output=context_text,
                expected_output=tc["expected_context_snippet"],
                retrieval_context=retrieval_context,
                additional_metadata={"name": tc["name"]},
            )
        )
    return test_cases


# ---------------------------------------------------------------------------
# Sequential runner — one metric, one test case at a time
# Avoids parallel LLM calls that blow past the 60 RPM Azure limit.
# ---------------------------------------------------------------------------
DELAY_BETWEEN_CALLS = 45  # seconds — adjust if still hitting 429


def _run_sequential(test_cases: list, metrics: list) -> None:
    """Evaluate each (test_case, metric) pair one at a time with a delay."""
    total = len(test_cases) * len(metrics)
    step = 0
    for tc in test_cases:
        for metric in metrics:
            step += 1
            print(f"  [{step}/{total}] {metric.__class__.__name__} ...")
            evaluate(test_cases=[tc], metrics=[metric])
            if step < total:
                print(f"  Waiting {DELAY_BETWEEN_CALLS}s to stay under rate limit...")
                time.sleep(DELAY_BETWEEN_CALLS)


# ---------------------------------------------------------------------------
# Main evaluation runner
# ---------------------------------------------------------------------------
async def main():
    print("=" * 60)
    print("DeepEval — RAG Grading System Evaluation")
    print("=" * 60)

    # --- Section 1: Grading Answer Relevancy ---
    print("\n[1/2] Building grading test cases (calls real RAG pipeline)...")
    grading_cases = await build_grading_test_cases()

    print("\nEvaluating grading answer relevancy & faithfulness...")
    # Evaluate one metric at a time, one test case at a time.
    # deepeval fires multiple LLM calls per metric internally, so running
    # 3 metrics × 2 test cases in parallel instantly hits the 60 RPM limit.
    grading_metrics = [answer_relevancy, faithfulness, ctx_relevancy]
    _run_sequential(grading_cases, grading_metrics)

    # --- Section 2: Lecture Notes Extraction Quality ---
    print("\n[2/2] Building lecture notes retrieval test cases...")
    lecture_cases = await build_lecture_notes_test_cases()

    print("\nEvaluating lecture notes retrieval (precision & recall)...")
    lecture_metrics = [ctx_precision, ctx_recall, ctx_relevancy]
    _run_sequential(lecture_cases, lecture_metrics)

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
