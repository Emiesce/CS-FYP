"use client";

import type {
  LiveProctoringStatus,
  LiveViolationLogEntry,
  ProctoringEvent,
  SessionStatus,
} from "@/types";
import { computeRiskScore } from "@/lib/utils/risk-score";

export interface PersistedBucketPoint {
  label: string;
  score: number;
}

export interface PersistedProctoringSession {
  examId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  avatarUrl?: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  sessionStatus: SessionStatus;
  liveStatus: LiveProctoringStatus;
  rollingAverage: number;
  buckets: PersistedBucketPoint[];
  events: ProctoringEvent[];
}

const LIVE_SESSION_KEY = "hkust_exam_live_session_v1";
const COMPLETED_SESSION_KEY = "hkust_exam_completed_sessions_v1";
const CHANNEL_NAME = "hkust_exam_live_session_channel_v1";
const SERVER_LIVE_SESSION: PersistedProctoringSession | null = null;
const SERVER_COMPLETED_SESSIONS: PersistedProctoringSession[] = [];

const rawCache = new Map<string, string | null | undefined>();
const parsedCache = new Map<string, unknown>();

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (rawCache.get(key) === raw && parsedCache.has(key)) {
      return parsedCache.get(key) as T;
    }

    const parsedValue = raw ? (JSON.parse(raw) as T) : fallback;
    rawCache.set(key, raw);
    parsedCache.set(key, parsedValue);
    return parsedValue;
  } catch {
    rawCache.set(key, null);
    parsedCache.set(key, fallback);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(value);
  localStorage.setItem(key, raw);
  rawCache.set(key, raw);
  parsedCache.set(key, value);
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }

  return new BroadcastChannel(CHANNEL_NAME);
}

function broadcastUpdate(): void {
  const channel = getChannel();
  channel?.postMessage({ type: "session-updated" });
  channel?.close();
}

export function subscribeToPersistedProctoringSessions(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === LIVE_SESSION_KEY || event.key === COMPLETED_SESSION_KEY) {
      callback();
    }
  };

  window.addEventListener("storage", onStorage);

  const channel = getChannel();
  const onMessage = () => callback();
  channel?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}

export function readLiveSession(): PersistedProctoringSession | null {
  return readJson<PersistedProctoringSession | null>(LIVE_SESSION_KEY, SERVER_LIVE_SESSION);
}

export function saveLiveSession(session: PersistedProctoringSession): void {
  writeJson(LIVE_SESSION_KEY, session);
  broadcastUpdate();
}

export function readCompletedSessions(): PersistedProctoringSession[] {
  return readJson<PersistedProctoringSession[]>(
    COMPLETED_SESSION_KEY,
    SERVER_COMPLETED_SESSIONS,
  );
}

export function readCompletedSession(
  examId: string,
  studentId: string,
): PersistedProctoringSession | null {
  return (
    readCompletedSessions().find(
      (session) => session.examId === examId && session.studentId === studentId,
    ) ?? null
  );
}

export function saveCompletedSession(session: PersistedProctoringSession): void {
  const next = readCompletedSessions().filter(
    (entry) => !(entry.examId === session.examId && entry.studentId === session.studentId),
  );

  next.unshift(session);
  writeJson(COMPLETED_SESSION_KEY, next.slice(0, 20));
  broadcastUpdate();
}

export function clearPersistedProctoringSessions(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LIVE_SESSION_KEY);
  localStorage.removeItem(COMPLETED_SESSION_KEY);
  rawCache.set(LIVE_SESSION_KEY, null);
  rawCache.set(COMPLETED_SESSION_KEY, null);
  parsedCache.set(LIVE_SESSION_KEY, SERVER_LIVE_SESSION);
  parsedCache.set(COMPLETED_SESSION_KEY, SERVER_COMPLETED_SESSIONS);
  broadcastUpdate();
}

export function subscribeToLiveSession(
  callback: (session: PersistedProctoringSession | null) => void,
): () => void {
  const unsubscribe = subscribeToPersistedProctoringSessions(() => callback(readLiveSession()));
  callback(readLiveSession());
  return unsubscribe;
}

export function buildLiveViolationEntries(
  session: PersistedProctoringSession,
): LiveViolationLogEntry[] {
  const sortedEvents = [...session.events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  return sortedEvents.map((event, index) => ({
    id: event.id,
    examId: event.examId,
    studentId: event.studentId,
    studentName: session.studentName,
    studentNumber: session.studentNumber,
    timestamp: event.timestamp,
    eventType: event.type,
    message: event.message,
    runningRiskScore: computeRiskScore(sortedEvents.slice(0, index + 1)),
  }));
}
