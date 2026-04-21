"use client";

/* ------------------------------------------------------------------ */
/*  Exam attempt cache – frontend mirror of backend-persisted attempts */
/* ------------------------------------------------------------------ */

import type { ExamAttempt, QuestionResponse } from "@/types";
import { fetchAttempt, listAttempts } from "@/features/exams/exam-service";

const CHANGE_EVENT = "hkust_exam_answers_change";

/** Status of an exam for a student. */
export interface ExamSubmissionStatus {
  attemptId?: string;
  examId: string;
  studentId: string;
  studentName?: string;
  submittedAt: string;
  responses: QuestionResponse[];
}

const SEEDED_SUBMISSIONS: ExamSubmissionStatus[] = [];
const SEEDED_KEYS = new Set<string>();
const submissionCache = new Map<string, ExamSubmissionStatus>();
const attemptCache = new Map<string, ExamAttempt>();

function cacheKey(examId: string, studentId: string): string {
  return `${examId}:${studentId}`;
}

function emitChange(): void {
  cachedSubmissions = null;
  cachedSubmissions = null;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function attemptToSubmission(attempt: ExamAttempt): ExamSubmissionStatus | null {
  if (attempt.status !== "submitted" && attempt.status !== "timed_out") {
    return null;
  }

  return {
    attemptId: attempt.id,
    examId: attempt.examId,
    studentId: attempt.studentId,
    submittedAt: attempt.submittedAt ?? attempt.startedAt,
    responses: attempt.responses,
  };
}

function syncAttemptIntoCache(attempt: ExamAttempt): void {
  const key = cacheKey(attempt.examId, attempt.studentId);
  attemptCache.set(key, attempt);

  const submission = attemptToSubmission(attempt);
  if (submission) {
    submissionCache.set(key, submission);
  } else if (!SEEDED_KEYS.has(key)) {
    submissionCache.delete(key);
  }
}

function clearAttemptFromCache(examId: string, studentId: string): void {
  const key = cacheKey(examId, studentId);
  attemptCache.delete(key);
  if (!SEEDED_KEYS.has(key)) {
    submissionCache.delete(key);
  }
}

export async function refreshStudentAttempt(
  examId: string,
  studentId: string,
): Promise<ExamAttempt | null> {
  const attempt = await fetchAttempt(examId, studentId);
  if (attempt) {
    syncAttemptIntoCache(attempt);
  } else {
    clearAttemptFromCache(examId, studentId);
  }
  emitChange();
  return attempt;
}

export async function refreshExamSubmissions(
  examId: string,
): Promise<ExamSubmissionStatus[]> {
  const attempts = await listAttempts(examId);
  const staleKeys: string[] = [];

  for (const key of submissionCache.keys()) {
    if (key.startsWith(`${examId}:`) && !SEEDED_KEYS.has(key)) {
      staleKeys.push(key);
    }
  }

  staleKeys.forEach((key) => submissionCache.delete(key));

  for (const attempt of attempts) {
    syncAttemptIntoCache(attempt);
  }

  emitChange();
  return getAllSubmissions().filter((submission) => submission.examId === examId);
}

export function getExamSubmission(
  examId: string,
  studentId: string,
): ExamSubmissionStatus | null {
  return submissionCache.get(cacheKey(examId, studentId)) ?? null;
}

export function isExamSubmitted(examId: string, studentId: string): boolean {
  return getExamSubmission(examId, studentId) !== null;
}

export function getAttemptSnapshot(
  examId: string,
  studentId: string,
): ExamAttempt | null {
  return attemptCache.get(cacheKey(examId, studentId)) ?? null;
}

/** Cached snapshot – safe for useSyncExternalStore. */

let cachedSubmissions: ExamSubmissionStatus[] | null = null;

export function getAllSubmissions(): ExamSubmissionStatus[] {
  if (cachedSubmissions) return cachedSubmissions;
  
  cachedSubmissions = Array.from(submissionCache.values()).sort(
    (left, right) =>
      new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime(),
  );
  return cachedSubmissions;
}


/** Server-side snapshot (stable reference). */
export function getAllSubmissionsServer(): ExamSubmissionStatus[] {
  return [];
}

/* ---- Subscribe ---- */

export function subscribeToExamAnswers(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

/* ---- Clear volatile cache (for reset) ---- */

export function clearAllExamData(): void {
  attemptCache.clear();

  for (const key of Array.from(submissionCache.keys())) {
    if (!SEEDED_KEYS.has(key)) {
      submissionCache.delete(key);
    }
  }

  emitChange();
}
