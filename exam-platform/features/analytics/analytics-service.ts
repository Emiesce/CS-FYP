/* ------------------------------------------------------------------ */
/*  Analytics feature – API service layer                             */
/* ------------------------------------------------------------------ */

import type {
  ExamAnalyticsSnapshot,
  AnalyticsChatMessage,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ---- snake_case → camelCase mapper ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      out[camel] = snakeToCamel(v);
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

/* ---- Analytics snapshot ---- */

export async function getAnalyticsSnapshot(
  examId: string,
): Promise<ExamAnalyticsSnapshot> {
  const res = await fetch(`${BASE}/api/analytics/exams/${examId}/snapshot`);
  const raw = await json<unknown>(res);
  return snakeToCamel(raw) as ExamAnalyticsSnapshot;
}

/* ---- Analytics chat ---- */

export async function sendAnalyticsChat(
  examId: string,
  message: string,
  history: AnalyticsChatMessage[],
): Promise<{ reply: string; timestamp: string }> {
  const res = await fetch(`${BASE}/api/analytics/exams/${examId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.map((h) => ({ role: h.role, content: h.content })),
    }),
  });
  return json(res);
}

/* ---- Proctoring sync ---- */

export async function syncProctoringForAnalytics(
  examId: string,
  payload: {
    studentId: string;
    studentName: string;
    riskScore: number;
    highSeverityEventCount: number;
    eventCount: number;
  },
): Promise<void> {
  await fetch(`${BASE}/api/analytics/exams/${examId}/proctoring-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exam_id: examId,
      student_id: payload.studentId,
      student_name: payload.studentName,
      risk_score: payload.riskScore,
      high_severity_event_count: payload.highSeverityEventCount,
      event_count: payload.eventCount,
    }),
  });
}
