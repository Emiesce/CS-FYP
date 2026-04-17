/* ------------------------------------------------------------------ */
/*  Grading feature – API service layer                               */
/* ------------------------------------------------------------------ */

import type {
  GradingRunRequest,
  ReviewSubmitPayload,
  RubricGeneratePayload,
} from "./grading-types";
import type { GradingRun, StructuredRubric } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/* ---- Rubric generation ---- */

export async function generateRubric(
  payload: RubricGeneratePayload,
): Promise<{ rubric: StructuredRubric; generatedBy: string; latencyMs: number }> {
  const res = await fetch(`${BASE}/api/grading/rubric/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json(res);
}

/* ---- Grading runs ---- */

export async function startGradingRun(
  examId: string,
  payload: GradingRunRequest,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/grading/exams/${examId}/attempts/${payload.attemptId}/run`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  );
  return json(res);
}

export async function getGradingRun(
  examId: string,
  attemptId: string,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/grading/exams/${examId}/attempts/${attemptId}`,
  );
  return json(res);
}

/* ---- Reviews ---- */

export async function submitReview(
  examId: string,
  attemptId: string,
  payload: ReviewSubmitPayload,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/grading/exams/${examId}/attempts/${attemptId}/review`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  );
  return json(res);
}
