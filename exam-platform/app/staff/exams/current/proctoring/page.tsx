"use client";

/* ------------------------------------------------------------------ */
/*  Staff Live Proctoring – Current Exam monitoring                   */
/*  Shows violation logs only – NO live student video stream.         */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { LiveViolationLog } from "@/components/proctoring";
import { MetricCard } from "@/components/ui";
import { getCurrentExam } from "@/features/catalog/catalog-service";
import { DEMO_EXAM_DURATION_SECONDS } from "@/lib/constants";
import { formatCountdown } from "@/lib/utils/format";
import { computeRiskScore } from "@/lib/utils/risk-score";
import {
  buildLiveViolationEntries,
  fetchProctoringSessionsForExam,
  fetchStudentProctoringSession,
  subscribeToLiveSession,
  type PersistedProctoringSession,
} from "@/features/proctoring/live-session-store";
import Link from "next/link";
import type { Exam } from "@/types";

function StaffLiveProctoringContent() {
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [localSession, setLocalSession] = useState<PersistedProctoringSession | null>(null);
  const [remoteSessions, setRemoteSessions] = useState<PersistedProctoringSession[]>([]);
  const [hydratedRemoteSession, setHydratedRemoteSession] =
    useState<PersistedProctoringSession | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLiveSession(setLocalSession);
    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getCurrentExam().then((exam) => {
      if (!cancelled) setCurrentExam(exam);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentExam) return;
    let cancelled = false;

    const refresh = async () => {
      const sessions = await fetchProctoringSessionsForExam(currentExam.id);
      if (cancelled) return;
      setRemoteSessions(sessions);
      setRemoteReady(true);
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentExam]);

  const newestRemoteSession = useMemo(
    () =>
      [...remoteSessions]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .find((candidate) => candidate.examId === currentExam?.id) ?? null,
    [currentExam?.id, remoteSessions],
  );

  useEffect(() => {
    const remoteCandidate = newestRemoteSession;
    if (!remoteCandidate || remoteCandidate.events.length > 0) {
      return;
    }

    let cancelled = false;

    void fetchStudentProctoringSession(currentExam?.id ?? "", remoteCandidate.studentId).then(
      (session) => {
        if (!cancelled) {
          setHydratedRemoteSession(session);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [currentExam?.id, newestRemoteSession]);

  const session = useMemo(() => {
    const localCurrent =
      localSession?.examId === currentExam?.id ? localSession : null;
    const remoteCurrent =
      newestRemoteSession?.events.length
        ? newestRemoteSession
        : hydratedRemoteSession &&
            hydratedRemoteSession.studentId === newestRemoteSession?.studentId &&
            hydratedRemoteSession.updatedAt >= newestRemoteSession.updatedAt
          ? hydratedRemoteSession
          : newestRemoteSession;

    if (!localCurrent) return remoteCurrent;
    if (!remoteCurrent) return localCurrent;

    return localCurrent.updatedAt >= remoteCurrent.updatedAt ? localCurrent : remoteCurrent;
  }, [currentExam?.id, hydratedRemoteSession, localSession, newestRemoteSession]);

  const entries = useMemo(() => (session ? buildLiveViolationEntries(session) : []), [session]);
  const sessionStatus = session?.sessionStatus ?? "active";
  const latestScore = session?.riskScore ?? (session ? computeRiskScore(session.events) : 0);
  const secondsElapsed = session
    ? Math.min(
        DEMO_EXAM_DURATION_SECONDS,
        Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
      )
    : 0;
  const timeRemaining = Math.max(0, DEMO_EXAM_DURATION_SECONDS - secondsElapsed);
  const activeStudents = Math.max(
    remoteSessions.filter((candidate) =>
      candidate.sessionStatus === "active" || candidate.sessionStatus === "warning",
    ).length,
    session && session.sessionStatus !== "completed" ? 1 : 0,
  );


  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div>
        <Link
          href="/staff"
          className="button-ghost"
          style={{ marginBottom: "var(--space-4)", display: "inline-flex" }}
        >
          Back to Dashboard
        </Link>
        <h1 className="page-title">
          Live Monitoring: {currentExam?.courseCode ?? "Exam"} – {currentExam?.title ?? "Current Session"}
        </h1>
        <p className="page-subtitle">
          Viewing live violation logs. Student video is not displayed on the staff interface.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-3">
        <MetricCard label="Time Remaining" value={formatCountdown(timeRemaining)} />
        <MetricCard label="Active Students" value={activeStudents} />
        <MetricCard label="Running Risk Score" value={latestScore} />
      </div>

      {!session && (
        <div className="panel">
          <p className="helper-text" style={{ margin: 0 }}>
            {remoteReady
              ? "No live student session is currently connected. Open the student current exam in another tab to stream real-time violation logs here."
              : "Checking for live student sessions..."}
          </p>
        </div>
      )}

      {/* Violation log */}
      <LiveViolationLog entries={entries} sessionStatus={sessionStatus} />

      {sessionStatus === "completed" && (
        <div
          className="panel"
          style={{ textAlign: "center", background: "var(--success-bg)" }}
        >
          <p style={{ fontWeight: 700, color: "var(--success-text)" }}>
            Exam session has ended. Review results in Past Examinations.
          </p>
        </div>
      )}
    </div>
  );
}

export default function StaffCurrentProctoringPage() {
  return (
    <AuthenticatedShell requiredRole="staff">
      <StaffLiveProctoringContent />
    </AuthenticatedShell>
  );
}
