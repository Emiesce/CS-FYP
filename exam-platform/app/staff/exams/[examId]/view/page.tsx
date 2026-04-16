"use client";

/* ------------------------------------------------------------------ */
/*  Exam Question Viewer (Read-Only)                                  */
/*  /staff/exams/[examId]/view                                        */
/*  Accessible to: instructor + teaching_assistant                    */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DEMO_EXAM_DEFINITION } from "@/lib/fixtures";
import { computeTotalPoints } from "@/features/exams/exam-service";
import { QUESTION_TYPE_LABELS } from "@/types";
import type { ExamDefinition, ExamQuestion } from "@/types";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Resolve fixture                                                   */
/* ------------------------------------------------------------------ */

function loadDefinition(examId: string): ExamDefinition | null {
  if (DEMO_EXAM_DEFINITION.id === examId) return DEMO_EXAM_DEFINITION;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Read-only question card                                           */
/* ------------------------------------------------------------------ */

function QuestionCard({ question, index }: { question: ExamQuestion; index: number }) {
  return (
    <div className="panel" style={{ marginBottom: "var(--space-4)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Q{index + 1}.</span>
          <span className="badge badge-info" style={{ fontSize: "0.75rem" }}>
            {QUESTION_TYPE_LABELS[question.type]}
          </span>
          {question.required && (
            <span className="badge badge-warning" style={{ fontSize: "0.75rem" }}>Required</span>
          )}
        </div>
        <span className="badge badge-success" style={{ fontSize: "0.8rem" }}>
          {question.points} pt{question.points !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Title + Prompt */}
      <p style={{ margin: 0, fontWeight: 600, marginBottom: "var(--space-2)" }}>{question.title}</p>
      <p style={{ margin: 0, marginBottom: "var(--space-3)", lineHeight: 1.6 }}>{question.prompt}</p>

      {/* MCQ options */}
      {question.type === "mcq" && (
        <ol type="A" style={{ paddingLeft: "1.4rem", margin: 0, display: "grid", gap: "var(--space-2)" }}>
          {question.options.map((opt) => (
            <li
              key={opt.id}
              style={{
                fontSize: "0.9rem",
                color: opt.isCorrect ? "var(--success-text, #166534)" : undefined,
                fontWeight: opt.isCorrect ? 600 : undefined,
              }}
            >
              {opt.label}
              {opt.isCorrect && (
                <span style={{ marginLeft: "var(--space-2)", fontSize: "0.75rem" }}>(correct)</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Short / Long / Essay — response area placeholder */}
      {(question.type === "short_answer" || question.type === "long_answer" || question.type === "essay") && (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
            padding: "var(--space-3)",
            fontSize: "0.85rem",
            color: "var(--muted)",
            background: "var(--surface-raised)",
          }}
        >
          {question.type === "short_answer" && "Short answer response area"}
          {question.type === "long_answer" && `Long answer response area${question.expectedLengthHint ? ` (${question.expectedLengthHint})` : ""}`}
          {question.type === "essay" && `Essay response area${question.expectedLengthHint ? ` (${question.expectedLengthHint})` : ""}`}
        </div>
      )}

      {/* Coding */}
      {question.type === "coding" && (
        <div>
          <p style={{ margin: 0, marginBottom: "var(--space-2)", fontSize: "0.85rem", color: "var(--muted)" }}>
            Language: <strong>{question.language}</strong>
          </p>
          {question.starterCode && (
            <pre
              style={{
                margin: 0,
                padding: "var(--space-3)",
                background: "var(--surface-raised)",
                borderRadius: "var(--radius)",
                fontSize: "0.85rem",
                overflow: "auto",
              }}
            >
              {question.starterCode}
            </pre>
          )}
          {question.constraints && (
            <p style={{ marginTop: "var(--space-2)", marginBottom: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
              <strong>Constraints:</strong> {question.constraints}
            </p>
          )}
        </div>
      )}

      {/* Mathematics */}
      {question.type === "mathematics" && question.answerFormatHint && (
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
          Answer format: <em>{question.answerFormatHint}</em>
        </p>
      )}

      {/* Rubric */}
      {question.rubric && (
        <div
          style={{
            marginTop: "var(--space-3)",
            paddingTop: "var(--space-3)",
            borderTop: "1px solid var(--border)",
            fontSize: "0.85rem",
            color: "var(--muted)",
          }}
        >
          <strong>Rubric:</strong> {question.rubric.text}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page content                                                      */
/* ------------------------------------------------------------------ */

function ExamViewerContent() {
  const params = useParams<{ examId: string }>();
  const definition = useMemo(() => loadDefinition(params.examId), [params.examId]);
  const [activeSection, setActiveSection] = useState<"info" | "questions">("questions");

  const totalPoints = useMemo(
    () => (definition ? computeTotalPoints(definition.questions) : 0),
    [definition],
  );

  if (!definition) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "var(--space-10)" }}>
        <p>Exam not found or not yet available for preview.</p>
        <Link href="/staff" className="button-ghost" style={{ textDecoration: "none", marginTop: "var(--space-4)" }}>
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: "var(--space-6)" }}>
        <div className="flex-row">
          <Link href="/staff" className="button-ghost" style={{ textDecoration: "none" }}>
            ← Back
          </Link>
          <h1 className="page-title" style={{ fontSize: "1.5rem" }}>
            View Questions
          </h1>
        </div>
        <span className="badge badge-warning" style={{ fontSize: "0.85rem" }}>
          Read-Only
        </span>
      </div>

      {/* Exam info banner */}
      <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)" }}>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Course</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{definition.courseCode} – {definition.courseName}</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Title</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{definition.title}</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Date</p>
            <p style={{ margin: 0 }}>{definition.date} {definition.startTime}</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Duration</p>
            <p style={{ margin: 0 }}>{Math.round(definition.durationSeconds / 60)} min</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Total Points</p>
            <p style={{ margin: 0, fontWeight: 600 }}>{totalPoints} pts</p>
          </div>
          <div>
            <p className="form-label" style={{ marginBottom: 2 }}>Questions</p>
            <p style={{ margin: 0 }}>{definition.questions.length}</p>
          </div>
        </div>
        {definition.instructions && (
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border)" }}>
            <p className="form-label" style={{ marginBottom: "var(--space-2)" }}>Instructions</p>
            <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, color: "var(--muted)" }}>{definition.instructions}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-list" role="tablist" style={{ marginBottom: "var(--space-5)" }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "questions"}
          className={`tab-button ${activeSection === "questions" ? "is-active" : ""}`}
          onClick={() => setActiveSection("questions")}
        >
          Questions ({definition.questions.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "info"}
          className={`tab-button ${activeSection === "info" ? "is-active" : ""}`}
          onClick={() => setActiveSection("info")}
        >
          Exam Info
        </button>
      </div>

      {activeSection === "questions" && (
        definition.questions.length === 0 ? (
          <div className="empty-state">No questions have been added to this exam yet.</div>
        ) : (
          <div>
            {definition.questions.map((q, i) => (
              <QuestionCard key={q.id} question={q} index={i} />
            ))}
          </div>
        )
      )}

      {activeSection === "info" && (
        <div className="panel">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            Exam ID: <code>{definition.id}</code><br />
            Created: {definition.createdAt.replace("T", " ").slice(0, 16)} UTC<br />
            Last updated: {definition.updatedAt.replace("T", " ").slice(0, 16)} UTC
          </p>
        </div>
      )}
    </>
  );
}

export default function ExamViewPage() {
  return (
    <AuthenticatedShell requiredRole="staff">
      <ExamViewerContent />
    </AuthenticatedShell>
  );
}
