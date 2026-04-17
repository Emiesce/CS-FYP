"use client";

/* ------------------------------------------------------------------ */
/*  Staff Past Exam Proctoring Review                                 */
/*  Student roster + detail view with timeline, clips, breakdown      */
/* ------------------------------------------------------------------ */

import { use, useMemo, useState, useSyncExternalStore } from "react";
import { StudentRoster, StudentDetail } from "@/components/proctoring";
import { PAST_EXAM_RISK_SUMMARIES, ALL_EXAMS, MGMT2110_EXAM_ID } from "@/lib/fixtures";
import {
  readCompletedSessions,
  subscribeToPersistedProctoringSessions,
} from "@/features/proctoring/live-session-store";
import type { PersistedProctoringSession } from "@/features/proctoring/live-session-store";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { EmptyState } from "@/components/ui";
import type { StudentRiskSummary } from "@/types";

const SERVER_COMPLETED: PersistedProctoringSession[] = [];

function ProctoringReviewContent({ examId }: { examId: string }) {
  const exam = ALL_EXAMS.find((e) => e.id === examId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Read completed proctoring sessions from localStorage
  const allCompletedSessions = useSyncExternalStore(
    subscribeToPersistedProctoringSessions,
    readCompletedSessions,
    () => SERVER_COMPLETED,
  );
  const completedSessions = useMemo(
    () => allCompletedSessions.filter((s) => s.examId === examId),
    [allCompletedSessions, examId],
  );

  // Merge fixture data with live completed sessions
  const riskSummaries = useMemo<StudentRiskSummary[]>(() => {
    const fixtureData = PAST_EXAM_RISK_SUMMARIES.filter(
      // Only include fixture data for non-COMP1023 past exams
      () => !completedSessions.length,
    );
    const liveData: StudentRiskSummary[] = completedSessions.map((session) => ({
      studentId: session.studentId,
      studentName: session.studentName,
      studentNumber: session.studentNumber,
      avatarUrl: session.avatarUrl,
      currentRiskScore: computeRiskScore(session.events),
      lastUpdatedAt: session.updatedAt,
      highSeverityEventCount: countHighSeverityEvents(session.events),
      events: session.events,
      buckets: [],
    }));
    return liveData.length > 0 ? liveData : fixtureData;
  }, [completedSessions]);

  const selectedSummary = selectedStudentId
    ? riskSummaries.find((s) => s.studentId === selectedStudentId)
    : null;

  if (!exam) {
    return <EmptyState message="Exam not found." />;
  }

  if (examId === MGMT2110_EXAM_ID) {
    return (
      <EmptyState message="This test module is focused on essay grading. Open the Grading tab to review and batch-grade the seeded student answers." />
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div>
        <h1 className="page-title">
          Proctoring Review: {exam.courseCode} – {exam.title}
        </h1>
        <p className="page-subtitle">
          Review AI-detected violations and risk scores for each student.
        </p>
      </div>

      {/* Two-column layout: roster + detail */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 1fr) 2fr",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        <StudentRoster
          students={riskSummaries}
          onSelect={setSelectedStudentId}
          selectedStudentId={selectedStudentId ?? undefined}
        />

        <div>
          {selectedSummary ? (
            <StudentDetail summary={selectedSummary} />
          ) : (
            <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
              <p className="helper-text">
                Select a student from the roster to view their proctoring report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffPastProctoringPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  return <ProctoringReviewContent examId={examId} />;
}
