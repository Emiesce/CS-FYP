"use client";

/* ------------------------------------------------------------------ */
/*  RubricBuilder – manual rubric entry UI per question               */
/* ------------------------------------------------------------------ */

import { useCallback, useState } from "react";
import type { RubricCriterion, StructuredRubric } from "@/types";

interface RubricBuilderProps {
  questionId: string;
  totalPoints: number;
  initialRubric?: StructuredRubric;
  onSave: (rubric: StructuredRubric) => void;
}

function emptyCriterion(idx: number): RubricCriterion {
  return {
    id: `crit-${idx}`,
    label: "",
    description: "",
    maxPoints: 0,
    scoreBands: [
      { label: "Full", minPoints: 0, maxPoints: 0, description: "Full marks" },
      { label: "None", minPoints: 0, maxPoints: 0, description: "No marks" },
    ],
  };
}

export function RubricBuilder({
  questionId,
  totalPoints,
  initialRubric,
  onSave,
}: RubricBuilderProps) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initialRubric?.criteria ?? [emptyCriterion(1)],
  );

  const addCriterion = useCallback(() => {
    setCriteria((prev) => [...prev, emptyCriterion(prev.length + 1)]);
  }, []);

  const removeCriterion = useCallback((idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateCriterion = useCallback(
    (idx: number, partial: Partial<RubricCriterion>) => {
      setCriteria((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, ...partial } : c)),
      );
    },
    [],
  );

  const criteriaTotal = criteria.reduce((s, c) => s + c.maxPoints, 0);
  const isValid = criteria.length > 0 && criteria.every((c) => c.label.trim()) && Math.abs(criteriaTotal - totalPoints) < 0.01;

  const handleSave = useCallback(() => {
    if (!isValid) return;
    const rubric: StructuredRubric = {
      questionId,
      criteria,
      totalPoints,
      version: 1,
    };
    onSave(rubric);
  }, [criteria, isValid, onSave, questionId, totalPoints]);

  return (
    <div className="panel" style={{ padding: "var(--space-4)" }}>
      <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "0.95rem" }}>
        Rubric Builder
        <span style={{ fontWeight: "normal", fontSize: "0.85rem", color: "var(--muted)", marginLeft: "var(--space-2)" }}>
          (total: {criteriaTotal}/{totalPoints} pts)
        </span>
      </h4>

      {criteria.map((c, i) => (
        <div key={c.id} style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", border: "1px solid var(--border)", borderRadius: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 1fr auto", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <label className="form-label">
              Label
              <input className="input" value={c.label} onChange={(e) => updateCriterion(i, { label: e.target.value })} placeholder="e.g. Correctness" />
            </label>
            <label className="form-label">
              Description
              <input className="input" value={c.description} onChange={(e) => updateCriterion(i, { description: e.target.value })} placeholder="What this criterion measures" />
            </label>
            <label className="form-label">
              Max Pts
              <input className="input" type="number" min={0} step={0.5} value={c.maxPoints} onChange={(e) => updateCriterion(i, { maxPoints: parseFloat(e.target.value) || 0 })} />
            </label>
            <button type="button" className="button-ghost" onClick={() => removeCriterion(i)} style={{ alignSelf: "end", color: "var(--danger-text)", fontSize: "0.85rem" }}>
              Remove
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <button type="button" className="button-ghost" onClick={addCriterion}>
          + Add Criterion
        </button>
        <button type="button" className="button" onClick={handleSave} disabled={!isValid}>
          Save Rubric
        </button>
        {!isValid && criteriaTotal !== totalPoints && (
          <span style={{ fontSize: "0.8rem", color: "var(--danger-text)" }}>
            Criteria total ({criteriaTotal}) must equal question points ({totalPoints})
          </span>
        )}
      </div>
    </div>
  );
}
