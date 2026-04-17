"use client";

/* ------------------------------------------------------------------ */
/*  Staff Grading Dashboard – list attempts and trigger grading       */
/* ------------------------------------------------------------------ */

import { useCallback, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { GradingSummaryCard } from "@/components/grading/GradingSummaryCard";
import { DEMO_EXAM_DEFINITION } from "@/lib/fixtures";
import { startGradingRun, getGradingRun } from "@/features/grading/grading-service";
import type { GradingRun } from "@/types";

/* Demo data: a submitted attempt for grading */
const DEMO_ATTEMPT = {
  id: "attempt-demo-001",
  studentId: "stu-001",
  studentName: "Alex Chan",
};

function GradingDashboardContent({ examId }: { examId: string }) {
  const [gradingRun, setGradingRun] = useState<GradingRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartGrading = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const run = await startGradingRun(examId, {
        attemptId: DEMO_ATTEMPT.id,
        studentId: DEMO_ATTEMPT.studentId,
        mode: "balanced",
      });
      setGradingRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  const handleRefresh = useCallback(async () => {
    if (!gradingRun) return;
    try {
      const run = await getGradingRun(examId, DEMO_ATTEMPT.id);
      setGradingRun(run);
    } catch {
      // ignore
    }
  }, [examId, gradingRun]);

  return (
    <>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
          AI Grading – {DEMO_EXAM_DEFINITION.title}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          {DEMO_EXAM_DEFINITION.courseCode} · {DEMO_EXAM_DEFINITION.questions.length} questions ·{" "}
          {DEMO_EXAM_DEFINITION.totalPoints} points
        </p>
      </div>

      {/* Attempt list */}
      <div className="section-group">
        <h2 className="section-title">Submitted Attempts</h2>
        <table className="table" style={{ marginBottom: "var(--space-4)" }}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Attempt ID</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>{DEMO_ATTEMPT.studentName}</strong></td>
              <td><code>{DEMO_ATTEMPT.id}</code></td>
              <td>
                <span className={`badge ${gradingRun ? "badge-success" : "badge-warning"}`}>
                  {gradingRun ? gradingRun.status : "awaiting grading"}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                  <button
                    className="button"
                    onClick={handleStartGrading}
                    disabled={loading}
                    style={{ fontSize: "0.85rem" }}
                  >
                    {loading ? "Grading…" : "🤖 Run AI Grading"}
                  </button>
                  {gradingRun && (
                    <a
                      href={`/staff/exams/${examId}/grading/${DEMO_ATTEMPT.id}`}
                      className="button-ghost"
                      style={{ fontSize: "0.85rem" }}
                    >
                      Review →
                    </a>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {error && (
          <div style={{ color: "var(--danger-text)", marginBottom: "var(--space-4)", fontSize: "0.9rem" }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Grading results summary */}
      {gradingRun && (
        <div className="section-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h2 className="section-title" style={{ margin: 0, border: "none", paddingBottom: 0 }}>
              Grading Results
            </h2>
            <button className="button-ghost" onClick={handleRefresh} style={{ fontSize: "0.85rem" }}>
              ↻ Refresh
            </button>
          </div>
          <GradingSummaryCard run={gradingRun} />
        </div>
      )}
    </>
  );
}

export default function GradingPage({
  params,
}: {
  params: { examId: string };
}) {
  return (
    <AuthenticatedShell requiredRole="staff">
      <GradingDashboardContent examId={params.examId} />
    </AuthenticatedShell>
  );
}
