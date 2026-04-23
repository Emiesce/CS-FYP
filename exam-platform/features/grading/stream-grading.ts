/* ------------------------------------------------------------------ */
/*  Shared SSE grading stream helper                                  */
/* ------------------------------------------------------------------ */

import { BACKEND_API_BASE } from "@/lib/constants";
import { getSessionToken } from "@/features/auth";
import { apiFetch } from "@/lib/utils/api-fetch";

export interface StreamingAnswerPayload {
  question_id: string;
  value: string;
}

export interface StreamingCriterionResult {
  criterion_id: string;
  criterion_label: string;
  score: number;
  max_points: number;
  rationale: string;
  evidence_spans: unknown[];
  override_score?: number | null;
  reviewer_rationale?: string | null;
}

export interface StreamingQuestionResult {
  question_id: string;
  question_type: string;
  raw_score: number;
  max_points: number;
  normalized_score: number;
  rationale: string;
  lane: string;
  model: string | null;
  status: string;
  evidence_spans: unknown[];
  criterion_results: StreamingCriterionResult[];
}

export interface StreamingGradingRun {
  id: string;
  status: string;
  total_score: number;
  max_total_points?: number;
  max_possible?: number;
  question_results: StreamingQuestionResult[];
  started_at?: string;
  completed_at?: string | null;
}

interface StreamGradingRunOptions {
  examId: string;
  studentId: string;
  answers: StreamingAnswerPayload[];
  signal?: AbortSignal;
  onResult?: (result: StreamingQuestionResult) => void;
  onDone?: (run: StreamingGradingRun) => void;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function streamGradingRun({
  examId,
  studentId,
  answers,
  signal,
  onResult,
  onDone,
}: StreamGradingRunOptions): Promise<void> {
  const res = await apiFetch(`${BACKEND_API_BASE}/api/test-grading/submit-stream`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      exam_id: examId,
      student_id: studentId,
      answers,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  let dataStr = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6);
      } else if (line === "" && eventType && dataStr) {
        const parsed = JSON.parse(dataStr) as
          | StreamingQuestionResult
          | StreamingGradingRun
          | { error?: string };

        if (eventType === "result") {
          onResult?.(parsed as StreamingQuestionResult);
        } else if (eventType === "done") {
          onDone?.(parsed as StreamingGradingRun);
          return;
        } else if (eventType === "error") {
          throw new Error((parsed as { error?: string }).error ?? "Grading error");
        }

        eventType = "";
        dataStr = "";
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Clear all grading results from the backend in-memory store        */
/* ------------------------------------------------------------------ */

export async function clearAllGradingResults(): Promise<{ cleared: number; message: string }> {
  const res = await apiFetch(`${BACKEND_API_BASE}/api/test-grading/results`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to clear results from server");
  return res.json();
}
