"use client";

import type {
  LiveProctoringStatus,
  LiveViolationLogEntry,
  ProctoringEvent,
  SessionStatus,
} from "@/types";
import { getSessionToken } from "@/features/auth";
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
  riskScore?: number;
  rollingAverage: number;
  buckets: PersistedBucketPoint[];
  events: ProctoringEvent[];
}

interface BackendProctoringEvent {
  id: string;
  exam_id: string;
  student_id: string;
  event_type: ProctoringEvent["type"];
  severity: number;
  timestamp: string;
  started_at?: string | null;
  duration_seconds?: number | null;
  message: string;
  has_evidence_clip?: string | null;
}

interface BackendProctoringSession {
  id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  avatar_url?: string | null;
  session_status: string;
  started_at: string;
  updated_at: string;
  ended_at?: string | null;
  risk_score: number;
  rolling_average: number;
  event_count: number;
  high_severity_event_count: number;
  live_status?: Partial<LiveProctoringStatus> | null;
  events: BackendProctoringEvent[];
  buckets: PersistedBucketPoint[];
}

const LIVE_SESSION_KEY = "hkust_exam_live_session_v1";
const COMPLETED_SESSION_KEY = "hkust_exam_completed_sessions_v1";
const CHANNEL_NAME = "hkust_exam_live_session_channel_v1";
const SERVER_LIVE_SESSION: PersistedProctoringSession | null = null;
const SERVER_COMPLETED_SESSIONS: PersistedProctoringSession[] = [];
const BACKEND_SYNC_URL = "/api/proctoring/sync";

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

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeSessionStatus(status: string | null | undefined): SessionStatus {
  if (status === "completed") return "completed";
  if (status === "warning") return "warning";
  if (status === "terminated" || status === "aborted") return "terminated";
  return "active";
}

function normalizeLiveStatus(
  status: Partial<LiveProctoringStatus> | null | undefined,
): LiveProctoringStatus {
  return {
    gazeStatus: status?.gazeStatus === "away" ? "away" : "normal",
    cameraStatus:
      status?.cameraStatus === "blocked" || status?.cameraStatus === "unavailable"
        ? status.cameraStatus
        : "clear",
    faceCount: typeof status?.faceCount === "number" ? status.faceCount : 1,
    screenStatus: status?.screenStatus === "monitoring" ? "monitoring" : "inactive",
    focusStatus: status?.focusStatus === "background" ? "background" : "focused",
  };
}

function fromBackendEvent(event: BackendProctoringEvent): ProctoringEvent {
  return {
    id: event.id,
    examId: event.exam_id,
    studentId: event.student_id,
    type: event.event_type,
    severity: event.severity,
    timestamp: event.timestamp,
    startedAt: event.started_at ?? undefined,
    durationSeconds: event.duration_seconds ?? undefined,
    message: event.message,
    evidenceClipMimeType: event.has_evidence_clip ?? undefined,
  };
}

function fromBackendSession(session: BackendProctoringSession): PersistedProctoringSession {
  return {
    examId: session.exam_id,
    studentId: session.student_id,
    studentName: session.student_name,
    studentNumber: session.student_number,
    avatarUrl: session.avatar_url ?? undefined,
    startedAt: session.started_at,
    updatedAt: session.updated_at,
    endedAt: session.ended_at ?? undefined,
    sessionStatus: normalizeSessionStatus(session.session_status),
    liveStatus: normalizeLiveStatus(session.live_status),
    riskScore: session.risk_score,
    rollingAverage: session.rolling_average,
    buckets: Array.isArray(session.buckets) ? session.buckets : [],
    events: Array.isArray(session.events) ? session.events.map(fromBackendEvent) : [],
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: authHeaders(),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget POST to the backend proctoring sync endpoint.
 * Failures are swallowed — local state remains the source of truth
 * for the running UI; the backend is the durable copy.
 */
function syncSessionToBackend(session: PersistedProctoringSession): void {
  if (typeof fetch === "undefined") return;

  const payload = {
    exam_id: session.examId,
    student_id: session.studentId,
    student_name: session.studentName,
    student_number: session.studentNumber,
    avatar_url: session.avatarUrl ?? null,
    session_status: session.sessionStatus,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    risk_score: session.riskScore ?? computeRiskScore(session.events),
    rolling_average: session.rollingAverage,
    event_count: session.events.length,
    high_severity_event_count: session.events.filter((event) => event.severity >= 0.7).length,
    live_status: session.liveStatus,
    events: session.events.map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
      startedAt: event.startedAt,
      durationSeconds: event.durationSeconds,
      message: event.message,
      evidenceClipMimeType: event.evidenceClipMimeType ?? null,
    })),
    buckets: session.buckets,
  };

  fetch(BACKEND_SYNC_URL, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Backend unavailable — silently ignore; local state is preserved
  });
}

export async function fetchProctoringSessionsForExam(
  examId: string,
): Promise<PersistedProctoringSession[]> {
  const data = await fetchJson<BackendProctoringSession[]>(
    `/api/proctoring/exams/${encodeURIComponent(examId)}/sessions`,
  );
  return Array.isArray(data) ? data.map(fromBackendSession) : [];
}

export async function fetchStudentProctoringSession(
  examId: string,
  studentId: string,
): Promise<PersistedProctoringSession | null> {
  const data = await fetchJson<BackendProctoringSession>(
    `/api/proctoring/exams/${encodeURIComponent(examId)}/sessions/${encodeURIComponent(studentId)}`,
  );
  return data ? fromBackendSession(data) : null;
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
  syncSessionToBackend(session);
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
  syncSessionToBackend(session);
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
  const sortedEvents = [...session.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

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
