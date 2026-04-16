/**
 * Exam service – data helpers for exam authoring and student attempts.
 *
 * Provides question-creation defaults, frontend API wrappers,
 * and attempt state management utilities.
 */

import type {
  ExamDefinition,
  ExamQuestion,
  QuestionType,
  McqOption,
  QuestionResponse,
  QuestionNavItem,
  QuestionStatus,
} from "@/types";
import { uid } from "@/lib/utils/format";
import { BACKEND_API_BASE } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Question creation defaults                                        */
/* ------------------------------------------------------------------ */

export function createDefaultMcqOption(): McqOption {
  return { id: uid(), label: "", isCorrect: false };
}

export function createDefaultQuestion(
  type: QuestionType,
  order: number,
): ExamQuestion {
  const base = {
    id: uid(),
    order,
    title: `Question ${order}`,
    prompt: "",
    points: 10,
    required: true,
    rubric: undefined,
  };

  switch (type) {
    case "mcq":
      return {
        ...base,
        type: "mcq",
        options: [createDefaultMcqOption(), createDefaultMcqOption()],
        allowMultiple: false,
      };
    case "short_answer":
      return { ...base, type: "short_answer", maxLength: 500, placeholder: "" };
    case "long_answer":
      return { ...base, type: "long_answer", expectedLengthHint: "200-400 words" };
    case "essay":
      return { ...base, type: "essay", expectedLengthHint: "500-1000 words" };
    case "coding":
      return {
        ...base,
        type: "coding",
        language: "python",
        starterCode: "# Write your solution here\n",
        constraints: "",
      };
    case "mathematics":
      return { ...base, type: "mathematics", answerFormatHint: "" };
  }
}

export function computeTotalPoints(questions: ExamQuestion[]): number {
  return questions.reduce((sum, q) => sum + q.points, 0);
}

/* ------------------------------------------------------------------ */
/*  Navigation state helpers                                          */
/* ------------------------------------------------------------------ */

export function buildNavItems(
  questions: ExamQuestion[],
  responses: QuestionResponse[],
  flaggedIds: string[],
): QuestionNavItem[] {
  const answeredSet = new Set(responses.filter((r) => {
    if (Array.isArray(r.value)) return r.value.length > 0;
    return r.value.trim().length > 0;
  }).map((r) => r.questionId));

  return questions.map((q) => {
    let status: QuestionStatus = "unanswered";
    if (flaggedIds.includes(q.id)) status = "flagged";
    else if (answeredSet.has(q.id)) status = "answered";
    return { questionId: q.id, order: q.order, status };
  });
}

export function getResponseForQuestion(
  responses: QuestionResponse[],
  questionId: string,
): QuestionResponse | undefined {
  return responses.find((r) => r.questionId === questionId);
}

export function upsertResponse(
  responses: QuestionResponse[],
  incoming: QuestionResponse,
): QuestionResponse[] {
  const idx = responses.findIndex((r) => r.questionId === incoming.questionId);
  if (idx >= 0) {
    const next = [...responses];
    next[idx] = incoming;
    return next;
  }
  return [...responses, incoming];
}

/* ------------------------------------------------------------------ */
/*  API wrappers (thin – call the FastAPI exam backend)               */
/* ------------------------------------------------------------------ */

const API_BASE = BACKEND_API_BASE;

export async function fetchExamDefinition(examId: string): Promise<ExamDefinition | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exams/${examId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveExamDefinition(
  examId: string | null,
  data: Omit<ExamDefinition, "id" | "totalPoints" | "createdAt" | "updatedAt">,
): Promise<ExamDefinition | null> {
  try {
    const url = examId ? `${API_BASE}/api/exams/${examId}` : `${API_BASE}/api/exams`;
    const method = examId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
