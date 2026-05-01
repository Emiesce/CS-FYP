"use client";

/* ------------------------------------------------------------------ */
/*  Staff Grading Dashboard – list attempts and trigger AI grading    */
/*  Supports individual live review and batch grading with progress.  */
/* ------------------------------------------------------------------ */

import { use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fetchExamDefinition } from "@/features/exams/exam-service";
import type { ExamDefinition } from "@/types";
import {
  getAllSubmissions,
  getAllSubmissionsServer,
  refreshExamSubmissions,
  subscribeToExamAnswers,
} from "@/features/exams/exam-answer-store";
import type { ExamSubmissionStatus } from "@/features/exams/exam-answer-store";
import {
  streamGradingRun,
  clearAllGradingResults,
  type StreamingAnswerPayload,
  type StreamingGradingRun,
} from "@/features/grading/stream-grading";
import { listGradingRuns } from "@/features/grading/grading-service";
import Link from "next/link";

type GradingRunData = StreamingGradingRun;

type ProgressStatus = "queued" | "grading" | "completed" | "failed";

interface StudentGradingProgress {
  status: ProgressStatus;
  completedQuestions: number;
  totalQuestions: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

function writeSessionCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

function getRunMaxPoints(run: GradingRunData): number {
  return run.max_total_points ?? run.max_possible ?? run.question_results.reduce((sum, question) => sum + question.max_points, 0);
}

function getProgressPercent(progress: StudentGradingProgress | undefined): number {
  if (!progress) return 0;
  if (progress.status === "queued") return 5;
  if (progress.status === "grading") {
    if (progress.totalQuestions <= 0) return 15;
    return Math.max(15, (progress.completedQuestions / progress.totalQuestions) * 100);
  }
  if (progress.status === "completed") return 100;
  if (progress.totalQuestions <= 0) return 100;
  return Math.max(
    15,
    (progress.completedQuestions / progress.totalQuestions) * 100,
  );
}

function GradingDashboardContent({ examId }: { examId: string }) {
  const submissions = useSyncExternalStore(
    subscribeToExamAnswers,
    getAllSubmissions,
    getAllSubmissionsServer,
  );

  useEffect(() => {
    void refreshExamSubmissions(examId);
  }, [examId]);

  const examSubmissions = useMemo(
    () => submissions.filter((s) => s.examId === examId),
    [submissions, examId],
  );

  const [definition, setDefinition] = useState<ExamDefinition | null>(null);
  useEffect(() => {
    fetchExamDefinition(examId).then(setDefinition).catch(() => {});
  }, [examId]);

  const [gradingRuns, setGradingRuns] = useState<Record<string, GradingRunData>>({});
  const [gradingSignatures, setGradingSignatures] = useState<Record<string, string>>({});
  const [studentProgress, setStudentProgress] = useState<
    Record<string, StudentGradingProgress>
  >({});
  const [error, setError] = useState<string | null>(null);
  const controllersRef = useRef<Record<string, AbortController>>({});

  // Clean up stale persistent cache from older builds.
  useEffect(() => {
    localStorage.removeItem(`grading_runs_${examId}`);
    localStorage.removeItem(`grading_run_signatures_${examId}`);
    sessionStorage.removeItem(`grading_runs_${examId}`);
    sessionStorage.removeItem(`grading_run_signatures_${examId}`);
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    void listGradingRuns(examId)
      .then((runs) => {
        if (cancelled) return;
        // Replace the entire map with what the DB returns — never merge from cache.
        const next: Record<string, GradingRunData> = {};
        for (const run of runs) {
          next[run.studentId] = {
            id: run.id,
            status: run.status,
            total_score: run.totalScore,
            max_total_points: run.maxTotalPoints,
            question_results: run.questionResults.map((question) => ({
              question_id: question.questionId,
              question_type: question.questionType,
              raw_score: question.rawScore,
              max_points: question.maxPoints,
              normalized_score: question.normalizedScore,
              rationale: question.rationale,
              lane: question.lane,
              model: question.model ?? null,
              status: question.status,
              evidence_spans: question.evidenceSpans,
              criterion_results: question.criterionResults.map((criterion) => ({
                criterion_id: criterion.criterionId,
                criterion_label: criterion.criterionLabel,
                score: criterion.score,
                max_points: criterion.maxPoints,
                rationale: criterion.rationale,
                evidence_spans: criterion.evidenceSpans,
                override_score: criterion.overrideScore ?? null,
                reviewer_rationale: criterion.reviewerRationale ?? null,
              })),
            })),
            started_at: run.startedAt,
            completed_at: run.completedAt ?? null,
          };
        }
        setGradingRuns(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    return () => {
      Object.values(controllersRef.current).forEach((controller) => controller.abort());
      controllersRef.current = {};
    };
  }, []);

  const buildAnswers = useCallback(
    (sub: ExamSubmissionStatus): StreamingAnswerPayload[] =>
      sub.responses.map((r) => ({
        question_id: r.questionId,
        value: Array.isArray(r.value) ? r.value.join(", ") : r.value,
      })),
    [],
  );

  const buildAnswerSignature = useCallback(
    (sub: ExamSubmissionStatus, answers: StreamingAnswerPayload[]) =>
      JSON.stringify({
        submittedAt: sub.submittedAt,
        answers,
      }),
    [],
  );

  const persistPendingSubmission = useCallback(
    (
      sub: ExamSubmissionStatus,
      answers: StreamingAnswerPayload[],
      answerSignature: string,
    ) => {
      writeSessionCache(
        `grading_answers_${examId}_${sub.studentId}`,
        answers,
      );
      sessionStorage.setItem(
        `grading_submission_signature_${examId}_${sub.studentId}`,
        answerSignature,
      );
      sessionStorage.removeItem(`grading_result_${examId}_${sub.studentId}`);
      sessionStorage.removeItem(`grading_result_signature_${examId}_${sub.studentId}`);
    },
    [examId],
  );

  const cacheCompletedRun = useCallback(
    (studentId: string, run: GradingRunData, answerSignature: string) => {
      setGradingRuns((prev) => ({ ...prev, [studentId]: run }));
      setGradingSignatures((prev) => ({ ...prev, [studentId]: answerSignature }));
      sessionStorage.setItem(`grading_result_${examId}_${studentId}`, JSON.stringify(run));
      sessionStorage.setItem(
        `grading_result_signature_${examId}_${studentId}`,
        answerSignature,
      );
      sessionStorage.removeItem(`grading_answers_${examId}_${studentId}`);
    },
    [examId],
  );

  const runBackgroundGrading = useCallback(
    async (sub: ExamSubmissionStatus) => {
      const answers = buildAnswers(sub);
      const answerSignature = buildAnswerSignature(sub, answers);
      const questionCount = definition?.questions.length ?? answers.length;

      // Clear any cached run so we always get fresh results
      sessionStorage.removeItem(`grading_result_${examId}_${sub.studentId}`);
      sessionStorage.removeItem(`grading_result_signature_${examId}_${sub.studentId}`);

      persistPendingSubmission(sub, answers, answerSignature);
      setStudentProgress((prev) => ({
        ...prev,
        [sub.studentId]: {
          status: "queued",
          completedQuestions: 0,
          totalQuestions: questionCount,
          startedAt: Date.now(),
        },
      }));

      const controller = new AbortController();
      controllersRef.current[sub.studentId] = controller;

      try {
        setStudentProgress((prev) => ({
          ...prev,
          [sub.studentId]: {
            status: "grading",
            completedQuestions: 0,
            totalQuestions: questionCount,
            startedAt: prev[sub.studentId]?.startedAt ?? Date.now(),
          },
        }));

        await streamGradingRun({
          examId,
          studentId: sub.studentId,
          answers,
          useCache: false,
          signal: controller.signal,
          onResult: () => {
            setStudentProgress((prev) => {
              const current = prev[sub.studentId];
              if (!current) return prev;
              return {
                ...prev,
                [sub.studentId]: {
                  ...current,
                  status: "grading",
                  completedQuestions: Math.min(
                    current.totalQuestions,
                    current.completedQuestions + 1,
                  ),
                },
              };
            });
          },
          onDone: (run) => {
            cacheCompletedRun(sub.studentId, run, answerSignature);
            setStudentProgress((prev) => ({
              ...prev,
              [sub.studentId]: {
                status: "completed",
                completedQuestions: questionCount,
                totalQuestions: questionCount,
                startedAt: prev[sub.studentId]?.startedAt ?? Date.now(),
                completedAt: Date.now(),
              },
            }));
          },
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          setStudentProgress((prev) => ({
            ...prev,
            [sub.studentId]: {
              status: "failed",
              completedQuestions: prev[sub.studentId]?.completedQuestions ?? 0,
              totalQuestions: questionCount,
              startedAt: prev[sub.studentId]?.startedAt,
              completedAt: Date.now(),
              error: err instanceof Error ? err.message : "Grading failed",
            },
          }));
        }
        throw err;
      } finally {
        delete controllersRef.current[sub.studentId];
      }
    },
    [
      buildAnswerSignature,
      buildAnswers,
      cacheCompletedRun,
      definition,
      examId,
      persistPendingSubmission,
    ],
  );

  const handleGrade = useCallback(
    (sub: ExamSubmissionStatus) => {
      setError(null);
      // Clear any stale run for this student so re-grade always fetches fresh
      setGradingRuns((prev) => {
        const next = { ...prev };
        delete next[sub.studentId];
        return next;
      });
      setGradingSignatures((prev) => {
        const next = { ...prev };
        delete next[sub.studentId];
        return next;
      });
      void runBackgroundGrading(sub);
    },
    [runBackgroundGrading],
  );

  const handleGradeAll = useCallback(async () => {
    setError(null);
    const targets = examSubmissions;
    try {
      await Promise.all(targets.map((submission) => runBackgroundGrading(submission)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "One or more grading runs failed");
    }
  }, [examSubmissions, runBackgroundGrading]);

  const [isClearingResults, setIsClearingResults] = useState(false);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Clear all grading results from the server and local cache? This cannot be undone.")) return;
    setIsClearingResults(true);
    try {
      await clearAllGradingResults();
    } catch {
      // server may be empty — that's fine
    }
    // Wipe all grading-related sessionStorage keys for this exam
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.startsWith(`grading_runs_${examId}`) ||
        key.startsWith(`grading_run_signatures_${examId}`) ||
        key.startsWith(`grading_result_${examId}`) ||
        key.startsWith(`grading_result_signature_${examId}`) ||
        key.startsWith(`grading_answers_${examId}`) ||
        key.startsWith(`grading_submission_signature_${examId}`)
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    setGradingRuns({});
    setGradingSignatures({});
    setStudentProgress({});
    setIsClearingResults(false);
  }, [examId]);

  const isGradeAllRunning = useMemo(
    () =>
      Object.values(studentProgress).some(
        (progress) => progress.status === "queued" || progress.status === "grading",
      ),
    [studentProgress],
  );

  const batchSummary = useMemo(() => {
    const relevant = examSubmissions.map((sub) => studentProgress[sub.studentId]).filter(Boolean);
    const totalStudents = relevant.length;
    const completedStudents = relevant.filter(
      (progress) => progress?.status === "completed",
    ).length;
    const failedStudents = relevant.filter(
      (progress) => progress?.status === "failed",
    ).length;
    return {
      totalStudents,
      completedStudents,
      failedStudents,
      percent:
        totalStudents > 0
          ? ((completedStudents + failedStudents) / totalStudents) * 100
          : 0,
    };
  }, [examSubmissions, studentProgress]);

  if (!definition) {
    return <div className="empty-state">Exam definition not found.</div>;
  }

  return (
    <>
      <div style={{ marginBottom: "var(--space-6)" }}>
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
            <h1 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
              AI Grading – {definition.title}
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              {definition.courseCode} · {definition.questions.length} questions · {definition.totalPoints} points
            </p>
          </div>
          {examSubmissions.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <button
                type="button"
                className="button"
                onClick={() => {
                  void handleGradeAll();
                }}
                disabled={isGradeAllRunning || isClearingResults}
              >
                {isGradeAllRunning ? "Grading All..." : "Grade All Students"}
              </button>
              <button
                type="button"
                className="button"
                style={{ background: "transparent", border: "1px solid var(--error, #e53e3e)", color: "var(--error, #e53e3e)" }}
                onClick={() => { void handleClearAll(); }}
                disabled={isGradeAllRunning || isClearingResults}
              >
                {isClearingResults ? "Clearing..." : "🗑 Clear All Results"}
              </button>
            </div>
          )}
        </div>
      </div>

      {(isGradeAllRunning || batchSummary.totalStudents > 0) && (
        <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-3)",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Batch Progress</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
                {batchSummary.completedStudents} completed
                {batchSummary.failedStudents > 0 ? ` · ${batchSummary.failedStudents} failed` : ""}
                {batchSummary.totalStudents > 0 ? ` · ${batchSummary.totalStudents} total` : ""}
              </div>
            </div>
            <span className="badge badge-info">
              {batchSummary.percent.toFixed(0)}%
            </span>
          </div>
          <div
            aria-label="Batch grading progress"
            style={{
              height: 10,
              background: "var(--surface-hover)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${batchSummary.percent}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--primary), var(--hkust-gold))",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Submitted attempts */}
      <div className="section-group">
        <h2 className="section-title">Submitted Attempts</h2>

        {examSubmissions.length === 0 ? (
          <div className="empty-state">
            No submissions yet. Students need to take and submit the exam first.
          </div>
        ) : (
          <table className="table" style={{ marginBottom: "var(--space-4)" }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted At</th>
                <th>Answers</th>
                <th>Progress</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {examSubmissions.map((sub) => {
                const run = gradingRuns[sub.studentId];
                const progress = studentProgress[sub.studentId];
                const percent = progress
                  ? getProgressPercent(progress)
                  : run
                    ? 100
                    : 0;
                const rowBusy =
                  progress?.status === "queued" || progress?.status === "grading";
                return (
                  <tr key={sub.studentId} style={{ verticalAlign: "middle" }}>
                    <td>
                      <div style={{ display: "grid", gap: 2 }}>
                        <strong>{sub.studentName ?? sub.studentId}</strong>
                        {sub.studentName && (
                          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                            {sub.studentId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(sub.submittedAt).toLocaleString()}</td>
                    <td>{sub.responses.length} / {definition.questions.length}</td>
                    <td>
                      <div style={{ minWidth: 200, maxWidth: 280 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            marginBottom: "var(--space-2)",
                          }}
                        >
                          <span
                            className={`badge ${
                              progress?.status === "failed"
                                ? "badge-danger"
                                : run || progress?.status === "completed"
                                  ? "badge-success"
                                  : rowBusy
                                    ? "badge-info"
                                    : "badge-warning"
                            }`}
                          >
                            {progress?.status === "failed"
                              ? "failed"
                              : run || progress?.status === "completed"
                                ? `${run?.total_score.toFixed(1) ?? "Done"} / ${run ? getRunMaxPoints(run) : definition.totalPoints}`
                                : rowBusy
                                  ? progress.status
                                  : "awaiting grading"}
                          </span>
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            {progress
                              ? `${progress.completedQuestions} / ${progress.totalQuestions} questions`
                              : run
                                ? `${definition.questions.length} / ${definition.questions.length} questions`
                                : "0 / " + definition.questions.length + " questions"}
                          </span>
                        </div>
                        <div
                          aria-label={`Grading progress for ${sub.studentId}`}
                          style={{
                            height: 8,
                            background: "var(--surface-hover)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${percent}%`,
                              height: "100%",
                              background:
                                progress?.status === "failed"
                                  ? "var(--danger-text)"
                                  : run || progress?.status === "completed"
                                    ? "var(--success-text)"
                                    : "var(--primary)",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        {progress?.error && (
                          <div style={{ color: "var(--danger-text)", fontSize: "0.75rem", marginTop: 6 }}>
                            {progress.error}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                        {sub.attemptId && (
                          <Link
                            href={`/staff/exams/${examId}/grading/${sub.attemptId}/answers`}
                            className="button-ghost"
                            style={{ fontSize: "0.85rem", textDecoration: "none" }}
                          >
                            View Answers
                          </Link>
                        )}
                        <button
                          className="button"
                          onClick={() => handleGrade(sub)}
                          disabled={rowBusy || isGradeAllRunning}
                          style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          {rowBusy ? "Grading..." : run ? "Re-grade" : "Run AI Grading"}
                        </button>
                        {run && (
                          <Link
                            href={`/staff/exams/${examId}/grading/${run.id}`}
                            className="button-ghost"
                            style={{ fontSize: "0.85rem", textDecoration: "none" }}
                          >
                            Review →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {error && (
          <div style={{ color: "var(--danger-text)", marginBottom: "var(--space-4)", fontSize: "0.9rem" }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Summary of graded results */}
      {Object.keys(gradingRuns).length > 0 && (
        <div className="section-group">
          <h2 className="section-title">Grading Summary</h2>
          {Object.entries(gradingRuns).map(([studentId, run]) => (
            <div key={studentId} className="panel" style={{ marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>
                    {examSubmissions.find((submission) => submission.studentId === studentId)?.studentName ?? studentId}
                  </strong>
                  <span style={{ color: "var(--muted)", marginLeft: "var(--space-2)", fontSize: "0.85rem" }}>
                    Run: {run.id}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                    {run.total_score.toFixed(1)} / {getRunMaxPoints(run)}
                  </span>
                  <span className={`badge ${run.total_score / Math.max(getRunMaxPoints(run), 1) >= 0.5 ? "badge-success" : "badge-danger"}`}>
                    {((run.total_score / Math.max(getRunMaxPoints(run), 1)) * 100).toFixed(0)}%
                  </span>
                  <Link
                    href={`/staff/exams/${examId}/grading/${run.id}`}
                    className="button-ghost"
                    style={{ fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    Review →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </>
  );
}

export default function GradingPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return <GradingDashboardContent examId={examId} />;
}
