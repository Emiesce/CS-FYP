"use client";

/* ------------------------------------------------------------------ */
/*  Student – Graded Results Page                                      */
/*  Displays AI-graded + human-reviewed results for a past exam.      */
/* ------------------------------------------------------------------ */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { fetchMyGradingResult } from "@/features/grading/grading-service";
import { fetchExamDefinition } from "@/features/exams/exam-service";
import type { GradingRun, QuestionGradeResult, CriterionGradeResult } from "@/types";

/* ── helpers ─────────────────────────────────────────────────────── */

function pct(score: number, max: number) {
  if (!max) return 0;
  return Math.round((score / max) * 100);
}

function gradeLabel(p: number): { label: string; color: string; bg: string } {
  if (p >= 85) return { label: "Distinction", color: "var(--success-text)", bg: "var(--success-bg)" };
  if (p >= 70) return { label: "Credit",      color: "var(--info-text)",    bg: "var(--info-bg)"    };
  if (p >= 55) return { label: "Pass",        color: "var(--warning-text)", bg: "var(--warning-bg)" };
  return        { label: "Fail",         color: "var(--danger-text)",  bg: "var(--danger-bg)"  };
}

function ScorePill({ score, max }: { score: number; max: number }) {
  const p = pct(score, max);
  const { color, bg } = gradeLabel(p);
  return (
    <span style={{
      background: bg, color,
      borderRadius: "999px",
      padding: "0.15rem 0.65rem",
      fontWeight: 700,
      fontSize: "0.82rem",
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
    }}>
      {score} / {max}
    </span>
  );
}

/* ── Criterion row ───────────────────────────────────────────────── */

function CriterionRow({ cr }: { cr: CriterionGradeResult }) {
  const effective = cr.overrideScore ?? cr.score;
  const p = pct(effective, cr.maxPoints);
  const isOverridden = cr.overrideScore !== undefined && cr.overrideScore !== null;

  return (
    <div style={{
      borderLeft: `3px solid ${p >= 70 ? "var(--hkust-blue-700)" : p >= 40 ? "var(--hkust-gold-500)" : "var(--danger-text)"}`,
      paddingLeft: "var(--space-4)",
      marginBottom: "var(--space-3)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
          {cr.criterionLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {isOverridden && (
            <span style={{
              background: "var(--warning-bg)", color: "var(--warning-text)",
              fontSize: "0.72rem", fontWeight: 600,
              borderRadius: "999px", padding: "0.1rem 0.5rem",
            }}>
              Revised by Grader
            </span>
          )}
          <ScorePill score={effective} max={cr.maxPoints} />
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: "var(--space-2)",
        height: "6px",
        borderRadius: "999px",
        background: "var(--slate-200)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${p}%`,
          background: p >= 70 ? "var(--hkust-blue-700)" : p >= 40 ? "var(--hkust-gold-500)" : "var(--danger-text)",
          borderRadius: "999px",
          transition: "width 0.6s ease",
        }} />
      </div>

      {/* Single note: prefer reviewer rationale, fall back to AI rationale */}
      {(cr.reviewerRationale || cr.rationale) && (
        <div style={{
          marginTop: "var(--space-2)",
          background: "var(--info-bg)",
          border: "1px solid rgba(15,76,129,0.18)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-2) var(--space-3)",
          fontSize: "0.83rem",
          color: "var(--info-text)",
          lineHeight: 1.55,
        }}>
          {cr.reviewerRationale ?? cr.rationale}
        </div>
      )}
    </div>
  );
}

/* ── Question card ───────────────────────────────────────────────── */

function QuestionCard({
  qr,
  questionTitle,
  index,
  reviewComment,
}: {
  qr: QuestionGradeResult;
  questionTitle?: string;
  index: number;
  reviewComment?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const effective = qr.criterionResults.length
    ? qr.criterionResults.reduce((s, cr) => s + (cr.overrideScore ?? cr.score), 0)
    : qr.rawScore;
  const p = pct(effective, qr.maxPoints);
  const { label, color, bg } = gradeLabel(p);

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          all: "unset",
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: "var(--space-4)",
          cursor: "pointer",
          padding: 0,
        }}
        aria-expanded={expanded}
      >
        {/* Index badge */}
        <span style={{
          flexShrink: 0,
          width: "2rem", height: "2rem",
          borderRadius: "50%",
          background: "var(--hkust-blue-100)",
          color: "var(--hkust-blue-800)",
          fontWeight: 700,
          fontSize: "0.85rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {index}
        </span>

        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1rem" }}>
            {questionTitle ?? `Question ${index}`}
          </div>
          {qr.studentAnswer && (
            <div style={{
              marginTop: "var(--space-1)",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "40ch",
            }}>
              Your answer: {qr.studentAnswer}
            </div>
          )}
        </div>

        {/* Score + grade badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
          <span style={{
            background: bg, color,
            borderRadius: "999px",
            padding: "0.2rem 0.75rem",
            fontWeight: 700,
            fontSize: "0.75rem",
          }}>
            {label}
          </span>
          <ScorePill score={effective} max={qr.maxPoints} />
          <span style={{
            fontSize: "1.2rem",
            color: "var(--text-muted)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            display: "inline-block",
          }}>▾</span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>

          {/* Student answer */}
          {qr.studentAnswer && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Your Answer
              </h4>
              <div style={{
                background: "var(--surface-muted)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-3) var(--space-4)",
                fontSize: "0.9rem",
                color: "var(--text-primary)",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}>
                {qr.studentAnswer}
              </div>
            </div>
          )}

          {/* Overall rationale / review comment (no criteria rows) –
               prefer human review comment, fall back to AI rationale */}
          {qr.criterionResults.length === 0 && (reviewComment || qr.rationale) && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Grading Feedback
              </h4>
              <div style={{
                background: "var(--info-bg)",
                border: "1px solid rgba(15,76,129,0.18)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-3) var(--space-4)",
                fontSize: "0.87rem",
                color: "var(--info-text)",
                lineHeight: 1.6,
              }}>
                {reviewComment ?? qr.rationale}
              </div>
            </div>
          )}

          {/* Criteria breakdown */}
          {qr.criterionResults.length > 0 && (
            <div style={{ marginBottom: "var(--space-4)" }}>
              <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Criterion Breakdown
              </h4>
              {qr.criterionResults.map((cr) => (
                <CriterionRow key={cr.criterionId} cr={cr} />
              ))}
            </div>
          )}

          {/* Per-question review comment (when there ARE criterion rows) –
               prefer human note, only shown if criteria exist */}
          {qr.criterionResults.length > 0 && reviewComment && (
            <div style={{
              background: "var(--info-bg)",
              border: "1px solid rgba(15,76,129,0.18)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-3) var(--space-4)",
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "flex-start",
            }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>💬</span>
              <p style={{ margin: 0, fontSize: "0.87rem", color: "var(--info-text)", lineHeight: 1.55 }}>
                {reviewComment}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main content ────────────────────────────────────────────────── */

function ResultsContent({ examId }: { examId: string }) {
  const [run, setRun] = useState<GradingRun | null>(null);
  const [exam, setExam] = useState<Awaited<ReturnType<typeof fetchExamDefinition>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMyGradingResult(examId),
      fetchExamDefinition(examId),
    ])
      .then(([gradingRun, examDef]) => {
        if (cancelled) return;
        setRun(gradingRun);
        setExam(examDef);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load results.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [examId]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: "var(--space-6)" }}>
        <div className="panel" style={{ textAlign: "center", padding: "var(--space-12)" }}>
          <div style={{
            width: "3rem", height: "3rem", margin: "0 auto var(--space-4)",
            borderRadius: "50%",
            border: "3px solid var(--hkust-blue-100)",
            borderTopColor: "var(--hkust-blue-700)",
            animation: "spin 0.8s linear infinite",
          }} />
          <p className="helper-text" style={{ margin: 0 }}>Loading your graded results…</p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ display: "grid", gap: "var(--space-6)" }}>
        <Link href={`/student/exams/${examId}`} className="button-ghost" style={{ display: "inline-flex", width: "fit-content" }}>
          ← Back to Exam
        </Link>
        <div className="panel" style={{
          textAlign: "center",
          padding: "var(--space-12)",
          border: "1px dashed var(--border-strong)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>⏳</div>
          <h2 style={{ margin: "0 0 var(--space-2)", color: "var(--text-primary)" }}>
            Results Not Yet Released
          </h2>
          <p className="helper-text" style={{ margin: 0, maxWidth: "40ch", marginInline: "auto" }}>
            {error ?? "Your graded results will appear here once a human grader has reviewed and approved them."}
          </p>
        </div>
      </div>
    );
  }

  const percentage = pct(run.totalScore, run.maxTotalPoints);
  const { label: gradeText, color: gradeColor, bg: gradeBg } = gradeLabel(percentage);

  /* build a lookup of question titles */
  const questionTitleMap: Record<string, string> = {};
  if (exam) {
    for (const q of exam.questions) {
      questionTitleMap[q.id] = q.title;
    }
  }

  /* build a lookup of per-question reviewer comments */
  const reviewCommentMap: Record<string, string> = {};
  for (const review of run.reviews) {
    if (review.comment) {
      reviewCommentMap[review.questionId] = review.comment;
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Back + header */}
      <div>
        <Link href={`/student/exams/${examId}`} className="button-ghost" style={{ display: "inline-flex", marginBottom: "var(--space-4)" }}>
          ← Back to Exam
        </Link>
        <h1 className="page-title" style={{ marginBottom: "var(--space-1)" }}>
          {exam ? `${exam.courseCode} – ${exam.title}` : "Graded Results"}
        </h1>
        <p className="page-subtitle" style={{ margin: 0 }}>
          {exam?.courseName ?? ""}
        </p>
      </div>

      {/* ── Overall scorecard ── */}
      <div className="panel" style={{
        background: `linear-gradient(135deg, var(--hkust-blue-900) 0%, var(--hkust-blue-700) 100%)`,
        color: "#fff",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "var(--space-6)",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7, marginBottom: "var(--space-2)" }}>
            Final Score
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1 }}>
              {run.totalScore}
            </span>
            <span style={{ fontSize: "1.4rem", opacity: 0.7 }}>
              / {run.maxTotalPoints}
            </span>
          </div>
          <div style={{ marginTop: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span style={{
              background: gradeBg, color: gradeColor,
              borderRadius: "999px",
              padding: "0.3rem 1rem",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}>
              {gradeText}
            </span>
          </div>
        </div>

        {/* Circular percentage */}
        <div style={{
          width: "7rem", height: "7rem",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "3px solid rgba(255,255,255,0.25)",
        }}>
          <span style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1 }}>{percentage}%</span>
          <span style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: "0.2rem" }}>Score</span>
        </div>
      </div>
      {/* ── Notice ── */}
      <div style={{
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "center",
        background: "var(--info-bg)",
        border: "1px solid rgba(15,76,129,0.18)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
      }}>
        <p style={{ margin: 0, fontSize: "0.87rem", color: "var(--info-text)", lineHeight: 1.55 }}>
          These results have been reviewed and approved by a human grader. Grader feedback is provided for each criterion.
        </p>
      </div>

      {/* ── Per-question cards ── */}
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
          Question-by-Question Breakdown
        </h2>
        {run.questionResults.map((qr, idx) => (
          <QuestionCard
            key={qr.questionId}
            qr={qr}
            index={idx + 1}
            questionTitle={questionTitleMap[qr.questionId]}
            reviewComment={reviewCommentMap[qr.questionId]}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Page export ─────────────────────────────────────────────────── */

export default function StudentResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return (
    <AuthenticatedShell requiredRole="student">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <ResultsContent examId={examId} />
    </AuthenticatedShell>
  );
}
