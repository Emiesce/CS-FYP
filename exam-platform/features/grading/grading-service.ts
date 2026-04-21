/* ------------------------------------------------------------------ */
/*  Grading feature – API service layer                               */
/* ------------------------------------------------------------------ */

import type {
  GradingRunRequest,
  ReviewSubmitPayload,
  RubricGeneratePayload,
} from "./grading-types";
import type { GradingRun, StructuredRubric } from "@/types";
import { getSessionToken } from "@/features/auth";
import { BACKEND_API_BASE } from "@/lib/constants";

const BASE = BACKEND_API_BASE;

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ---- snake_case → camelCase mapper ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = snakeToCamel(v);
    }
    return out;
  }
  return obj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function camelToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const snake = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      out[snake] = camelToSnake(v);
    }
    return out;
  }
  return obj;
}

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
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(camelToSnake(payload)),
  });
  const raw = await json<unknown>(res);
  return snakeToCamel(raw) as { rubric: StructuredRubric; generatedBy: string; latencyMs: number };
}

/* ---- Grading runs ---- */

export async function startGradingRun(
  examId: string,
  payload: GradingRunRequest,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/grading/exams/${examId}/attempts/${payload.attemptId}/run`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(camelToSnake(payload)),
    },
  );
  return json(res);
}

export async function getGradingRun(
  examId: string,
  runId: string,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/test-grading/results/${runId}`,
    {
      headers: authHeaders(),
    },
  );
  const raw = await json<unknown>(res);
  return snakeToCamel(raw) as GradingRun;
}

/* ---- Reviews ---- */

export async function submitReview(
  examId: string,
  runId: string,
  payload: ReviewSubmitPayload,
): Promise<GradingRun> {
  const res = await fetch(
    `${BASE}/api/test-grading/review/${runId}`,
    {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(camelToSnake(payload)),
    },
  );
  const raw = await json<unknown>(res);
  return snakeToCamel(raw) as GradingRun;
}
