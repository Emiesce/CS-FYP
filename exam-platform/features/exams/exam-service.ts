/**
 * Exam service – data helpers for exam authoring and student attempts.
 *
 * Provides question-creation defaults, frontend API wrappers,
 * and attempt state management utilities.
 */

import type {
  ExamAttempt,
  ExamDefinition,
  ExamQuestion,
  QuestionType,
  McqOption,
  QuestionResponse,
  QuestionNavItem,
  QuestionStatus,
} from "@/types";
import { getSessionToken } from "@/features/auth";
import { uid } from "@/lib/utils/format";
import { BACKEND_API_BASE } from "@/lib/constants";
import { apiFetch } from "@/lib/utils/api-fetch";

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
    topicIds: [],
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

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface BackendAttemptResponse {
  id: string;
  exam_id: string;
  student_id: string;
  status: "in_progress" | "submitted" | "timed_out";
  started_at: string;
  submitted_at: string | null;
  responses: {
    question_id: string;
    question_type: QuestionType;
    value: string | string[];
    answered_at: string;
  }[];
  current_question_index: number;
  flagged_question_ids: string[];
}

interface BackendExamDefinitionResponse {
  id: string;
  course_code: string;
  course_name: string;
  title: string;
  date: string;
  start_time: string;
  duration_seconds: number;
  location: string;
  instructions: string;
  total_points: number;
  created_at: string;
  updated_at: string;
  questions: Array<{
    id: string;
    order: number;
    title: string;
    prompt: string;
    points: number;
    required: boolean;
    topic_ids?: string[];
    rubric?: {
      text: string;
      attachment?: {
        file_name: string;
        file_size: number;
        mime_type: string;
      };
    };
    type_data:
      | {
          type: "mcq";
          options: Array<{
            id: string;
            label: string;
            is_correct: boolean;
          }>;
          allow_multiple: boolean;
        }
      | {
          type: "short_answer";
          max_length?: number;
          placeholder?: string;
        }
      | {
          type: "long_answer";
          expected_length_hint?: string;
        }
      | {
          type: "essay";
          expected_length_hint?: string;
        }
      | {
          type: "coding";
          language: string;
          starter_code: string;
          constraints?: string;
        }
      | {
          type: "mathematics";
          answer_format_hint?: string;
        };
  }>;
}

type SaveDraftPayload = Pick<
  ExamAttempt,
  "responses" | "currentQuestionIndex" | "flaggedQuestionIds"
>;

function toBackendResponses(responses: QuestionResponse[]): BackendAttemptResponse["responses"] {
  return responses.map((response) => ({
    question_id: response.questionId,
    question_type: response.questionType,
    value: response.value,
    answered_at: response.answeredAt,
  }));
}

function normalizeAttempt(raw: BackendAttemptResponse): ExamAttempt {
  return {
    id: raw.id,
    examId: raw.exam_id,
    studentId: raw.student_id,
    status: raw.status,
    startedAt: raw.started_at,
    submittedAt: raw.submitted_at ?? undefined,
    responses: raw.responses.map((response) => ({
      questionId: response.question_id,
      questionType: response.question_type,
      value: response.value,
      answeredAt: response.answered_at,
    })),
    currentQuestionIndex: raw.current_question_index,
    flaggedQuestionIds: raw.flagged_question_ids,
  };
}

function normalizeExamQuestion(
  question: BackendExamDefinitionResponse["questions"][number],
): ExamQuestion {
  const base = {
    id: question.id,
    order: question.order,
    title: question.title,
    prompt: question.prompt,
    points: question.points,
    required: question.required,
    topicIds: question.topic_ids ?? [],
    rubric: question.rubric
      ? {
          text: question.rubric.text,
          attachment: question.rubric.attachment
            ? {
                fileName: question.rubric.attachment.file_name,
                fileSize: question.rubric.attachment.file_size,
                mimeType: question.rubric.attachment.mime_type,
              }
            : undefined,
        }
      : undefined,
  };

  switch (question.type_data.type) {
    case "mcq":
      return {
        ...base,
        type: "mcq",
        options: question.type_data.options.map((option) => ({
          id: option.id,
          label: option.label,
          isCorrect: option.is_correct,
        })),
        allowMultiple: question.type_data.allow_multiple,
      };
    case "short_answer":
      return {
        ...base,
        type: "short_answer",
        maxLength: question.type_data.max_length,
        placeholder: question.type_data.placeholder,
      };
    case "long_answer":
      return {
        ...base,
        type: "long_answer",
        expectedLengthHint: question.type_data.expected_length_hint,
      };
    case "essay":
      return {
        ...base,
        type: "essay",
        expectedLengthHint: question.type_data.expected_length_hint,
      };
    case "coding":
      return {
        ...base,
        type: "coding",
        language: question.type_data.language,
        starterCode: question.type_data.starter_code,
        constraints: question.type_data.constraints,
      };
    case "mathematics":
      return {
        ...base,
        type: "mathematics",
        answerFormatHint: question.type_data.answer_format_hint,
      };
  }
}

function normalizeExamDefinition(raw: BackendExamDefinitionResponse): ExamDefinition {
  return {
    id: raw.id,
    courseCode: raw.course_code,
    courseName: raw.course_name,
    title: raw.title,
    date: raw.date,
    startTime: raw.start_time,
    durationSeconds: raw.duration_seconds,
    location: raw.location,
    instructions: raw.instructions,
    questions: raw.questions.map(normalizeExamQuestion),
    totalPoints: raw.total_points,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function serializeExamQuestion(question: ExamQuestion): Record<string, unknown> {
  const base = {
    id: question.id,
    order: question.order,
    title: question.title,
    prompt: question.prompt,
    points: question.points,
    required: question.required,
    topic_ids: question.topicIds ?? [],
    rubric: question.rubric
      ? {
          text: question.rubric.text,
          attachment: question.rubric.attachment
            ? {
                file_name: question.rubric.attachment.fileName,
                file_size: question.rubric.attachment.fileSize,
                mime_type: question.rubric.attachment.mimeType,
              }
            : undefined,
        }
      : undefined,
  };

  switch (question.type) {
    case "mcq":
      return {
        ...base,
        type_data: {
          type: "mcq",
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            is_correct: option.isCorrect,
          })),
          allow_multiple: question.allowMultiple,
        },
      };
    case "short_answer":
      return {
        ...base,
        type_data: {
          type: "short_answer",
          max_length: question.maxLength,
          placeholder: question.placeholder,
        },
      };
    case "long_answer":
      return {
        ...base,
        type_data: {
          type: "long_answer",
          expected_length_hint: question.expectedLengthHint,
        },
      };
    case "essay":
      return {
        ...base,
        type_data: {
          type: "essay",
          expected_length_hint: question.expectedLengthHint,
        },
      };
    case "coding":
      return {
        ...base,
        type_data: {
          type: "coding",
          language: question.language,
          starter_code: question.starterCode,
          constraints: question.constraints,
        },
      };
    case "mathematics":
      return {
        ...base,
        type_data: {
          type: "mathematics",
          answer_format_hint: question.answerFormatHint,
        },
      };
  }
}

function serializeExamDefinition(
  data: Omit<ExamDefinition, "id" | "totalPoints" | "createdAt" | "updatedAt">,
): Record<string, unknown> {
  return {
    course_code: data.courseCode,
    course_name: data.courseName,
    title: data.title,
    date: data.date,
    start_time: data.startTime,
    duration_seconds: data.durationSeconds,
    location: data.location,
    instructions: data.instructions,
    questions: data.questions.map(serializeExamQuestion),
  };
}

// ---- Exam definition helpers ----------------------------------------

export async function fetchExamDefinition(examId: string): Promise<ExamDefinition | null> {
  try {
    const res = await apiFetch(`${API_BASE}/api/exams/${examId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendExamDefinitionResponse;
    return normalizeExamDefinition(raw);
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
    const res = await apiFetch(url, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(serializeExamDefinition(data)),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendExamDefinitionResponse;
    return normalizeExamDefinition(raw);
  } catch {
    return null;
  }
}

// ---- Attempt helpers ------------------------------------------------

export async function startAttempt(
  examId: string,
  studentId: string,
): Promise<ExamAttempt | null> {
  try {
    const res = await apiFetch(`${API_BASE}/api/exams/${examId}/attempt`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        exam_id: examId,
        student_id: studentId,
        responses: [],
        current_question_index: 0,
        flagged_question_ids: [],
      }),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendAttemptResponse;
    return normalizeAttempt(raw);
  } catch {
    return null;
  }
}

export async function fetchAttempt(
  examId: string,
  studentId: string,
): Promise<ExamAttempt | null> {
  try {
    const res = await apiFetch(
      `${API_BASE}/api/exams/${examId}/attempt?student_id=${encodeURIComponent(studentId)}`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendAttemptResponse;
    return normalizeAttempt(raw);
  } catch {
    return null;
  }
}

export async function saveDraft(
  examId: string,
  studentId: string,
  payload: SaveDraftPayload,
): Promise<ExamAttempt | null> {
  try {
    const res = await apiFetch(`${API_BASE}/api/exams/${examId}/attempt`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        exam_id: examId,
        student_id: studentId,
        responses: toBackendResponses(payload.responses),
        current_question_index: payload.currentQuestionIndex,
        flagged_question_ids: payload.flaggedQuestionIds,
      }),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendAttemptResponse;
    return normalizeAttempt(raw);
  } catch {
    return null;
  }
}

export async function submitAttempt(
  examId: string,
  studentId: string,
): Promise<ExamAttempt | null> {
  try {
    const res = await apiFetch(
      `${API_BASE}/api/exams/${examId}/submit?student_id=${encodeURIComponent(studentId)}`,
      {
        method: "POST",
        headers: authHeaders(),
      },
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as BackendAttemptResponse;
    return normalizeAttempt(raw);
  } catch {
    return null;
  }
}

export async function listAttempts(examId: string): Promise<ExamAttempt[]> {
  try {
    const res = await apiFetch(`${API_BASE}/api/exams/${examId}/attempts`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as BackendAttemptResponse[];
    return raw.map(normalizeAttempt);
  } catch {
    return [];
  }
}
