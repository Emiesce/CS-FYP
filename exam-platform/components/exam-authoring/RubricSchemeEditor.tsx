"use client";

/* ------------------------------------------------------------------ */
/*  RubricSchemeEditor – full rubric / marking scheme builder for the  */
/*  exam-authoring flow. Instructors define criteria with flexible     */
/*  score-range bands, optional model answers, and can invoke an AI   */
/*  agent to auto-generate band descriptions.                         */
/* ------------------------------------------------------------------ */

import { useCallback, useRef, useState } from "react";
import type { RubricCriterion, RubricScoreBand, StructuredRubric } from "@/types";
import { uid } from "@/lib/utils/format";
import { generateRubric } from "@/features/grading/grading-service";

/* ------------------------------------------------------------------ */
/*  Inline SVG icons (small, professional)                            */
/* ------------------------------------------------------------------ */

const IconSparkles = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
);

const IconClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
  </svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

const IconWarning = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Rubric file parser                                                */
/* ------------------------------------------------------------------ */

/**
 * Attempt to parse an uploaded file (JSON or plain-text) into
 * an array of RubricCriterion objects.
 *
 * Supported formats:
 *  1. Platform JSON (StructuredRubric or array of criteria)
 *  2. Loose JSON with snake_case keys from the backend
 *  3. Plain-text heuristic: lines starting with numbers / dashes
 */
function parseRubricFile(text: string, questionId: string, totalPoints: number): StructuredRubric {
  // ---- Try JSON first ----
  try {
    const raw = JSON.parse(text);

    // Helper: snake_case → camelCase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function toCamel(obj: any): any {
      if (Array.isArray(obj)) return obj.map(toCamel);
      if (obj !== null && typeof obj === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj)) {
          const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
          out[camel] = toCamel(v);
        }
        return out;
      }
      return obj;
    }

    const data = toCamel(raw);

    // Accept StructuredRubric shape
    const criteriaArr: RubricCriterion[] = (data.criteria ?? (Array.isArray(data) ? data : [])).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any): RubricCriterion => ({
        id: c.id ?? uid(),
        label: c.label ?? c.name ?? "Criterion",
        description: c.description ?? "",
        maxPoints: typeof c.maxPoints === "number" ? c.maxPoints : (typeof c.points === "number" ? c.points : 0),
        modelAnswer: c.modelAnswer ?? "",
        scoreBands: (c.scoreBands ?? c.bands ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any): RubricScoreBand => ({
            label: b.label ?? b.name ?? "Band",
            minPoints: typeof b.minPoints === "number" ? b.minPoints : 0,
            maxPoints: typeof b.maxPoints === "number" ? b.maxPoints : 0,
            description: b.description ?? "",
          }),
        ),
      }),
    );

    if (criteriaArr.length === 0) throw new Error("No criteria found in JSON");

    return {
      questionId,
      criteria: criteriaArr,
      totalPoints: data.totalPoints ?? totalPoints,
      version: 1,
    };
  } catch {
    // ---- Fall back: plain-text heuristic ----
    return parseTextRubric(text, questionId, totalPoints);
  }
}

/**
 * Very simple plain-text rubric parser.
 * Looks for lines like:
 *   "1. Correctness (10 pts)" or "- Correctness: 10 points"
 * and sub-lines for bands like:
 *   "  - Excellent (8-10): ..."
 */
function parseTextRubric(text: string, questionId: string, totalPoints: number): StructuredRubric {
  const lines = text.split(/\r?\n/);
  const criteria: RubricCriterion[] = [];
  let currentCrit: RubricCriterion | null = null;

  const criterionLine = /^[0-9]+[.)]\s+(.+?)\s*[\[(](\d+(?:\.\d+)?)\s*(?:pts?|points?)?[\])]/i;
  const dashCriterion = /^[-*]\s+(.+?):\s*(\d+(?:\.\d+)?)\s*(?:pts?|points?)?/i;
  const bandLine = /^\s+[-*•]\s+(.+?)\s*[\[(](\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)(?:\s*pts?)?[\])]\s*:?\s*(.*)/i;

  for (const line of lines) {
    const cm = criterionLine.exec(line) ?? dashCriterion.exec(line);
    if (cm) {
      if (currentCrit) criteria.push(currentCrit);
      currentCrit = {
        id: uid(),
        label: cm[1].trim(),
        description: "",
        maxPoints: parseFloat(cm[2]),
        modelAnswer: "",
        scoreBands: [],
      };
      continue;
    }
    const bm = bandLine.exec(line);
    if (bm && currentCrit) {
      currentCrit.scoreBands.push({
        label: bm[1].trim(),
        minPoints: parseFloat(bm[2]),
        maxPoints: parseFloat(bm[3]),
        description: bm[4]?.trim() ?? "",
      });
    }
  }
  if (currentCrit) criteria.push(currentCrit);

  // Ensure each criterion has at least 2 bands
  for (const c of criteria) {
    if (c.scoreBands.length === 0) {
      c.scoreBands = [
        { label: "Full Marks", minPoints: c.maxPoints, maxPoints: c.maxPoints, description: "" },
        { label: "No Marks", minPoints: 0, maxPoints: 0, description: "" },
      ];
    }
  }

  return { questionId, criteria, totalPoints, version: 1 };
}

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

/** Safely format a numeric value for display in an input field. */
function numDisplay(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "";
  return String(v);
}

/** Parse a numeric input string, returning 0 for empty / invalid values. */
function parseNum(v: string): number {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
}

function emptyCriterion(): RubricCriterion {
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
        value={band.label ?? ""}
        onChange={(e) => onChange({ ...band, label: e.target.value })}
        style={{ fontSize: "0.85rem" }}
      />
      <input
        className="input"
        type="number"
        min={0}
        step={0.5}
        placeholder="Min"
        value={numDisplay(band.minPoints)}
        onChange={(e) => onChange({ ...band, minPoints: parseNum(e.target.value) })}
        style={{ fontSize: "0.85rem" }}
      />
      <input
        className="input"
        type="number"
        min={0}
        step={0.5}
        placeholder="Max"
        value={numDisplay(band.maxPoints)}
        onChange={(e) => onChange({ ...band, maxPoints: parseNum(e.target.value) })}
        style={{ fontSize: "0.85rem" }}
      />
      <textarea
        className="textarea"
        rows={2}
        placeholder="Describe what a student must demonstrate to earn this range…"
        value={band.description ?? ""}
        onChange={(e) => onChange({ ...band, description: e.target.value })}
        style={{ fontSize: "0.82rem", resize: "vertical" }}
      />
      <button
        type="button"
        className="button-ghost"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove band"
        style={{ color: canRemove ? "var(--danger-text)" : "var(--muted)", padding: "0.3rem 0.5rem" }}
      >
        <IconTrash />
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
  isMcq,
}: {
  criterion: RubricCriterion;
  index: number;
  onUpdate: (updated: RubricCriterion) => void;
  onRemove: () => void;
  onGenerateDescriptions: () => void;
  isGenerating: boolean;
  isMcq: boolean;
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
          style={{ color: "var(--danger-text)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
        >
          <IconTrash /> Remove Criterion
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
            value={criterion.label ?? ""}
            onChange={(e) => onUpdate({ ...criterion, label: e.target.value })}
          />
        </label>
        <label className="form-label" style={{ fontSize: "0.85rem" }}>
          Description
          <input
            className="input"
            placeholder="What does this criterion assess?"
            value={criterion.description ?? ""}
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
            value={numDisplay(criterion.maxPoints)}
            onChange={(e) => onUpdate({ ...criterion, maxPoints: parseNum(e.target.value) })}
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
              style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
              onClick={addBand}
            >
              <IconPlus /> Add Range
            </button>
            {criterion.modelAnswer?.trim() && (
              <button
                type="button"
                className="button-secondary"
                style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
                onClick={onGenerateDescriptions}
                disabled={isGenerating || isMcq}
                title={isMcq ? "AI rubric generation is not available for multiple-choice questions" : undefined}
              >
                <IconSparkles /> {isGenerating ? "Generating…" : "Generate Descriptions"}
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
  const isMcq = questionType === "mcq";

  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initialRubric?.criteria ?? [],
  );
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const criteriaTotal = criteria.reduce((s, c) => s + c.maxPoints, 0);

  const emitChange = useCallback(
    (next: RubricCriterion[]) => {
      setCriteria(next);
      onChange?.(buildRubric(questionId, next, totalPoints));
    },
    [onChange, questionId, totalPoints],
  );

  /* ---- Upload rubric ------------------------------------------------ */
  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-uploaded if needed
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseRubricFile(text, questionId, totalPoints);
        emitChange(parsed.criteria);
        setUploadError(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to parse rubric file.");
      }
    };
    reader.readAsText(file);
  };

  const addCriterion = () => emitChange([...criteria, emptyCriterion()]);

  const removeCriterion = (idx: number) => emitChange(criteria.filter((_, i) => i !== idx));

  const updateCriterion = (idx: number, updated: RubricCriterion) => {
    const next = criteria.map((c, i) => (i === idx ? updated : c));
    emitChange(next);
  };

  /* ---- AI generation for one criterion's bands --------------------- */
  const handleGenerateDescriptions = useCallback(
    async (idx: number) => {
      const crit = criteria[idx];
      if (!crit.modelAnswer?.trim()) return;

      setGeneratingIdx(idx);
      setGenError(null);

      try {
        const { rubric: generated } = await generateRubric({
          examId,
          questionId,
          questionPrompt,
          questionType,
          points: crit.maxPoints || totalPoints,
          modelAnswer: crit.modelAnswer,
          instructorNotes: `Criterion: ${crit.label || "Unnamed criterion"}. ${crit.description || ""}. Generate appropriate score bands with labels, point ranges, and descriptions. Determine the best max points and score distribution for this criterion.`,
        });

        const generatedCrit = generated.criteria[0];
        if (generatedCrit) {
          const generatedBands = generatedCrit.scoreBands ?? [];
          // Use AI-generated bands entirely (labels, ranges, descriptions)
          const updatedMaxPoints = generatedCrit.maxPoints || crit.maxPoints;
          updateCriterion(idx, {
            ...crit,
            maxPoints: updatedMaxPoints,
            label: crit.label || generatedCrit.label || crit.label,
            description: crit.description || generatedCrit.description || crit.description,
            scoreBands: generatedBands.length > 0 ? generatedBands : (crit.scoreBands ?? []),
          });
        }
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "Failed to generate rubric");
      } finally {
        setGeneratingIdx(null);
      }
    },
    [criteria, examId, questionId, questionPrompt, questionType, totalPoints],
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

  // MCQ questions are deterministic — hide the rubric builder entirely
  if (isMcq) return null;

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
          <h4 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <IconClipboard /> Rubric / Marking Scheme
          </h4>
          <span className="helper-text" style={{ fontSize: "0.82rem" }}>
            Define criteria, score ranges, and optional model answers.
            Total: <strong>{String(criteriaTotal)}</strong> / {String(totalPoints)} pts
            {Math.abs(criteriaTotal - totalPoints) > 0.01 && criteriaTotal > 0 && (
              <span style={{ color: "var(--danger-text)", marginLeft: "var(--space-2)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconWarning /> Does not match question points
              </span>
            )}
          </span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {/* Hidden file input for rubric upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt,.md,.csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="button-ghost"
            style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
            onClick={handleUploadClick}
            title="Upload a rubric file (JSON or plain text)"
          >
            <IconUpload /> Upload Rubric
          </button>
          <button
            type="button"
            className="button-secondary"
            style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
            onClick={handleGenerateFullRubric}
            disabled={generatingAll || isMcq}
            title={isMcq ? "AI rubric generation is not available for multiple-choice questions" : undefined}
          >
            <IconSparkles /> {generatingAll ? "Generating…" : "Generate Full Rubric"}
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          className="badge-danger"
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
          }}
        >
          Upload error: {uploadError}
        </div>
      )}

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
          isMcq={isMcq}
        />
      ))}

      {/* Add Criterion */}
      <button
        type="button"
        className="button-ghost"
        style={{ justifySelf: "start", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
        onClick={addCriterion}
      >
        <IconPlus /> Add Criterion
      </button>
    </div>
  );
}
