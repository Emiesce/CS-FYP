"use client";

/* ------------------------------------------------------------------ */
/*  QuestionEditorPanel – right-hand editor for the active question   */
/* ------------------------------------------------------------------ */

import type {
  ExamQuestion,
  McqQuestion,
  ShortAnswerQuestion,
  LongAnswerQuestion,
  EssayQuestion,
  CodingQuestion,
  MathQuestion,
  McqOption,
  StructuredRubric,
} from "@/types";
import { QUESTION_TYPE_LABELS } from "@/types";
import { uid } from "@/lib/utils/format";
import { RubricSchemeEditor } from "./RubricSchemeEditor";

interface QuestionEditorPanelProps {
  question: ExamQuestion;
  examId?: string;
  onChange: (updated: ExamQuestion) => void;
  onDelete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Sub-editors for each question type                                */
/* ------------------------------------------------------------------ */

function McqFields({
  question,
  onChange,
}: {
  question: McqQuestion;
  onChange: (q: McqQuestion) => void;
}) {
  const updateOption = (idx: number, patch: Partial<McqOption>) => {
    const next = [...question.options];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...question, options: next });
  };

  const addOption = () =>
    onChange({
      ...question,
      options: [...question.options, { id: uid(), label: "", isCorrect: false }],
    });

  const removeOption = (idx: number) =>
    onChange({ ...question, options: question.options.filter((_, i) => i !== idx) });

  return (
    <div className="form-stack">
      <label className="form-label">
        <input
          type="checkbox"
          checked={question.allowMultiple}
          onChange={(e) => onChange({ ...question, allowMultiple: e.target.checked })}
        />{" "}
        Allow multiple selections
      </label>

      <div>
        <p className="helper-text" style={{ marginBottom: "var(--space-2)" }}>
          Options
        </p>
        {question.options.map((opt, idx) => (
          <div
            key={opt.id}
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "center",
              marginBottom: "var(--space-2)",
            }}
          >
            <input
              type="checkbox"
              checked={opt.isCorrect}
              title="Mark as correct"
              onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
            />
            <input
              className="input"
              value={opt.label}
              placeholder={`Option ${idx + 1}`}
              onChange={(e) => updateOption(idx, { label: e.target.value })}
            />
            <button
              className="button-ghost"
              style={{ minHeight: "2rem", padding: "0.4rem 0.6rem", color: "var(--danger-text)" }}
              onClick={() => removeOption(idx)}
              title="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="button-ghost" style={{ fontSize: "0.9rem" }} onClick={addOption}>
          + Add option
        </button>
      </div>
    </div>
  );
}

function ShortAnswerFields({
  question,
  onChange,
}: {
  question: ShortAnswerQuestion;
  onChange: (q: ShortAnswerQuestion) => void;
}) {
  return (
    <div className="form-stack">
      <label className="form-label">
        Max length
        <input
          className="input"
          type="number"
          value={question.maxLength ?? ""}
          placeholder="500"
          onChange={(e) =>
            onChange({ ...question, maxLength: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </label>
      <label className="form-label">
        Placeholder text
        <input
          className="input"
          value={question.placeholder ?? ""}
          onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
        />
      </label>
    </div>
  );
}

function LongAnswerFields({
  question,
  onChange,
}: {
  question: LongAnswerQuestion;
  onChange: (q: LongAnswerQuestion) => void;
}) {
  return (
    <label className="form-label">
      Expected length hint
      <input
        className="input"
        value={question.expectedLengthHint ?? ""}
        placeholder="200-400 words"
        onChange={(e) => onChange({ ...question, expectedLengthHint: e.target.value })}
      />
    </label>
  );
}

function EssayFields({
  question,
  onChange,
}: {
  question: EssayQuestion;
  onChange: (q: EssayQuestion) => void;
}) {
  return (
    <label className="form-label">
      Expected length hint
      <input
        className="input"
        value={question.expectedLengthHint ?? ""}
        placeholder="500-1000 words"
        onChange={(e) => onChange({ ...question, expectedLengthHint: e.target.value })}
      />
    </label>
  );
}

function CodingFields({
  question,
  onChange,
}: {
  question: CodingQuestion;
  onChange: (q: CodingQuestion) => void;
}) {
  return (
    <div className="form-stack">
      <label className="form-label">
        Language
        <select
          className="select"
          value={question.language}
          onChange={(e) => onChange({ ...question, language: e.target.value })}
        >
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="javascript">JavaScript</option>
          <option value="c">C</option>
        </select>
      </label>
      <label className="form-label">
        Starter code
        <textarea
          className="textarea"
          rows={8}
          value={question.starterCode}
          onChange={(e) => onChange({ ...question, starterCode: e.target.value })}
          style={{ fontFamily: "monospace", fontSize: "0.9rem" }}
        />
      </label>
      <label className="form-label">
        Constraints / test notes
        <textarea
          className="textarea"
          rows={3}
          value={question.constraints ?? ""}
          onChange={(e) => onChange({ ...question, constraints: e.target.value })}
        />
      </label>
    </div>
  );
}

function MathFields({
  question,
  onChange,
}: {
  question: MathQuestion;
  onChange: (q: MathQuestion) => void;
}) {
  return (
    <label className="form-label">
      Answer format hint
      <input
        className="input"
        value={question.answerFormatHint ?? ""}
        placeholder="e.g. numeric expression"
        onChange={(e) => onChange({ ...question, answerFormatHint: e.target.value })}
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel component                                              */
/* ------------------------------------------------------------------ */

export function QuestionEditorPanel({ question, examId, onChange, onDelete }: QuestionEditorPanelProps) {
  const updateBase = (patch: Partial<ExamQuestion>) => onChange({ ...question, ...patch } as ExamQuestion);

  return (
    <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="badge badge-info">{QUESTION_TYPE_LABELS[question.type]}</span>
        <button
          className="button-ghost"
          style={{ color: "var(--danger-text)", fontSize: "0.85rem" }}
          onClick={onDelete}
        >
          Delete question
        </button>
      </div>

      {/* Common fields */}
      <div className="form-stack">
        <label className="form-label">
          Title
          <input
            className="input"
            value={question.title}
            onChange={(e) => updateBase({ title: e.target.value })}
          />
        </label>
        <label className="form-label">
          Prompt / Instructions
          <textarea
            className="textarea"
            rows={4}
            value={question.prompt}
            onChange={(e) => updateBase({ prompt: e.target.value })}
          />
        </label>
        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <label className="form-label" style={{ flex: 1 }}>
            Points
            <input
              className="input"
              type="number"
              min={0}
              value={question.points}
              onChange={(e) => updateBase({ points: Number(e.target.value) })}
            />
          </label>
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "1.5rem" }}>
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => updateBase({ required: e.target.checked })}
            />
            Required
          </label>
        </div>
      </div>

      {/* Rubric / Marking Scheme Editor */}
      <RubricSchemeEditor
        questionId={question.id}
        questionPrompt={question.prompt}
        questionType={question.type}
        examId={examId ?? "draft"}
        totalPoints={question.points}
        onChange={(rubric: StructuredRubric) => {
          updateBase({
            rubric: {
              text: rubric.criteria.map((c) => `${c.label}: ${c.description}`).join("\n"),
              structuredRubric: rubric,
              attachment: question.rubric?.attachment,
            },
          });
        }}
      />

      {/* Type-specific fields */}
      <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: 0 }} />
      {question.type === "mcq" && (
        <McqFields question={question} onChange={(q) => onChange(q)} />
      )}
      {question.type === "short_answer" && (
        <ShortAnswerFields question={question} onChange={(q) => onChange(q)} />
      )}
      {question.type === "long_answer" && (
        <LongAnswerFields question={question} onChange={(q) => onChange(q)} />
      )}
      {question.type === "essay" && (
        <EssayFields question={question} onChange={(q) => onChange(q)} />
      )}
      {question.type === "coding" && (
        <CodingFields question={question} onChange={(q) => onChange(q)} />
      )}
      {question.type === "mathematics" && (
        <MathFields question={question} onChange={(q) => onChange(q)} />
      )}
    </div>
  );
}
