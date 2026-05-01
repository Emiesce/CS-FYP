"use client";

/* ------------------------------------------------------------------ */
/*  View Student Answers – read-only display of a student's submission */
/* ------------------------------------------------------------------ */

import { use, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getAllSubmissions,
  getAllSubmissionsServer,
  refreshExamSubmissions,
  subscribeToExamAnswers,
} from "@/features/exams/exam-answer-store";
import { fetchExamDefinition } from "@/features/exams/exam-service";
import type { ExamDefinition, ExamQuestion, McqQuestion, QuestionResponse } from "@/types";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatAnsweredAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function McqAnswerDisplay({
  question,
  value,
}: {
  question: McqQuestion;
  value: string | string[];
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {question.options.map((opt) => {
        const isChosen = selected.includes(opt.id);
        return (
          <div
            key={opt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "8px 12px",
              borderRadius: 6,
              background: isChosen ? "var(--primary-subtle, #ebf5ff)" : "var(--surface-hover)",
              border: isChosen ? "1.5px solid var(--primary)" : "1.5px solid transparent",
              fontWeight: isChosen ? 600 : 400,
              color: isChosen ? "var(--primary)" : "var(--text)",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: isChosen ? "5px solid var(--primary)" : "2px solid var(--border)",
                flexShrink: 0,
              }}
            />
            {opt.label}
          </div>
        );
      })}
    </div>
  );
}

function TextAnswerDisplay({ value }: { value: string | string[] }) {
  const text = Array.isArray(value) ? value.join("\n") : value;
  if (!text.trim()) {
    return <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer provided</span>;
  }
  return (
    <div
      style={{
        background: "var(--surface-hover)",
        borderRadius: 6,
        padding: "12px 16px",
        whiteSpace: "pre-wrap",
        lineHeight: 1.6,
        fontFamily: "inherit",
        fontSize: "0.95rem",
      }}
    >
      {text}
    </div>
  );
}

function CodeAnswerDisplay({ value }: { value: string | string[] }) {
  const code = Array.isArray(value) ? value.join("\n") : value;
  if (!code.trim()) {
    return <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No code submitted</span>;
  }
  return (
    <pre
      style={{
        background: "#1e1e2e",
        color: "#cdd6f4",
        borderRadius: 6,
        padding: "14px 16px",
        overflowX: "auto",
        fontSize: "0.875rem",
        lineHeight: 1.55,
        margin: 0,
      }}
    >
      <code>{code}</code>
    </pre>
  );
}

function QuestionAnswerCard({
  question,
  response,
  index,
}: {
  question: ExamQuestion;
  response: QuestionResponse | undefined;
  index: number;
}) {
  const hasResponse = !!response;

  return (
    <div
      className="panel"
      style={{ marginBottom: "var(--space-4)", opacity: hasResponse ? 1 : 0.6 }}
    >
      {/* Question header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-3)",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              background: "var(--primary)",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: "0.8rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Q{index + 1}
          </span>
          <span
            style={{
              background: "var(--surface-hover)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: "0.75rem",
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {question.type.replace("_", " ")}
          </span>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {question.points} {question.points === 1 ? "pt" : "pts"}
          </span>
        </div>
        {hasResponse && (
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            Answered at {formatAnsweredAt(response.answeredAt)}
          </span>
        )}
        {!hasResponse && (
          <span className="badge badge-warning" style={{ fontSize: "0.78rem" }}>
            Not answered
          </span>
        )}
      </div>

      {/* Question prompt */}
      {question.title && (
        <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
          {question.title}
        </div>
      )}
      {question.prompt && (
        <div
          style={{
            color: "var(--text)",
            marginBottom: "var(--space-3)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {question.prompt}
        </div>
      )}

      {/* Divider */}
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "var(--space-3) 0" }} />

      {/* Student answer */}
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Student&apos;s Answer
        </div>
        {!hasResponse ? (
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No answer submitted</span>
        ) : question.type === "mcq" ? (
          <McqAnswerDisplay
            question={question as McqQuestion}
            value={response.value}
          />
        ) : question.type === "coding" ? (
          <CodeAnswerDisplay value={response.value} />
        ) : (
          <TextAnswerDisplay value={response.value} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

function ViewAnswersContent({ examId, attemptId }: { examId: string; attemptId: string }) {
  const router = useRouter();
  const [definition, setDefinition] = useState<ExamDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submissions = useSyncExternalStore(
    subscribeToExamAnswers,
    getAllSubmissions,
    getAllSubmissionsServer,
  );

  useEffect(() => {
    void refreshExamSubmissions(examId);
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    fetchExamDefinition(examId)
      .then((def) => {
        if (!cancelled) setDefinition(def);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load exam");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId]);

  const submission = submissions.find((s) => s.attemptId === attemptId);

  if (loading) {
    return <div className="empty-state">Loading...</div>;
  }

  if (error) {
    return <div style={{ color: "var(--danger-text)" }}>Error: {error}</div>;
  }

  if (!definition) {
    return <div className="empty-state">Exam not found.</div>;
  }

  if (!submission) {
    return <div className="empty-state">Submission not found.</div>;
  }

  // Build a map from questionId → response for O(1) lookup
  const responseMap = new Map<string, QuestionResponse>(
    submission.responses.map((r) => [r.questionId, r]),
  );

  const answeredCount = submission.responses.length;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ marginBottom: "var(--space-3)" }}>
          <Link
            href={`/staff/exams/${examId}/grading`}
            style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none" }}
          >
            ← Back to Grading Dashboard
          </Link>
        </div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
          {definition.title} – Student Answers
        </h1>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", color: "var(--muted)", fontSize: "0.9rem" }}>
          <span>
            <strong style={{ color: "var(--text)" }}>
              {submission.studentName ?? submission.studentId}
            </strong>
            {submission.studentName && (
              <span style={{ marginLeft: 6 }}>({submission.studentId})</span>
            )}
          </span>
          <span>
            Submitted: {new Date(submission.submittedAt).toLocaleString()}
          </span>
          <span>
            Answers: {answeredCount} / {definition.questions.length}
          </span>
        </div>
      </div>

      {/* Question-by-question answers */}
      <div>
        {definition.questions
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((question, index) => (
            <QuestionAnswerCard
              key={question.id}
              question={question}
              response={responseMap.get(question.id)}
              index={index}
            />
          ))}
      </div>
    </>
  );
}

export default function ViewAnswersPage({
  params,
}: {
  params: Promise<{ examId: string; attemptId: string }>;
}) {
  const { examId, attemptId } = use(params);
  return <ViewAnswersContent examId={examId} attemptId={attemptId} />;
}
