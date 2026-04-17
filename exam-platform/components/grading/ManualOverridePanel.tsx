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
    <div className="panel" style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
      <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "0.95rem" }}>
        Manual Override
      </h4>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
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
          Comment
          <textarea
            className="input"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Reason for override…"
            style={{ resize: "vertical" }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
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
          Accept AI Score
        </button>
      </div>
    </div>
  );
}
