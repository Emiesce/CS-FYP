"use client";

/* ------------------------------------------------------------------ */
/*  GradingSummaryCard – overview of a grading run                    */
/* ------------------------------------------------------------------ */

import type { GradingRun, QuestionGradingStatus } from "@/types";

const STATUS_BADGES: Record<QuestionGradingStatus, { cls: string; label: string }> = {
  pending: { cls: "badge", label: "Pending" },
  grading: { cls: "badge badge-info", label: "Grading" },
  graded: { cls: "badge badge-success", label: "Graded" },
  escalated: { cls: "badge badge-warning", label: "Escalated" },
  reviewed: { cls: "badge badge-info", label: "Reviewed" },
  finalized: { cls: "badge badge-success", label: "Finalized" },
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

  const pct = allRevealed && run.maxTotalPoints > 0
    ? Math.round((run.totalScore / run.maxTotalPoints) * 100)
    : null;

  return (
    <div
      className="panel"
      style={{
        marginBottom: "var(--space-3)",
        padding: "var(--space-2) var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        flexWrap: "wrap",
        fontSize: "0.82rem",
      }}
    >
      {/* Total */}
      <span style={{ fontWeight: 600, color: "var(--muted)", whiteSpace: "nowrap" }}>Total:</span>
      <span
        className={`badge ${!allRevealed ? "" : pct !== null && pct >= 70 ? "badge-success" : pct !== null && pct >= 40 ? "badge-warning" : "badge-danger"}`}
        style={{ fontWeight: 700, color: !allRevealed ? "var(--muted)" : undefined }}
      >
        {allRevealed ? `${run.totalScore} / ${run.maxTotalPoints} (${pct}%)` : `?? / ${run.maxTotalPoints}`}
      </span>

      <div style={{ width: 1, height: 16, background: "var(--border-default)", flexShrink: 0 }} />

      {/* Per-question pills */}
      {run.questionResults.map((qr, i) => {
        const qRevealed = !hideAny || revealedQuestions?.[qr.questionId];
        const badge = STATUS_BADGES[qr.status] ?? STATUS_BADGES.pending;
        const modelShort = qr.model ? qr.model.split("/").pop() : null;
        return (
          <span
            key={qr.questionId}
            className={qRevealed ? badge.cls : "badge"}
            style={{ cursor: "default" }}
          >
            Q{i + 1}: {qRevealed ? `${qr.rawScore}/${qr.maxPoints}` : `??/${qr.maxPoints}`}
            <span style={{ opacity: 0.6, marginLeft: 4, fontWeight: 400 }}>
              {qr.lane}{modelShort ? ` · ${modelShort}` : ""}
            </span>
          </span>
        );
      })}

      <div style={{ width: 1, height: 16, background: "var(--border-default)", flexShrink: 0 }} />

      {/* Run meta */}
      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
        {run.id} · {run.status}
      </span>
    </div>
  );
}
