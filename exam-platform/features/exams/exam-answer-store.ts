"use client";

/* ------------------------------------------------------------------ */
/*  Exam answer store – persists student responses in localStorage    */
/*  so they survive role switches and page refreshes.                 */
/* ------------------------------------------------------------------ */

import type { QuestionResponse } from "@/types";
import { MGMT2110_SEEDED_SUBMISSIONS } from "@/lib/fixtures/mgmt2110";

const ANSWER_STORE_KEY = "hkust_exam_answers_v1";
const EXAM_STATUS_KEY = "hkust_exam_status_v1";
const CHANGE_EVENT = "hkust_exam_answers_change";

/** Status of an exam for a student. */
export interface ExamSubmissionStatus {
  examId: string;
  studentId: string;
  studentName?: string;
  submittedAt: string;
  responses: QuestionResponse[];
}

/* ---- Snapshot cache (required by useSyncExternalStore) ---- */
let _submissionsRaw: string | null = null;
let _submissionsCache: ExamSubmissionStatus[] = [];
let _submissionsInitialized = false;
const EMPTY_SUBMISSIONS: ExamSubmissionStatus[] = [];
const SEEDED_SUBMISSIONS: ExamSubmissionStatus[] = MGMT2110_SEEDED_SUBMISSIONS;

function invalidateCache(): void {
  _submissionsRaw = null; // force re-read on next snapshot
  _submissionsInitialized = false;
}

/* ---- Helpers ---- */

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  invalidateCache();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function mergeSubmissions(
  seeded: ExamSubmissionStatus[],
  local: ExamSubmissionStatus[],
): ExamSubmissionStatus[] {
  const merged = new Map<string, ExamSubmissionStatus>();

  for (const submission of seeded) {
    merged.set(`${submission.examId}:${submission.studentId}`, submission);
  }

  for (const submission of local) {
    merged.set(`${submission.examId}:${submission.studentId}`, submission);
  }

  return Array.from(merged.values());
}

/* ---- Draft answers (during exam) ---- */

function draftKey(examId: string, studentId: string): string {
  return `${ANSWER_STORE_KEY}:${examId}:${studentId}`;
}

export function saveDraftAnswers(
  examId: string,
  studentId: string,
  responses: QuestionResponse[],
): void {
  writeJson(draftKey(examId, studentId), responses);
}

export function loadDraftAnswers(
  examId: string,
  studentId: string,
): QuestionResponse[] {
  return readJson<QuestionResponse[]>(draftKey(examId, studentId), []);
}

/* ---- Submitted exams ---- */

export function submitExamAnswers(
  examId: string,
  studentId: string,
  responses: QuestionResponse[],
): void {
  const status: ExamSubmissionStatus = {
    examId,
    studentId,
    submittedAt: new Date().toISOString(),
    responses,
  };
  const all = readJson<ExamSubmissionStatus[]>(EXAM_STATUS_KEY, []);
  const next = all.filter(
    (s) => !(s.examId === examId && s.studentId === studentId),
  );
  next.push(status);
  writeJson(EXAM_STATUS_KEY, next);
}

export function getExamSubmission(
  examId: string,
  studentId: string,
): ExamSubmissionStatus | null {
  const all = getAllSubmissions();
  return (
    all.find((s) => s.examId === examId && s.studentId === studentId) ?? null
  );
}

export function isExamSubmitted(examId: string, studentId: string): boolean {
  return getExamSubmission(examId, studentId) !== null;
}

/** Cached snapshot – safe for useSyncExternalStore. */
export function getAllSubmissions(): ExamSubmissionStatus[] {
  if (typeof window === "undefined") return SEEDED_SUBMISSIONS;
  const raw = localStorage.getItem(EXAM_STATUS_KEY);
  if (_submissionsInitialized && raw === _submissionsRaw) return _submissionsCache;
  _submissionsRaw = raw;
  const local = raw ? (JSON.parse(raw) as ExamSubmissionStatus[]) : EMPTY_SUBMISSIONS;
  _submissionsCache = mergeSubmissions(SEEDED_SUBMISSIONS, local);
  _submissionsInitialized = true;
  return _submissionsCache;
}

/** Server-side snapshot (stable reference). */
export function getAllSubmissionsServer(): ExamSubmissionStatus[] {
  return SEEDED_SUBMISSIONS;
}

/* ---- Subscribe ---- */

export function subscribeToExamAnswers(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/* ---- Clear all (for reset) ---- */

export function clearAllExamData(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(ANSWER_STORE_KEY) || key === EXAM_STATUS_KEY)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  invalidateCache();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
