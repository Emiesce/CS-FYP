"use client";

/* ------------------------------------------------------------------ */
/*  Student Exam Detail Page (non-current exams)                      */
/* ------------------------------------------------------------------ */

import { use, useMemo, useSyncExternalStore } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { useSession } from "@/features/auth/session-store";
import {
  readCompletedSession,
  subscribeToPersistedProctoringSessions,
} from "@/features/proctoring/live-session-store";
import { ALL_EXAMS, PAST_EXAM_RISK_SUMMARIES } from "@/lib/fixtures";
import { EmptyState, MetricCard } from "@/components/ui";
import { formatDate } from "@/lib/utils/format";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { SuspiciousActivityChart, ViolationTimeline, WarningFeed } from "@/components/proctoring";
import Link from "next/link";

function ExamDetailContent({ examId }: { examId: string }) {
  const { user } = useSession();
  const exam = ALL_EXAMS.find((e) => e.id === examId);

  const fixtureSummary = useMemo(
    () => {
      if (!user || examId !== "exam-past-001") {
        return null;
      }

      return PAST_EXAM_RISK_SUMMARIES.find((summary) => summary.studentId === user.id) ?? null;
    },
    [examId, user],
  );

  const completedSession = useSyncExternalStore(
    subscribeToPersistedProctoringSessions,
    () => (user ? readCompletedSession(examId, user.studentId ?? user.id) : null),
    () => null,
  );

  const completedSessionEvents = completedSession?.events ?? [];

  const personalEvents =
    completedSessionEvents.length > 0
      ? completedSessionEvents
      : fixtureSummary?.events ?? [];
  const riskScore = computeRiskScore(personalEvents);
  const highSeverityCount = countHighSeverityEvents(personalEvents);

  if (!exam) {
    return <EmptyState message="Exam not found." />;
  }

  const showPersonalSummary = exam.status === "past" || completedSessionEvents.length > 0;

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div>
        <Link href="/student" className="button-ghost" style={{ marginBottom: "var(--space-4)", display: "inline-flex" }}>
          Back to Dashboard
        </Link>
        <h1 className="page-title">
          {exam.courseCode} – {exam.title}
        </h1>
        <p className="page-subtitle">{exam.courseName}</p>
      </div>

      <div className="panel">
        <h2 style={{ margin: "0 0 var(--space-3)", fontSize: "1.1rem" }}>Exam Details</h2>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", color: "var(--text-secondary)" }}>
          <span>Date: {formatDate(exam.date)}</span>
          <span>Start: {exam.startTime}</span>
          <span>Location: {exam.location}</span>
          <span>Duration: {Math.round(exam.durationSeconds / 60)} minutes</span>
        </div>
      </div>

      {showPersonalSummary && (
        <div style={{ display: "grid", gap: "var(--space-6)" }}>
          <div className="panel">
            <h2 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem" }}>
              Your Proctoring Summary
            </h2>
            <p className="helper-text" style={{ margin: 0 }}>
              This section is visible only for your own completed exam activity.
            </p>
          </div>

          <div className="grid grid-3">
            <MetricCard label="Total Violations" value={personalEvents.length} />
            <MetricCard label="High Severity Alerts" value={highSeverityCount} />
            <MetricCard label="Risk Score" value={riskScore} />
          </div>

          <SuspiciousActivityChart
            events={personalEvents}
            durationSeconds={exam.durationSeconds}
            startedAt={
              completedSession?.startedAt ??
              fixtureSummary?.buckets[0]?.windowStartedAt ??
              null
            }
            title="Violation Timeline"
          />

          <ViolationTimeline events={personalEvents} />
          <WarningFeed events={personalEvents} />
        </div>
      )}
    </div>
  );
}

export default function StudentExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return (
    <AuthenticatedShell requiredRole="student">
      <ExamDetailContent examId={examId} />
    </AuthenticatedShell>
  );
}
