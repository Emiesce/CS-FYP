"use client";

/* ------------------------------------------------------------------ */
/*  Staff Past Exam Proctoring Review                                 */
/*  Student roster + detail view with timeline, clips, breakdown      */
/* ------------------------------------------------------------------ */

import { use, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { StudentRoster, StudentDetail } from "@/components/proctoring";
import { fetchExamDefinition } from "@/features/exams/exam-service";
import {
  fetchProctoringSessionsForExam,
  fetchStudentProctoringSession,
  readCompletedSessions,
  subscribeToPersistedProctoringSessions,
} from "@/features/proctoring/live-session-store";
import type { PersistedProctoringSession } from "@/features/proctoring/live-session-store";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { EmptyState } from "@/components/ui";
import type { ProctoringBucket, ProctoringEventType, StudentRiskSummary } from "@/types";

const SERVER_COMPLETED: PersistedProctoringSession[] = [];

function buildBucketHistory(session: PersistedProctoringSession): ProctoringBucket[] {
  const startMs = new Date(session.startedAt).getTime();

  return session.buckets.map((bucket, index) => {
    const windowStart = new Date(startMs + index * 10_000).toISOString();
    const windowEnd = new Date(startMs + (index + 1) * 10_000).toISOString();

    return {
      examId: session.examId,
      studentId: session.studentId,
      windowStartedAt: windowStart,
      windowEndedAt: windowEnd,
      suspiciousActivityAverage: bucket.score,
      eventCounts: {} as Record<ProctoringEventType, number>,
    };
  });
}

function toRiskSummary(session: PersistedProctoringSession): StudentRiskSummary {
  return {
    studentId: session.studentId,
    studentName: session.studentName,
    studentNumber: session.studentNumber,
    avatarUrl: session.avatarUrl,
    currentRiskScore: session.riskScore ?? computeRiskScore(session.events),
    lastUpdatedAt: session.updatedAt,
    highSeverityEventCount: countHighSeverityEvents(session.events),
    events: session.events,
    buckets: buildBucketHistory(session),
  };
}

function ProctoringReviewContent({ examId }: { examId: string }) {
  const [exam, setExam] = useState<Awaited<ReturnType<typeof fetchExamDefinition>> | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [remoteSessions, setRemoteSessions] = useState<PersistedProctoringSession[]>([]);
  const [selectedRemoteSession, setSelectedRemoteSession] =
    useState<PersistedProctoringSession | null>(null);
  const [detailLoadingStudentId, setDetailLoadingStudentId] = useState<string | null>(null);
  const detailRequestRef = useRef(0);

  const allCompletedSessions = useSyncExternalStore(
    subscribeToPersistedProctoringSessions,
    readCompletedSessions,
    () => SERVER_COMPLETED,
  );
  const completedSessions = useMemo(
    () => allCompletedSessions.filter((s) => s.examId === examId),
    [allCompletedSessions, examId],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchExamDefinition(examId).then((definition) => {
      if (!cancelled) setExam(definition);
    });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const sessions = await fetchProctoringSessionsForExam(examId);
      if (!cancelled) {
        setRemoteSessions(sessions);
      }
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [examId]);

  const mergedSessions = useMemo(() => {
    const byStudent = new Map<string, PersistedProctoringSession>();

    for (const session of remoteSessions) {
      byStudent.set(session.studentId, session);
    }

    for (const session of completedSessions) {
      const existing = byStudent.get(session.studentId);
      if (
        !existing ||
        session.events.length > existing.events.length ||
        session.updatedAt >= existing.updatedAt
      ) {
        byStudent.set(session.studentId, session);
      }
    }

    if (selectedRemoteSession) {
      byStudent.set(selectedRemoteSession.studentId, selectedRemoteSession);
    }

    return [...byStudent.values()];
  }, [completedSessions, remoteSessions, selectedRemoteSession]);

  const riskSummaries = useMemo<StudentRiskSummary[]>(() => {
    return mergedSessions.map(toRiskSummary);
  }, [mergedSessions]);

  const selectedSummary = selectedStudentId
    ? riskSummaries.find((s) => s.studentId === selectedStudentId)
    : null;
  const isDetailLoading =
    selectedStudentId !== null && detailLoadingStudentId === selectedStudentId;

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);

    const localSession = completedSessions.find((session) => session.studentId === studentId);
    if (localSession?.events.length) {
      setSelectedRemoteSession(localSession);
      setDetailLoadingStudentId(null);
      return;
    }

    setSelectedRemoteSession(null);
    setDetailLoadingStudentId(studentId);
    detailRequestRef.current += 1;
    const requestId = detailRequestRef.current;

    void fetchStudentProctoringSession(examId, studentId)
      .then((session) => {
        if (detailRequestRef.current === requestId) {
          setSelectedRemoteSession(session);
        }
      })
      .finally(() => {
        if (detailRequestRef.current === requestId) {
          setDetailLoadingStudentId(null);
        }
      });
  };

  if (!exam) {
    return <EmptyState message="Exam not found." />;
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
          onSelect={handleSelectStudent}
          selectedStudentId={selectedStudentId ?? undefined}
        />

        <div>
          {selectedStudentId && isDetailLoading && !selectedSummary?.events.length ? (
            <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
              <p className="helper-text">Loading proctoring details...</p>
            </div>
          ) : selectedSummary ? (
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
