"use client";

/* ------------------------------------------------------------------ */
/*  CriterionScoreCard – one criterion's score, rationale, evidence   */
/* ------------------------------------------------------------------ */

import type { CriterionGradeResult } from "@/types";

interface CriterionScoreCardProps {
  criterion: CriterionGradeResult;
  isActive: boolean;
  onClick: () => void;
}

export function CriterionScoreCard({
  criterion,
  isActive,
  onClick,
}: CriterionScoreCardProps) {
  const pct = criterion.maxPoints > 0
    ? Math.round((criterion.score / criterion.maxPoints) * 100)
    : 0;

  return (
    <button
      type="button"
      className="panel"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: isActive ? "2px solid var(--primary)" : undefined,
        padding: "var(--space-3)",
        marginBottom: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <strong style={{ fontSize: "0.9rem" }}>{criterion.criterionLabel}</strong>
        <span
          className={`badge ${pct >= 80 ? "badge-success" : pct >= 50 ? "badge-warning" : "badge-danger"}`}
          style={{ fontSize: "0.85rem" }}
        >
          {criterion.score}/{criterion.maxPoints}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
        {criterion.rationale}
      </p>
      {criterion.evidenceSpans.length > 0 && (
        <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
          {criterion.evidenceSpans.length} evidence span{criterion.evidenceSpans.length !== 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}
