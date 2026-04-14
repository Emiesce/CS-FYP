#!/usr/bin/env python3
"""
Scale test for the grading API.

Tests /grade-batch with varying numbers of students and measures:
  - Total wall-clock time
  - Per-student average time
  - Success / failure counts
  - Throughput (students/minute)

Usage:
    python scale_test.py                        # default: 5, 10, 20 students
    python scale_test.py --sizes 5 10           # custom batch sizes
    python scale_test.py --sizes 10 --rubric rubric-1
    python scale_test.py --sizes 30 --rpm 30    # lower RPM limit
"""

import argparse
import asyncio
import json
import random
import time
import urllib.request
import urllib.error
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

API_BASE = "http://localhost:5000"
DEFAULT_RUBRIC_ID = "rubric-1"
DEFAULT_BATCH_SIZES = [5, 10, 20]
DEFAULT_RPM = 55

# ─── Sample answer pool ───────────────────────────────────────────────────────
# Varied answers so each student gets a slightly different response

ANSWER_POOL_Q1 = [
    "The planning fallacy is a cognitive bias where people underestimate the time and cost of future tasks. "
    "It was identified by Kahneman and Tversky. People focus on best-case scenarios and ignore past experience.",

    "Planning fallacy means thinking a task will take less time than it actually does. "
    "I have experienced this when doing assignments. The main reason is optimism.",

    "The planning fallacy refers to the tendency to underestimate how long a task will take. "
    "It happens because people are overly optimistic and do not consider past experiences. "
    "For example, students often think they can finish an assignment in one day but end up taking three days.",

    "Planning fallacy is when you underestimate the time needed for a project. "
    "Causes include optimism bias, inside view thinking, and social pressure to commit to short timelines.",

    "The planning fallacy is a well-documented cognitive bias. People systematically underestimate "
    "the time, cost, and risks of future actions while overestimating the benefits. "
    "Kahneman and Tversky first described it in 1979. Key causes are optimism bias and the inside view.",
]

ANSWER_POOL_Q2 = [
    "Psychological factors include optimism bias where people think things will go better than they usually do. "
    "There is also the inside view problem where people focus too much on the specific plan.",

    "People are optimistic and do not think about problems that might happen. "
    "They also forget about past failures and only remember when things went well.",

    "Several psychological factors contribute to the planning fallacy. First, optimism bias causes people "
    "to believe they are less likely to experience negative events. Second, the focusing illusion makes "
    "people concentrate on the task itself while ignoring external factors.",

    "Ego depletion can play a role as people become less careful in their estimates when tired. "
    "Social pressure from supervisors or peers can also cause people to give overly optimistic estimates.",

    "The main psychological factors are: optimism bias, anchoring bias where initial estimates become "
    "fixed reference points, availability heuristic where people recall successes more easily than failures, "
    "and motivated reasoning where people unconsciously favor information supporting their desired timeline.",
]


def make_submission(student_index: int, rubric_id: str) -> dict:
    """Generate a single student submission payload."""
    student_id = f"test-student-{student_index:04d}"
    student_name = f"Test Student {student_index}"

    # Pick answers from pool (with some variation)
    q1_answer = ANSWER_POOL_Q1[student_index % len(ANSWER_POOL_Q1)]
    q2_answer = ANSWER_POOL_Q2[student_index % len(ANSWER_POOL_Q2)]

    # Add slight variation so answers aren't identical
    q1_answer += f" (Student {student_index} perspective.)"

    return {
        "student_id": student_id,
        "student_name": student_name,
        "marking_scheme_id": rubric_id,
        "assignment_id": f"scale-test-{datetime.now().strftime('%Y%m%d')}",
        "course_id": "TEST",
        "submitted_at": datetime.utcnow().isoformat() + "Z",
        "question_answers": {
            "q1": q1_answer,
            "q2": q2_answer,
        },
    }


def post_json(url: str, payload: dict, timeout: int = 600) -> dict:
    """Synchronous HTTP POST with JSON body."""
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_health() -> bool:
    """Verify the API is reachable before running tests."""
    try:
        with urllib.request.urlopen(f"{API_BASE}/health", timeout=5) as resp:
            data = json.loads(resp.read())
            return data.get("status") == "healthy"
    except Exception as e:
        print(f"  Health check failed: {e}")
        return False


def run_batch(batch_size: int, rubric_id: str, rpm: int) -> dict:
    """Run a single batch test and return timing + result summary."""
    submissions = [make_submission(i, rubric_id) for i in range(batch_size)]
    payload = {"submissions": submissions, "requests_per_minute": rpm}

    print(f"\n  Sending {batch_size} students to /grade-batch ...")
    start = time.perf_counter()

    try:
        result = post_json(f"{API_BASE}/grade-batch", payload)
        elapsed = time.perf_counter() - start

        succeeded = result.get("succeeded", 0)
        failed = result.get("failed", 0)
        errors = result.get("errors", [])

        avg_per_student = elapsed / batch_size if batch_size else 0
        throughput = (succeeded / elapsed) * 60 if elapsed > 0 else 0

        return {
            "batch_size": batch_size,
            "elapsed_s": round(elapsed, 2),
            "succeeded": succeeded,
            "failed": failed,
            "avg_per_student_s": round(avg_per_student, 2),
            "throughput_per_min": round(throughput, 1),
            "errors": errors[:3],  # show first 3 errors only
            "ok": True,
        }

    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        body = e.read().decode("utf-8", errors="replace")
        return {
            "batch_size": batch_size,
            "elapsed_s": round(elapsed, 2),
            "succeeded": 0,
            "failed": batch_size,
            "error": f"HTTP {e.code}: {body[:200]}",
            "ok": False,
        }
    except Exception as e:
        elapsed = time.perf_counter() - start
        return {
            "batch_size": batch_size,
            "elapsed_s": round(elapsed, 2),
            "succeeded": 0,
            "failed": batch_size,
            "error": str(e),
            "ok": False,
        }


def print_result(r: dict):
    if not r["ok"]:
        print(f"  ✗ FAILED after {r['elapsed_s']}s — {r.get('error', 'unknown error')}")
        return

    print(f"  ✓ {r['succeeded']}/{r['batch_size']} succeeded in {r['elapsed_s']}s")
    print(f"    avg per student : {r['avg_per_student_s']}s")
    print(f"    throughput      : {r['throughput_per_min']} students/min")
    if r["failed"]:
        print(f"    failed          : {r['failed']}")
        for err in r["errors"]:
            print(f"      - {err.get('student_id')}: {err.get('error', '')[:100]}")


def print_summary(results: list):
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"{'Batch':>8}  {'Time(s)':>8}  {'OK':>5}  {'Fail':>5}  {'Avg/s':>7}  {'TPM':>7}")
    print("-" * 60)
    for r in results:
        if r["ok"]:
            print(
                f"{r['batch_size']:>8}  {r['elapsed_s']:>8}  "
                f"{r['succeeded']:>5}  {r['failed']:>5}  "
                f"{r['avg_per_student_s']:>7}  {r['throughput_per_min']:>7}"
            )
        else:
            print(f"{r['batch_size']:>8}  {r['elapsed_s']:>8}  {'FAILED':>5}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Scale test for grading API")
    parser.add_argument(
        "--sizes", nargs="+", type=int, default=DEFAULT_BATCH_SIZES,
        help=f"Batch sizes to test (default: {DEFAULT_BATCH_SIZES})"
    )
    parser.add_argument(
        "--rubric", default=DEFAULT_RUBRIC_ID,
        help=f"Rubric ID to use (default: {DEFAULT_RUBRIC_ID})"
    )
    parser.add_argument(
        "--rpm", type=int, default=DEFAULT_RPM,
        help=f"Requests per minute limit (default: {DEFAULT_RPM})"
    )
    parser.add_argument(
        "--pause", type=int, default=5,
        help="Seconds to pause between batches (default: 5)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Grading API Scale Test")
    print("=" * 60)
    print(f"  API base  : {API_BASE}")
    print(f"  Rubric    : {args.rubric}")
    print(f"  RPM limit : {args.rpm}")
    print(f"  Batches   : {args.sizes}")
    print()

    # Health check
    print("Checking API health...")
    if not check_health():
        print("ERROR: API is not reachable. Make sure grading_api.py is running.")
        return
    print("  API is healthy.\n")

    results = []
    for i, size in enumerate(args.sizes):
        print(f"[{i+1}/{len(args.sizes)}] Batch size: {size}")
        r = run_batch(size, args.rubric, args.rpm)
        print_result(r)
        results.append(r)

        if i < len(args.sizes) - 1:
            print(f"  Pausing {args.pause}s before next batch...")
            time.sleep(args.pause)

    print_summary(results)

    # Save results to file
    out_file = f"scale_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_file}")


if __name__ == "__main__":
    main()
