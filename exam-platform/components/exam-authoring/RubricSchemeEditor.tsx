"use client";

/* ------------------------------------------------------------------ */
/*  RubricSchemeEditor – full rubric / marking scheme builder for the  */
/*  exam-authoring flow. Instructors define criteria with flexible     */
/*  score-range bands, optional model answers, and can invoke an AI   */
/*  agent to auto-generate band descriptions.                         */
/* ------------------------------------------------------------------ */

import { useCallback, useState } from "react";
import type { RubricCriterion, RubricScoreBand, StructuredRubric } from "@/types";
import { uid } from "@/lib/utils/format";
import { generateRubric } from "@/features/grading/grading-service";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface RubricSchemeEditorProps {
  questionId: string;
  questionPrompt: string;
  questionType: string;
  examId: string;
  totalPoints: number;
  initialRubric?: StructuredRubric;
  onChange?: (rubric: StructuredRubric) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function emptyBand(idx: number, maxPts: number): RubricScoreBand {
  if (idx === 0) return { label: "Excellent", minPoints: Math.ceil(maxPts * 0.8), maxPoints: maxPts, description: "" };
  if (idx === 1) return { label: "Good", minPoints: Math.ceil(maxPts * 0.5), maxPoints: Math.ceil(maxPts * 0.8) - 1, description: "" };
  return { label: "Poor", minPoints: 0, maxPoints: Math.ceil(maxPts * 0.5) - 1, description: "" };
}

function emptyCriterion(idx: number): RubricCriterion {
  return {
    id: uid(),
    label: "",
    description: "",
    maxPoints: 0,
    modelAnswer: "",
    scoreBands: [
      { label: "Full Marks", minPoints: 0, maxPoints: 0, description: "" },
      { label: "No Marks", minPoints: 0, maxPoints: 0, description: "" },
    ],
  };
}

function buildRubric(
  questionId: string,
  criteria: RubricCriterion[],
  totalPoints: number,
): StructuredRubric {
  return { questionId, criteria, totalPoints, version: 1 };
}

/* ------------------------------------------------------------------ */
/*  Score Band Row                                                    */
/* ------------------------------------------------------------------ */

function ScoreBandRow({
  band,
  bandIndex,
  onChange,
  onRemove,
  canRemove,
}: {
  band: RubricScoreBand;
  bandIndex: number;
  onChange: (updated: RubricScoreBand) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 80px 2fr auto",
        gap: "var(--space-2)",
        alignItems: "start",
        padding: "var(--space-2) 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <input
        className="input"
        placeholder="e.g. Excellent"
        value={band.label}
        onChange={(e) => onChange({ ...band, label: e.target.value })}
        style={{ fontSize: "0.85rem" }}
      />
      <input
        className="input"
        type="number"
        min={0}
        step={0.5}
        placeholder="Min"
        value={band.minPoints}
        onChange={(e) => onChange({ ...band, minPoints: parseFloat(e.target.value) || 0 })}
        style={{ fontSize: "0.85rem" }}
      />
      <input
        className="input"
        type="number"
        min={0}
        step={0.5}
        placeholder="Max"
        value={band.maxPoints}
        onChange={(e) => onChange({ ...band, maxPoints: parseFloat(e.target.value) || 0 })}
        style={{ fontSize: "0.85rem" }}
      />
      <textarea
        className="textarea"
        rows={2}
        placeholder="Describe what a student must demonstrate to earn this range…"
        value={band.description}
        onChange={(e) => onChange({ ...band, description: e.target.value })}
        style={{ fontSize: "0.82rem", resize: "vertical" }}
      />
      <button
        type="button"
        className="button-ghost"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove band"
        style={{ color: canRemove ? "var(--danger-text)" : "var(--muted)", fontSize: "0.85rem", padding: "0.3rem 0.5rem" }}
      >
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Criterion Card                                                    */
/* ------------------------------------------------------------------ */

function CriterionCard({
  criterion,
  index,
  onUpdate,
  onRemove,
  onGenerateDescriptions,
  isGenerating,
}: {
  criterion: RubricCriterion;
  index: number;
  onUpdate: (updated: RubricCriterion) => void;
  onRemove: () => void;
  onGenerateDescriptions: () => void;
  isGenerating: boolean;
}) {
  const updateBand = (bIdx: number, updated: RubricScoreBand) => {
    const bands = [...(criterion.scoreBands ?? [])];
    bands[bIdx] = updated;
    onUpdate({ ...criterion, scoreBands: bands });
  };

  const removeBand = (bIdx: number) => {
    onUpdate({ ...criterion, scoreBands: (criterion.scoreBands ?? []).filter((_, i) => i !== bIdx) });
  };

  const addBand = () => {
    onUpdate({
      ...criterion,
      scoreBands: [
        ...(criterion.scoreBands ?? []),
        { label: "", minPoints: 0, maxPoints: 0, description: "" },
      ],
    });
  };

  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        background: "var(--surface-raised)",
        marginBottom: "var(--space-3)",
      }}
    >
      {/* Criterion header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-3)",
        }}
      >
        <span
          className="badge badge-info"
          style={{ fontSize: "0.78rem" }}
        >
          Criterion {index + 1}
        </span>
        <button
          type="button"
          className="button-ghost"
          onClick={onRemove}
          style={{ color: "var(--danger-text)", fontSize: "0.82rem" }}
        >
          Remove Criterion
        </button>
      </div>

      {/* Label, Description, Max Points */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 100px",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
        }}
      >
        <label className="form-label" style={{ fontSize: "0.85rem" }}>
          Label
          <input
            className="input"
            placeholder="e.g. Correctness"
            value={criterion.label}
            onChange={(e) => onUpdate({ ...criterion, label: e.target.value })}
          />
        </label>
        <label className="form-label" style={{ fontSize: "0.85rem" }}>
          Description
          <input
            className="input"
            placeholder="What does this criterion assess?"
            value={criterion.description}
            onChange={(e) => onUpdate({ ...criterion, description: e.target.value })}
          />
        </label>
        <label className="form-label" style={{ fontSize: "0.85rem" }}>
          Max Pts
          <input
            className="input"
            type="number"
            min={0}
            step={0.5}
            value={criterion.maxPoints}
            onChange={(e) => onUpdate({ ...criterion, maxPoints: parseFloat(e.target.value) || 0 })}
          />
        </label>
      </div>

      {/* Model Answer (optional) */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <label className="form-label" style={{ fontSize: "0.85rem" }}>
          Model Answer{" "}
          <span style={{ fontWeight: "normal", color: "var(--muted)" }}>(optional – helps AI generate better band descriptions)</span>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Provide an ideal answer for this criterion…"
            value={criterion.modelAnswer ?? ""}
            onChange={(e) => onUpdate({ ...criterion, modelAnswer: e.target.value })}
            style={{ fontSize: "0.85rem" }}
          />
        </label>
      </div>

      {/* Score Bands */}
      <div style={{ marginBottom: "var(--space-2)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-2)",
          }}
        >
          <p
            className="helper-text"
            style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}
          >
            Score Ranges ({criterion.scoreBands?.length ?? 0})
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="button-ghost"
              style={{ fontSize: "0.82rem" }}
              onClick={addBand}
            >
              + Add Range
            </button>
            {criterion.modelAnswer?.trim() && (
              <button
                type="button"
                className="button-secondary"
                style={{ fontSize: "0.82rem" }}
                onClick={onGenerateDescriptions}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating…" : "🤖 Generate Descriptions"}
              </button>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 2fr auto",
            gap: "var(--space-2)",
            padding: "0 0 var(--space-1)",
            borderBottom: "2px solid var(--border-default)",
          }}
        >
          <span className="helper-text" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Band Label</span>
          <span className="helper-text" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Min Pts</span>
          <span className="helper-text" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Max Pts</span>
          <span className="helper-text" style={{ fontSize: "0.75rem", fontWeight: 600 }}>Description</span>
          <span />
        </div>

        {(criterion.scoreBands ?? []).map((band, bIdx) => (
          <ScoreBandRow
            key={bIdx}
            band={band}
            bandIndex={bIdx}
            onChange={(b) => updateBand(bIdx, b)}
            onRemove={() => removeBand(bIdx)}
            canRemove={(criterion.scoreBands?.length ?? 0) > 1}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export function RubricSchemeEditor({
  questionId,
  questionPrompt,
  questionType,
  examId,
  totalPoints,
  initialRubric,
  onChange,
}: RubricSchemeEditorProps) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initialRubric?.criteria ?? [],
  );
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const criteriaTotal = criteria.reduce((s, c) => s + c.maxPoints, 0);

  const emitChange = useCallback(
    (next: RubricCriterion[]) => {
      setCriteria(next);
      onChange?.(buildRubric(questionId, next, totalPoints));
    },
    [onChange, questionId, totalPoints],
  );

  const addCriterion = () => emitChange([...criteria, emptyCriterion(criteria.length)]);

  const removeCriterion = (idx: number) => emitChange(criteria.filter((_, i) => i !== idx));

  const updateCriterion = (idx: number, updated: RubricCriterion) => {
    const next = criteria.map((c, i) => (i === idx ? updated : c));
    emitChange(next);
  };

  /* ---- AI generation for one criterion's band descriptions -------- */
  const handleGenerateDescriptions = useCallback(
    async (idx: number) => {
      const crit = criteria[idx];
      if (!crit.modelAnswer?.trim()) return;

      const existingBands = crit.scoreBands ?? [];

      setGeneratingIdx(idx);
      setGenError(null);

      try {
        const { rubric: generated } = await generateRubric({
          examId,
          questionId,
          questionPrompt,
          questionType,
          points: crit.maxPoints,
          modelAnswer: crit.modelAnswer,
          instructorNotes: existingBands.length > 0
            ? `Criterion: ${crit.label}. ${crit.description}. Generate exactly ${existingBands.length} score bands with the following labels (preserving their min/max point ranges): ${existingBands.map((b) => `"${b.label}" (${b.minPoints}-${b.maxPoints})`).join(", ")}.`
            : `Criterion: ${crit.label}. ${crit.description}.`,
        });

        // Merge the generated descriptions back into the criterion's bands
        const generatedCrit = generated.criteria[0];
        if (generatedCrit) {
          const generatedBands = generatedCrit.scoreBands ?? [];
          const updatedBands = existingBands.map((band, bIdx) => {
            const genBand = generatedBands[bIdx];
            return genBand
              ? { ...band, description: genBand.description || band.description }
              : band;
          });
          // If the AI returned more bands than we asked, append them
          if (generatedBands.length > existingBands.length) {
            for (let i = existingBands.length; i < generatedBands.length; i++) {
              updatedBands.push(generatedBands[i]);
            }
          }
          updateCriterion(idx, { ...crit, scoreBands: updatedBands.length > 0 ? updatedBands : generatedBands });
        }
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "Failed to generate descriptions");
      } finally {
        setGeneratingIdx(null);
      }
    },
    [criteria, examId, questionId, questionPrompt, questionType],
  );

  /* ---- Full rubric generation ------------------------------------- */
  const [generatingAll, setGeneratingAll] = useState(false);

  const handleGenerateFullRubric = useCallback(async () => {
    setGeneratingAll(true);
    setGenError(null);
    try {
      // Collect all model answers from existing criteria
      const combinedModelAnswer = criteria
        .filter((c) => c.modelAnswer?.trim())
        .map((c) => `[${c.label || "Criterion"}]: ${c.modelAnswer}`)
        .join("\n\n");

      const { rubric } = await generateRubric({
        examId,
        questionId,
        questionPrompt,
        questionType,
        points: totalPoints,
        modelAnswer: combinedModelAnswer || undefined,
      });
      emitChange(rubric.criteria);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate rubric");
    } finally {
      setGeneratingAll(false);
    }
  }, [criteria, emitChange, examId, questionId, questionPrompt, questionType, totalPoints]);

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-default)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: "1rem" }}>
            📋 Rubric / Marking Scheme
          </h4>
          <span className="helper-text" style={{ fontSize: "0.82rem" }}>
            Define criteria, score ranges, and optional model answers.
            Total: <strong>{criteriaTotal}</strong> / {totalPoints} pts
            {Math.abs(criteriaTotal - totalPoints) > 0.01 && criteriaTotal > 0 && (
              <span style={{ color: "var(--danger-text)", marginLeft: "var(--space-2)" }}>
                ⚠ Does not match question points
              </span>
            )}
          </span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            type="button"
            className="button-secondary"
            style={{ fontSize: "0.85rem" }}
            onClick={handleGenerateFullRubric}
            disabled={generatingAll}
          >
            {generatingAll ? "Generating…" : "🤖 Generate Full Rubric"}
          </button>
        </div>
      </div>

      {genError && (
        <div
          className="badge-danger"
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
          }}
        >
          {genError}
        </div>
      )}

      {/* Criteria */}
      {criteria.length === 0 && (
        <div
          className="panel"
          style={{
            display: "grid",
            placeItems: "center",
            padding: "var(--space-6)",
            color: "var(--muted)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            No criteria defined yet. Add one manually or generate a full rubric with AI.
          </p>
        </div>
      )}

      {criteria.map((crit, idx) => (
        <CriterionCard
          key={crit.id}
          criterion={crit}
          index={idx}
          onUpdate={(updated) => updateCriterion(idx, updated)}
          onRemove={() => removeCriterion(idx)}
          onGenerateDescriptions={() => handleGenerateDescriptions(idx)}
          isGenerating={generatingIdx === idx}
        />
      ))}

      {/* Add Criterion */}
      <button
        type="button"
        className="button-ghost"
        style={{ justifySelf: "start", fontSize: "0.9rem" }}
        onClick={addCriterion}
      >
        + Add Criterion
      </button>
    </div>
  );
}
