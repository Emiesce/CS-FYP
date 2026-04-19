"use client";

/* ------------------------------------------------------------------ */
/*  GradingSummaryCard – overview of a grading run                    */
/* ------------------------------------------------------------------ */

import type { GradingRun, QuestionGradingStatus } from "@/types";

const STATUS_BADGES: Record<QuestionGradingStatus, { cls: string; label: string }> = {
  pending:    { cls: "badge",             label: "Pending" },
  grading:    { cls: "badge badge-info",  label: "Grading" },
  graded:     { cls: "badge badge-success", label: "Graded" },
  escalated:  { cls: "badge badge-warning", label: "Escalated" },
  reviewed:   { cls: "badge badge-info",    label: "Reviewed" },
  finalized:  { cls: "badge badge-success", label: "Finalized" },
};

interface GradingSummaryCardProps {
  run: GradingRun;
  /** Per-question reveal map: questionId → true if the human has reviewed it */
  revealedQuestions?: Record<string, boolean>;
}

export function GradingSummaryCard({ run, revealedQuestions }: GradingSummaryCardProps) {
  // If revealedQuestions is provided, only count revealed scores
  const hideAny = revealedQuestions !== undefined;
  const allRevealed = !hideAny || run.questionResults.every((qr) => revealedQuestions[qr.questionId]);

  const visibleTotal = allRevealed
    ? run.totalScore
    : run.questionResults.reduce((s, qr) => s + (revealedQuestions?.[qr.questionId] ? qr.rawScore : 0), 0);

  const pct = allRevealed && run.maxTotalPoints > 0
    ? Math.round((run.totalScore / run.maxTotalPoints) * 100)
    : null;

  return (
    <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
            {allRevealed
              ? `Total: ${run.totalScore} / ${run.maxTotalPoints} (${pct}%)`
              : `Total: ?? / ${run.maxTotalPoints}`}
          </h3>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            Run ID: {run.id} · Status: {run.status} · {run.questionResults.length} questions
            {!allRevealed && " · Review all criteria to reveal total score"}
          </p>
        </div>
        <span className={`badge ${!allRevealed ? "" : pct !== null && pct >= 70 ? "badge-success" : pct !== null && pct >= 40 ? "badge-warning" : "badge-danger"}`} style={{ fontSize: "1.1rem", padding: "var(--space-2) var(--space-3)", color: !allRevealed ? "var(--muted)" : undefined }}>
          {allRevealed ? `${pct}%` : "??"}
        </span>
      </div>

      <table className="table" style={{ fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th>Q#</th>
            <th>Type</th>
            <th>Lane</th>
            <th>Model</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {run.questionResults.map((qr, i) => {
            const badge = STATUS_BADGES[qr.status] ?? STATUS_BADGES.pending;
            const qRevealed = !hideAny || revealedQuestions?.[qr.questionId];
            return (
              <tr key={qr.questionId} style={{ opacity: qRevealed ? 1 : 0.5 }}>
                <td>{i + 1}</td>
                <td>{qr.questionType}</td>
                <td><code>{qr.lane}</code></td>
                <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {qr.model ?? "—"}
                </td>
                <td><strong>{qRevealed ? `${qr.rawScore}/${qr.maxPoints}` : `??/${qr.maxPoints}`}</strong></td>
                <td><span className={qRevealed ? badge.cls : "badge"}>{qRevealed ? badge.label : "🔒 Review"}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
