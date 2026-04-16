"use client";

/* ------------------------------------------------------------------ */
/*  Staff Live Proctoring – Current Exam monitoring                   */
/*  Shows violation logs only – NO live student video stream.         */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { LiveViolationLog } from "@/components/proctoring";
import { MetricCard } from "@/components/ui";
import { DEMO_CURRENT_EXAM } from "@/lib/fixtures";
import { DEMO_EXAM_DURATION_SECONDS } from "@/lib/constants";
import { formatCountdown } from "@/lib/utils/format";
import { computeRiskScore } from "@/lib/utils/risk-score";
import {
  buildLiveViolationEntries,
  subscribeToLiveSession,
  type PersistedProctoringSession,
} from "@/features/proctoring/live-session-store";
import Link from "next/link";

function StaffLiveProctoringContent() {
  const [session, setSession] = useState<PersistedProctoringSession | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToLiveSession(setSession);
    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const entries = useMemo(() => (session ? buildLiveViolationEntries(session) : []), [session]);
  const sessionStatus = session?.sessionStatus ?? "active";
  const latestScore = session ? computeRiskScore(session.events) : 0;
  const secondsElapsed = session
    ? Math.min(
        DEMO_EXAM_DURATION_SECONDS,
        Math.floor((now - new Date(session.startedAt).getTime()) / 1000),
      )
    : 0;
  const timeRemaining = Math.max(0, DEMO_EXAM_DURATION_SECONDS - secondsElapsed);
  const activeStudents = session?.sessionStatus === "completed" || session ? 1 : 0;


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
          Live Monitoring: {DEMO_CURRENT_EXAM.courseCode} – {DEMO_CURRENT_EXAM.title}
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
            No live student session is currently connected. Open the student current exam in
            another tab to stream real-time violation logs here.
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
