"use client";

/* ------------------------------------------------------------------ */
/*  AnswerInputs – per-question-type student answer components        */
/* ------------------------------------------------------------------ */

import type {
  ExamQuestion,
  McqQuestion,
  ShortAnswerQuestion,
  LongAnswerQuestion,
  EssayQuestion,
  CodingQuestion,
  MathQuestion,
} from "@/types";

/* ---- shared callback shape -------------------------------------- */
export type OnAnswerChange = (value: string | string[]) => void;

/* ---- MCQ -------------------------------------------------------- */

export function McqInput({
  question,
  value,
  onChange,
}: {
  question: McqQuestion;
  value: string[];
  onChange: OnAnswerChange;
}) {
  const toggle = (optId: string) => {
    if (question.allowMultiple) {
      onChange(
        value.includes(optId)
          ? value.filter((v) => v !== optId)
          : [...value, optId],
      );
    } else {
      onChange([optId]);
    }
  };

  return (
    <div className="form-stack" style={{ gap: "var(--space-2)" }}>
      {question.options.map((opt) => (
        <label
          key={opt.id}
          className={`mcq-option${value.includes(opt.id) ? " selected" : ""}`}
        >
          <input
            type={question.allowMultiple ? "checkbox" : "radio"}
            name={`mcq-${question.id}`}
            checked={value.includes(opt.id)}
            onChange={() => toggle(opt.id)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---- Short Answer ----------------------------------------------- */

export function ShortAnswerInput({
  question,
  value,
  onChange,
}: {
  question: ShortAnswerQuestion;
  value: string;
  onChange: OnAnswerChange;
}) {
  return (
    <div>
      <textarea
        className="textarea"
        rows={3}
        maxLength={question.maxLength}
        placeholder={question.placeholder || "Type your answer here…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {question.maxLength && (
        <p className="helper-text" style={{ textAlign: "right", margin: "var(--space-1) 0 0" }}>
          {value.length} / {question.maxLength}
        </p>
      )}
    </div>
  );
}

/* ---- Long Answer ------------------------------------------------ */

export function LongAnswerInput({
  question,
  value,
  onChange,
}: {
  question: LongAnswerQuestion;
  value: string;
  onChange: OnAnswerChange;
}) {
  return (
    <div>
      <textarea
        className="textarea"
        rows={8}
        placeholder="Write your answer…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {question.expectedLengthHint && (
        <p className="helper-text" style={{ margin: "var(--space-1) 0 0" }}>
          Expected length: {question.expectedLengthHint}
        </p>
      )}
    </div>
  );
}

/* ---- Essay ------------------------------------------------------ */

export function EssayInput({
  question,
  value,
  onChange,
}: {
  question: EssayQuestion;
  value: string;
  onChange: OnAnswerChange;
}) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div>
      <textarea
        className="textarea"
        rows={14}
        placeholder="Write your essay…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: "flex", justifyContent: "space-between", margin: "var(--space-1) 0 0" }}>
        <p className="helper-text" style={{ margin: 0 }}>
          {question.expectedLengthHint ? `Expected: ${question.expectedLengthHint}` : ""}
        </p>
        <p className="helper-text" style={{ margin: 0 }}>
          {wordCount} word{wordCount !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

/* ---- Coding ----------------------------------------------------- */

export function CodingInput({
  question,
  value,
  onChange,
}: {
  question: CodingQuestion;
  value: string;
  onChange: OnAnswerChange;
}) {
  const lines = value.split("\n");
  const lineCount = Math.max(lines.length, 16);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <span className="badge badge-info" style={{ fontSize: "0.8rem" }}>
          {question.language}
        </span>
        {question.constraints && (
          <span className="helper-text">{question.constraints}</span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border-default)",
          background: "#1e1e2e",
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace",
          fontSize: "0.875rem",
          lineHeight: "1.5",
        }}
      >
        {/* Line numbers gutter */}
        <div
          aria-hidden="true"
          style={{
            padding: "0.75rem 0.5rem",
            textAlign: "right",
            color: "#6c7086",
            userSelect: "none",
            borderRight: "1px solid #313244",
            background: "#181825",
            minWidth: "3rem",
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ height: "1.5em" }}>
              {i + 1}
            </div>
          ))}
        </div>
        {/* Code editor area */}
        <textarea
          className="code-editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={`# Write your ${question.language} code here…`}
          style={{
            flex: 1,
            padding: "0.75rem",
            margin: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#cdd6f4",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "inherit",
            resize: "vertical",
            minHeight: `${lineCount * 1.5}em`,
            tabSize: 4,
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
          }}
          onKeyDown={(e) => {
            // Tab inserts spaces instead of switching focus
            if (e.key === "Tab") {
              e.preventDefault();
              const target = e.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const newValue = value.substring(0, start) + "    " + value.substring(end);
              onChange(newValue);
              // Restore cursor position after React re-render
              requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 4;
              });
            }
          }}
        />
      </div>
      <p className="helper-text" style={{ margin: "var(--space-1) 0 0", color: "var(--text-muted)" }}>
        {lines.length} line{lines.length !== 1 ? "s" : ""} · Tab inserts 4 spaces
      </p>
    </div>
  );
}

/* ---- Mathematics ------------------------------------------------ */

export function MathInput({
  question,
  value,
  onChange,
}: {
  question: MathQuestion;
  value: string;
  onChange: OnAnswerChange;
}) {
  return (
    <div>
      <textarea
        className="textarea"
        rows={6}
        placeholder={question.answerFormatHint || "Enter your answer…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {question.answerFormatHint && (
        <p className="helper-text" style={{ margin: "var(--space-1) 0 0" }}>
          Format: {question.answerFormatHint}
        </p>
      )}
    </div>
  );
}

/* ---- Dispatcher ------------------------------------------------- */

export function AnswerInput({
  question,
  value,
  onChange,
}: {
  question: ExamQuestion;
  value: string | string[];
  onChange: OnAnswerChange;
}) {
  switch (question.type) {
    case "mcq":
      return (
        <McqInput
          question={question}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    case "short_answer":
      return (
        <ShortAnswerInput
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "long_answer":
      return (
        <LongAnswerInput
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "essay":
      return (
        <EssayInput
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "coding":
      return (
        <CodingInput
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    case "mathematics":
      return (
        <MathInput
          question={question}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
  }
}
