"use client";

/* ------------------------------------------------------------------ */
/*  Per-Run Grading Review – question-by-question evidence view       */
/*  Supports blind criterion-level review and student switching.      */
/* ------------------------------------------------------------------ */

import { use, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CriterionScoreCard } from "@/components/grading/CriterionScoreCard";
import { EvidenceHighlighter } from "@/components/grading/EvidenceHighlighter";
import { GradingSummaryCard } from "@/components/grading/GradingSummaryCard";
import { getGradingRun, listGradingRuns, submitReview } from "@/features/grading/grading-service";
import {
  getAllSubmissions,
  getAllSubmissionsServer,
  refreshExamSubmissions,
  subscribeToExamAnswers,
} from "@/features/exams/exam-answer-store";
import { QUESTION_TYPE_LABELS } from "@/types";
import type { CriterionGradeResult, GradingRun } from "@/types";
import Link from "next/link";

interface CachedRunRef {
  id: string;
}

function readSessionCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getDraftKey(questionId: string, criterionId: string): string {
  return `${questionId}:${criterionId}`;
}

function AttemptReviewContent({
  examId,
  attemptId,
}: {
  examId: string;
  attemptId: string;
}) {
  const router = useRouter();
  const submissions = useSyncExternalStore(
    subscribeToExamAnswers,
    getAllSubmissions,
    getAllSubmissionsServer,
  );
  const [run, setRun] = useState<GradingRun | null>(null);
  const [cachedRunsByStudent, setCachedRunsByStudent] = useState<
    Record<string, CachedRunRef>
  >(() => readSessionCache(`grading_runs_${examId}`, {}));
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<string | null>(null);
  const [criterionDraftScores, setCriterionDraftScores] = useState<Record<string, string>>({});
  const [criterionDraftReasoning, setCriterionDraftReasoning] = useState<Record<string, string>>({});
  const [criterionReviewSavingId, setCriterionReviewSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshExamSubmissions(examId);
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getGradingRun(examId, attemptId);
        if (!cancelled) {
          setRun(data);
          setCachedRunsByStudent(readSessionCache(`grading_runs_${examId}`, {}));
          if (data.questionResults.length > 0) {
            setSelectedQ(data.questionResults[0].questionId);
            setActiveCriterion(data.questionResults[0].criterionResults[0]?.criterionId ?? null);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [examId, attemptId]);

  useEffect(() => {
    let cancelled = false;
    void listGradingRuns(examId)
      .then((runs) => {
        if (cancelled) return;
        const nextMap: Record<string, CachedRunRef> = {};
        for (const gradingRun of runs) {
          nextMap[gradingRun.studentId] = { id: gradingRun.id };
        }
        setCachedRunsByStudent((prev) => ({ ...prev, ...nextMap }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const currentQ = run?.questionResults.find((qr) => qr.questionId === selectedQ) ?? null;

  useEffect(() => {
    if (!currentQ) return;
    if (
      currentQ.criterionResults.length > 0 &&
      !currentQ.criterionResults.some((criterion) => criterion.criterionId === activeCriterion)
    ) {
      setActiveCriterion(currentQ.criterionResults[0].criterionId);
    }
    if (currentQ.criterionResults.length === 0) {
      setActiveCriterion(null);
    }
  }, [activeCriterion, currentQ]);

  const questionAveragePct = useMemo(() => {
    if (!currentQ || currentQ.maxPoints <= 0) return 0;
    return Math.round((currentQ.rawScore / currentQ.maxPoints) * 100);
  }, [currentQ]);

  const currentQAllReviewed = useMemo(() => {
    if (!currentQ) return false;
    return currentQ.criterionResults.length === 0 ||
      currentQ.criterionResults.every((cr) => cr.overrideScore != null ||
        (criterionDraftScores[getDraftKey(currentQ.questionId, cr.criterionId)] ?? "").trim() !== "");
  }, [currentQ, criterionDraftScores]);

  const availableStudents = useMemo(() => {
    if (!run) return [];
    const runMap: Record<string, CachedRunRef> = {
      ...cachedRunsByStudent,
      [run.studentId]: { id: run.id },
    };

    return submissions
      .filter((submission) => submission.examId === examId && runMap[submission.studentId])
      .map((submission) => ({
        studentId: submission.studentId,
        studentName: submission.studentName ?? submission.studentId,
        runId: runMap[submission.studentId].id,
      }));
  }, [cachedRunsByStudent, examId, run, submissions]);

  const currentStudentId = run?.studentId ?? null;
  const currentStudentIndex = useMemo(
    () =>
      currentStudentId
        ? availableStudents.findIndex((student) => student.studentId === currentStudentId)
        : -1,
    [availableStudents, currentStudentId],
  );

  const navigateToStudent = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= availableStudents.length) return;
      const selected = availableStudents[nextIndex];
      if (!selected) return;
      router.push(`/staff/exams/${examId}/grading/${selected.runId}`);
    },
    [availableStudents, examId, router],
  );

  const getCriterionDraftScore = useCallback(
    (questionId: string, criterion: CriterionGradeResult): string => {
      const key = getDraftKey(questionId, criterion.criterionId);
      return criterionDraftScores[key] ??
        (criterion.overrideScore != null ? String(criterion.overrideScore) : "");
    },
    [criterionDraftScores],
  );

  const getCriterionDraftReasoning = useCallback(
    (questionId: string, criterion: CriterionGradeResult): string => {
      const key = getDraftKey(questionId, criterion.criterionId);
      return criterionDraftReasoning[key] ?? (criterion.reviewerRationale ?? "");
    },
    [criterionDraftReasoning],
  );

  const handleCriterionReview = useCallback(
    async (criterion: CriterionGradeResult) => {
      if (!currentQ) return;

      const key = getDraftKey(currentQ.questionId, criterion.criterionId);
      const rawValue = (criterionDraftScores[key] ?? "").trim();
      if (!rawValue) {
        setError("Enter your own score before revealing or saving the AI criterion assessment.");
        return;
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        setError("Criterion override score must be a valid number.");
        return;
      }

      const overrideScore = Math.max(0, Math.min(parsed, criterion.maxPoints));
      const reasoning = (criterionDraftReasoning[key] ?? "").trim();

      try {
        setCriterionReviewSavingId(criterion.criterionId);
        const updated = await submitReview(examId, attemptId, {
          questionId: currentQ.questionId,
          accepted: true,
          criteriaOverrides: [
            {
              criterionId: criterion.criterionId,
              overrideScore,
              reasoning: reasoning || undefined,
            },
          ],
        });
        setRun(updated);
        setCachedRunsByStudent(readSessionCache(`grading_runs_${examId}`, {}));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Criterion review failed");
      } finally {
        setCriterionReviewSavingId(null);
      }
    },
    [attemptId, criterionDraftReasoning, criterionDraftScores, currentQ, examId],
  );

  if (loading) return <div className="empty-state">Loading grading results…</div>;
  if (!run) return <div className="empty-state">No grading results found.</div>;

  return (
    <>
      <div style={{ marginBottom: "var(--space-5)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Link href={`/staff/exams/${examId}/grading`} className="button-ghost" style={{ marginBottom: "var(--space-3)", display: "inline-flex", textDecoration: "none" }}>
              ← Back to Grading
            </Link>
            <h1 style={{ fontSize: "1.4rem", marginBottom: "var(--space-1)" }}>
              Grading Review
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Run {run.id} · Attempt {attemptId}
            </p>
          </div>

          <div className="panel" style={{ minWidth: 320, padding: "var(--space-3) var(--space-4)" }}>
            <label className="form-label" style={{ marginBottom: 6, display: "block" }}>
              Switch Student
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <button
                type="button"
                className="button-ghost"
                onClick={() => navigateToStudent(currentStudentIndex - 1)}
                disabled={currentStudentIndex <= 0}
                aria-label="Previous student"
              >
                ←
              </button>
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div style={{ fontWeight: 600 }}>
                  {availableStudents[currentStudentIndex]?.studentName ?? run.studentId}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Student {currentStudentIndex + 1} of {availableStudents.length}
                </div>
              </div>
              <button
                type="button"
                className="button-ghost"
                onClick={() => navigateToStudent(currentStudentIndex + 1)}
                disabled={currentStudentIndex < 0 || currentStudentIndex >= availableStudents.length - 1}
                aria-label="Next student"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="panel"
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid color-mix(in srgb, var(--danger-text) 28%, white)",
            background: "color-mix(in srgb, var(--danger-text) 8%, white)",
            color: "var(--danger-text)",
          }}
        >
          {error}
        </div>
      )}

      {(() => {
        const revealMap: Record<string, boolean> = {};
        for (const qr of run.questionResults) {
          revealMap[qr.questionId] =
            qr.criterionResults.length === 0
              ? true  // no criteria to review — score is directly visible
              : qr.criterionResults.every((cr) =>
                  cr.overrideScore != null ||
                  (criterionDraftScores[getDraftKey(qr.questionId, cr.criterionId)] ?? "").trim() !== ""
                );
        }
        return <GradingSummaryCard run={run} revealedQuestions={revealMap} />;
      })()}

      {/* Question selector */}
      <div
        role="tablist"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--space-2)",
          marginBottom: "var(--space-5)",
        }}
      >
        {run.questionResults.map((qr, i) => {
          const allCriteriaReviewed = qr.criterionResults.length === 0 ||
            qr.criterionResults.every((cr) => cr.overrideScore != null ||
              (criterionDraftScores[getDraftKey(qr.questionId, cr.criterionId)] ?? "").trim() !== "");
          return (
          <button
            key={qr.questionId}
            type="button"
            role="tab"
            aria-selected={selectedQ === qr.questionId}
            className="panel"
            onClick={() => {
              setSelectedQ(qr.questionId);
              setActiveCriterion(qr.criterionResults[0]?.criterionId ?? null);
            }}
            style={{
              textAlign: "left",
              padding: "var(--space-3)",
              border: selectedQ === qr.questionId ? "2px solid var(--primary)" : "1px solid var(--border-default)",
              background: selectedQ === qr.questionId ? "color-mix(in srgb, var(--primary) 6%, var(--surface-raised))" : "var(--surface-raised)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: 6 }}>
              <strong>Q{i + 1}</strong>
              {allCriteriaReviewed ? (
                <span className={`badge ${qr.status === "reviewed" ? "badge-info" : "badge-success"}`}>
                  {qr.rawScore}/{qr.maxPoints}
                </span>
              ) : (
                <span className="badge" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>??/{qr.maxPoints}</span>
              )}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {QUESTION_TYPE_LABELS[qr.questionType] ?? qr.questionType}
            </div>
          </button>
          );
        })}
      </div>

      {/* Selected question detail */}
      {currentQ && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(460px, 1.15fr)", gap: "var(--space-5)", alignItems: "start" }}>
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="panel" style={{ padding: "var(--space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", margin: "0 0 var(--space-2)" }}>
                    {QUESTION_TYPE_LABELS[currentQ.questionType] ?? currentQ.questionType}
                  </h3>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span className="badge badge-info">{currentQ.lane}</span>
                    {currentQAllReviewed ? (
                      <span className={`badge ${questionAveragePct >= 70 ? "badge-success" : questionAveragePct >= 40 ? "badge-warning" : "badge-danger"}`}>
                        {currentQ.rawScore}/{currentQ.maxPoints}
                      </span>
                    ) : (
                      <span className="badge" style={{ color: "var(--muted)" }}>??/{currentQ.maxPoints}</span>
                    )}
                    {currentQ.model && (
                      <span className="badge">{currentQ.model}</span>
                    )}
                  </div>
                </div>
                {currentQAllReviewed ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
                      {questionAveragePct}%
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Current question score
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--muted)" }}>
                      ??
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Review all criteria first
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel" style={{ padding: "var(--space-5)" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                Student Answer {currentQAllReviewed ? "With Evidence" : ""}
              </div>
              <EvidenceHighlighter
                answerText={currentQ.studentAnswer || "No student answer available for this result."}
                evidenceSpans={currentQAllReviewed ? currentQ.evidenceSpans : []}
                activeCriterionId={currentQAllReviewed ? (activeCriterion ?? undefined) : undefined}
              />
            </div>
          </div>

          <div className="panel" style={{ padding: "var(--space-5)" }}>
            <h3 style={{ fontSize: "1rem", margin: "0 0 var(--space-3)" }}>
              Criteria Breakdown ({currentQ.criterionResults.length})
            </h3>
            {currentQ.criterionResults.map((cr) => {
              const draftScore = getCriterionDraftScore(currentQ.questionId, cr);
              const draftReasoning = getCriterionDraftReasoning(currentQ.questionId, cr);
              const revealAiAssessment =
                draftScore.trim() !== "" || cr.overrideScore != null;

              return (
                <CriterionScoreCard
                  key={cr.criterionId}
                  criterion={cr}
                  isActive={activeCriterion === cr.criterionId}
                  hideAssessment={!revealAiAssessment}
                  onClick={() =>
                    setActiveCriterion(
                      activeCriterion === cr.criterionId ? null : cr.criterionId,
                    )
                  }
                >
                  {activeCriterion === cr.criterionId && (
                    <div
                      style={{
                        paddingTop: "var(--space-4)",
                        borderTop: "1px solid var(--border-default)",
                        display: "grid",
                        gap: "var(--space-3)",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--muted)", lineHeight: 1.6 }}>
                        Review this criterion first with your own score and reasoning. The AI criterion score and rationale stay hidden until you enter a score.
                      </p>

                      <label className="form-label">
                        Your Score (max {cr.maxPoints})
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={cr.maxPoints}
                          step={0.5}
                          value={draftScore}
                          onChange={(event) =>
                            setCriterionDraftScores((prev) => ({
                              ...prev,
                              [getDraftKey(currentQ.questionId, cr.criterionId)]: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="form-label">
                        Your Reasoning
                        <textarea
                          className="input"
                          rows={4}
                          value={draftReasoning}
                          onChange={(event) =>
                            setCriterionDraftReasoning((prev) => ({
                              ...prev,
                              [getDraftKey(currentQ.questionId, cr.criterionId)]: event.target.value,
                            }))
                          }
                          placeholder="Explain how you assessed this criterion..."
                          style={{ resize: "vertical" }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="button"
                          onClick={() => {
                            void handleCriterionReview(cr);
                          }}
                          disabled={criterionReviewSavingId === cr.criterionId}
                        >
                          {criterionReviewSavingId === cr.criterionId ? "Saving..." : "Save Criterion Review"}
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => {
                            setCriterionDraftScores((prev) => ({
                              ...prev,
                              [getDraftKey(currentQ.questionId, cr.criterionId)]:
                                cr.overrideScore != null ? String(cr.overrideScore) : "",
                            }));
                            setCriterionDraftReasoning((prev) => ({
                              ...prev,
                              [getDraftKey(currentQ.questionId, cr.criterionId)]:
                                cr.reviewerRationale ?? "",
                            }));
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </CriterionScoreCard>
              );
            })}
            {currentQ.criterionResults.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                No structured criteria available for this question.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function AttemptReviewPage({
  params,
}: {
  params: Promise<{ examId: string; attemptId: string }>;
}) {
  const { examId, attemptId } = use(params);
  return <AttemptReviewContent examId={examId} attemptId={attemptId} />;
}
