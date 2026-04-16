"use client";

/* ------------------------------------------------------------------ */
/*  QuestionListSidebar – left panel listing all questions             */
/* ------------------------------------------------------------------ */

import type { ExamQuestion, QuestionType } from "@/types";
import { QUESTION_TYPE_LABELS } from "@/types";
import { createDefaultQuestion } from "@/features/exams/exam-service";

interface QuestionListSidebarProps {
  questions: ExamQuestion[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (question: ExamQuestion) => void;
  onReorder: (questions: ExamQuestion[]) => void;
}

const ADDABLE_TYPES: QuestionType[] = [
  "mcq",
  "short_answer",
  "long_answer",
  "essay",
  "coding",
  "mathematics",
];

export function QuestionListSidebar({
  questions,
  activeId,
  onSelect,
  onAdd,
}: QuestionListSidebarProps) {
  const handleAdd = (type: QuestionType) => {
    const q = createDefaultQuestion(type, questions.length + 1);
    onAdd(q);
  };

  return (
    <div
      className="panel"
      style={{
        display: "grid",
        gap: "var(--space-3)",
        alignContent: "start",
        minWidth: 260,
        maxHeight: "calc(100vh - 14rem)",
        overflowY: "auto",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-secondary)" }}>
        Questions ({questions.length})
      </h3>

      <div className="list-stack" style={{ gap: "var(--space-2)" }}>
        {questions.map((q) => (
          <button
            key={q.id}
            className={activeId === q.id ? "question-sidebar-item active" : "question-sidebar-item"}
            onClick={() => onSelect(q.id)}
          >
            <span className="question-sidebar-order">Q{q.order}</span>
            <span className="question-sidebar-meta">
              <span className="question-sidebar-title">{q.title || "Untitled"}</span>
              <span className="question-sidebar-type">
                {QUESTION_TYPE_LABELS[q.type]} · {q.points} pts
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Add question dropdown-style buttons */}
      <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: 0 }} />
      <p className="helper-text" style={{ margin: 0 }}>Add question</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {ADDABLE_TYPES.map((t) => (
          <button
            key={t}
            className="button-ghost"
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", minHeight: "auto" }}
            onClick={() => handleAdd(t)}
          >
            + {QUESTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
