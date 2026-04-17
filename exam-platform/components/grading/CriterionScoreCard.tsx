"use client";

/* ------------------------------------------------------------------ */
/*  CriterionScoreCard – one criterion's score, rationale, evidence   */
/* ------------------------------------------------------------------ */

import type { ReactNode } from "react";
import type { CriterionGradeResult } from "@/types";

interface CriterionScoreCardProps {
  criterion: CriterionGradeResult;
  isActive: boolean;
  onClick: () => void;
  hideAssessment?: boolean;
  children?: ReactNode;
}

export function CriterionScoreCard({
  criterion,
  isActive,
  onClick,
  hideAssessment = false,
  children,
}: CriterionScoreCardProps) {
  const effectiveScore = criterion.overrideScore ?? criterion.score;
  const pct = criterion.maxPoints > 0
    ? Math.round((effectiveScore / criterion.maxPoints) * 100)
    : 0;
  const hasOverride = criterion.overrideScore != null;

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        border: isActive ? "2px solid var(--primary)" : "1px solid var(--border-default)",
        background: isActive ? "color-mix(in srgb, var(--primary) 6%, var(--surface-raised))" : "var(--surface-raised)",
        boxShadow: isActive ? "0 10px 30px rgba(0, 51, 102, 0.12)" : "var(--shadow-sm)",
        marginBottom: "var(--space-1)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          padding: "var(--space-2) var(--space-3)",
          border: "none",
          background: "transparent",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: 2 }}>
              {criterion.criterionLabel}
            </strong>
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              {hasOverride ? "Human-reviewed" : "Blind review"} · max {criterion.maxPoints}
            </span>
          </div>
          {!hideAssessment && (
            <div style={{ display: "grid", gap: 4, justifyItems: "end", flexShrink: 0 }}>
              <span
                className={`badge ${pct >= 80 ? "badge-success" : pct >= 50 ? "badge-warning" : "badge-danger"}`}
                style={{ fontSize: "0.78rem" }}
              >
                {effectiveScore}/{criterion.maxPoints}
              </span>
              {hasOverride && (
                <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>
                  AI {criterion.score}/{criterion.maxPoints}
                </span>
              )}
            </div>
          )}
          {hideAssessment && (
            <span className="badge" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
              ??/{criterion.maxPoints}
            </span>
          )}
        </div>

        {!hideAssessment ? (
          <div
            aria-hidden="true"
            style={{
              height: 5,
              borderRadius: 999,
              background: "var(--surface-hover)",
              overflow: "hidden",
              marginBottom: "var(--space-2)",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: pct >= 80 ? "var(--success-text)" : pct >= 50 ? "var(--hkust-gold)" : "var(--danger-text)",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "var(--space-2)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-hover)",
              marginBottom: "var(--space-2)",
              fontSize: "0.78rem",
              color: "var(--muted)",
            }}
          >
            Enter your own score first to reveal the AI assessment.
          </div>
        )}

        {!hideAssessment ? (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {criterion.rationale}
          </p>
        ) : null}
        {!hideAssessment && criterion.reviewerRationale && (
          <div
          style={{
            marginTop: "var(--space-2)",
            padding: "var(--space-2)",
            borderRadius: "var(--radius-md)",
            background: "color-mix(in srgb, var(--hkust-gold) 10%, white)",
            border: "1px solid color-mix(in srgb, var(--hkust-gold) 24%, white)",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--hkust-blue)", marginBottom: 2 }}>
            Human Reasoning
          </div>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
            {criterion.reviewerRationale}
          </p>
        </div>
      )}
      {!hideAssessment && criterion.evidenceSpans.length > 0 && (
        <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
          {criterion.evidenceSpans.length} evidence span{criterion.evidenceSpans.length !== 1 ? "s" : ""}
        </p>
      )}
      </button>
      {children && (
        <div
          style={{
            maxHeight: isActive ? "640px" : "0px",
            opacity: isActive ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.28s ease, opacity 0.22s ease",
          }}
        >
          <div style={{ padding: "0 var(--space-3) var(--space-3)" }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
