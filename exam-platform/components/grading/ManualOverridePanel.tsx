"use client";

/* ------------------------------------------------------------------ */
/*  ManualOverridePanel – staff can override score + add comment      */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import type { QuestionGradeResult } from "@/types";

interface ManualOverridePanelProps {
  questionResult: QuestionGradeResult;
  onSubmit: (overrideScore: number | undefined, comment: string, accepted: boolean) => void;
}

export function ManualOverridePanel({
  questionResult,
  onSubmit,
}: ManualOverridePanelProps) {
  const [overrideScore, setOverrideScore] = useState<string>(
    String(questionResult.rawScore),
  );
  const [comment, setComment] = useState("");

  return (
    <div
      className="panel"
      style={{
        marginTop: "var(--space-4)",
        padding: "var(--space-5)",
        border: "1px solid var(--border-default)",
        background: "var(--surface-raised)",
      }}
    >
      <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "0.95rem" }}>
        Manual Override
      </h4>
      <p style={{ margin: "0 0 var(--space-4)", fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
        Adjust the overall question score when the final mark should differ from the AI result after human review.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 2fr", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <label className="form-label">
          Score (max {questionResult.maxPoints})
          <input
            className="input"
            type="number"
            min={0}
            max={questionResult.maxPoints}
            step={0.5}
            value={overrideScore}
            onChange={(e) => setOverrideScore(e.target.value)}
          />
        </label>
        <label className="form-label">
          Human Reasoning
          <textarea
            className="input"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Explain why the question-level score should change…"
            style={{ resize: "vertical" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button
          className="button"
          onClick={() => {
            const score = parseFloat(overrideScore);
            const finalScore = isNaN(score) ? undefined : Math.max(0, Math.min(score, questionResult.maxPoints));
            onSubmit(finalScore, comment, true);
          }}
        >
          Accept &amp; Override
        </button>
        <button
          className="button-ghost"
          onClick={() => onSubmit(undefined, comment, true)}
        >
          Keep AI Question Score
        </button>
      </div>
    </div>
  );
}
