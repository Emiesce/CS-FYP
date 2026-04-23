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
  const hasHumanGrade = criterion.overrideScore != null;
  // Human grade takes precedence over AI grade for the final score
  const finalScore = hasHumanGrade ? criterion.overrideScore! : criterion.score;
  const pct = criterion.maxPoints > 0
    ? Math.round((finalScore / criterion.maxPoints) * 100)
    : 0;

  return (
    <div
      className="panel"
      style={{
        width: "100%",
        border: isActive
          ? "2px solid var(--hkust-blue-700)"
          : hasHumanGrade
            ? "1.5px solid var(--success-text)"
            : "1px solid var(--border-subtle)",
        background: isActive
          ? "var(--hkust-blue-100)"
          : hasHumanGrade
            ? "var(--success-bg)"
            : "var(--surface-strong)",
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
          padding: "var(--space-3) var(--space-4)",
          border: "none",
          background: "transparent",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: 2 }}>
              {criterion.criterionLabel}
            </strong>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              max {criterion.maxPoints} pts ·{" "}
              {hasHumanGrade
                ? <span style={{ color: "var(--success-text)", fontWeight: 700 }}>Human reviewed ✓</span>
                : <span>Pending review</span>
              }
            </span>
          </div>

          {/* HUMAN | AI score pills */}
          {!hideAssessment && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--success-text)", letterSpacing: "0.05em" }}>HUMAN</span>
                <span style={
                  hasHumanGrade
                    ? { fontSize: "0.78rem", fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-text)" }
                    : { fontSize: "0.78rem", padding: "2px 7px", borderRadius: 6, color: "var(--text-muted)", background: "var(--slate-100)", border: "1px dashed var(--border-strong)" }
                }>
                  {hasHumanGrade ? `${criterion.overrideScore}/${criterion.maxPoints}` : `—/${criterion.maxPoints}`}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--info-text)", letterSpacing: "0.05em" }}>AI</span>
                <span style={{ fontSize: "0.78rem", padding: "2px 7px", borderRadius: 6, background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid color-mix(in srgb, var(--info-text) 30%, transparent)" }}>
                  {criterion.score}/{criterion.maxPoints}
                </span>
              </div>
            </div>
          )}
          {hideAssessment && (
            <span style={{ fontSize: "0.78rem", padding: "2px 7px", borderRadius: 6, color: "var(--text-muted)", background: "var(--slate-100)", border: "1px dashed var(--border-strong)" }}>
              ??/{criterion.maxPoints}
            </span>
          )}
        </div>

        {/* Progress bar — reflects final (human-precedence) score */}
        {!hideAssessment ? (
          <div
            aria-hidden="true"
            style={{
              height: 5,
              borderRadius: 999,
              background: "var(--slate-200)",
              overflow: "hidden",
              marginBottom: "var(--space-2)",
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: hasHumanGrade
                  ? "var(--success-text)"
                  : pct >= 80 ? "var(--hkust-blue-700)" : pct >= 50 ? "var(--hkust-gold-500)" : "var(--danger-text)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "var(--space-2)",
              borderRadius: "var(--radius-sm)",
              background: "var(--slate-100)",
              marginBottom: "var(--space-2)",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            Enter your score first to reveal the AI assessment.
          </div>
        )}

        {/* Rationale blocks */}
        {!hideAssessment && (
          <div style={{ display: "grid", gap: "var(--space-1)" }}>
            {hasHumanGrade && criterion.reviewerRationale && (
              <div style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "color-mix(in srgb, var(--success-text) 8%, white)", border: "1px solid color-mix(in srgb, var(--success-text) 20%, white)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--success-text)", marginBottom: 2, letterSpacing: "0.05em" }}>HUMAN REASONING</div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-primary)", lineHeight: 1.4 }}>{criterion.reviewerRationale}</p>
              </div>
            )}
            {criterion.rationale && (
              <div style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: hasHumanGrade ? "var(--slate-50)" : "var(--info-bg)", border: `1px solid ${hasHumanGrade ? "var(--border-subtle)" : "color-mix(in srgb, var(--info-text) 20%, transparent)"}`, opacity: hasHumanGrade ? 0.7 : 1 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--info-text)", marginBottom: 2, letterSpacing: "0.05em" }}>AI RATIONALE{hasHumanGrade ? " (superseded)" : ""}</div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{criterion.rationale}</p>
              </div>
            )}
          </div>
        )}

        {!hideAssessment && criterion.evidenceSpans.length > 0 && (
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
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
