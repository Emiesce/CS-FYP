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
}

export function GradingSummaryCard({ run }: GradingSummaryCardProps) {
  const pct = run.maxTotalPoints > 0
    ? Math.round((run.totalScore / run.maxTotalPoints) * 100)
    : 0;

  return (
    <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
            Total: {run.totalScore} / {run.maxTotalPoints} ({pct}%)
          </h3>
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
            Run ID: {run.id} · Status: {run.status} · {run.questionResults.length} questions
          </p>
        </div>
        <span className={`badge ${pct >= 70 ? "badge-success" : pct >= 40 ? "badge-warning" : "badge-danger"}`} style={{ fontSize: "1.1rem", padding: "var(--space-2) var(--space-3)" }}>
          {pct}%
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
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {run.questionResults.map((qr, i) => {
            const badge = STATUS_BADGES[qr.status] ?? STATUS_BADGES.pending;
            return (
              <tr key={qr.questionId}>
                <td>{i + 1}</td>
                <td>{qr.questionType}</td>
                <td><code>{qr.lane}</code></td>
                <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {qr.model ?? "—"}
                </td>
                <td><strong>{qr.rawScore}/{qr.maxPoints}</strong></td>
                <td>{(qr.confidence * 100).toFixed(0)}%</td>
                <td><span className={badge.cls}>{badge.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
