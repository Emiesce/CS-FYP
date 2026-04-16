"use client";

/* ------------------------------------------------------------------ */
/*  Staff Past Exam Proctoring Review                                 */
/*  Student roster + detail view with timeline, clips, breakdown      */
/* ------------------------------------------------------------------ */

import { use, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StudentRoster, StudentDetail } from "@/components/proctoring";
import { PAST_EXAM_RISK_SUMMARIES, ALL_EXAMS } from "@/lib/fixtures";
import { EmptyState } from "@/components/ui";
import Link from "next/link";

function ProctoringReviewContent({ examId }: { examId: string }) {
  const exam = ALL_EXAMS.find((e) => e.id === examId);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedSummary = selectedStudentId
    ? PAST_EXAM_RISK_SUMMARIES.find((s) => s.studentId === selectedStudentId)
    : null;

  if (!exam) {
    return <EmptyState message="Exam not found." />;
  }

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
          students={PAST_EXAM_RISK_SUMMARIES}
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
  return (
    <AuthenticatedShell requiredRole="staff">
      <ProctoringReviewContent examId={examId} />
    </AuthenticatedShell>
  );
}
