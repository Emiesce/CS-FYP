"use client";

/* ------------------------------------------------------------------ */
/*  Per-Attempt Grading Review – question-by-question evidence view   */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { CriterionScoreCard } from "@/components/grading/CriterionScoreCard";
import { EvidenceHighlighter } from "@/components/grading/EvidenceHighlighter";
import { ManualOverridePanel } from "@/components/grading/ManualOverridePanel";
import { GradingSummaryCard } from "@/components/grading/GradingSummaryCard";
import { getGradingRun, submitReview } from "@/features/grading/grading-service";
import { QUESTION_TYPE_LABELS } from "@/types";
import type { GradingRun } from "@/types";

function AttemptReviewContent({
  examId,
  attemptId,
}: {
  examId: string;
  attemptId: string;
}) {
  const [run, setRun] = useState<GradingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [activeCriterion, setActiveCriterion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getGradingRun(examId, attemptId);
        if (!cancelled) {
          setRun(data);
          if (data.questionResults.length > 0) {
            setSelectedQ(data.questionResults[0].questionId);
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

  const handleReview = useCallback(
    async (
      questionId: string,
      overrideScore: number | undefined,
      comment: string,
      accepted: boolean,
    ) => {
      try {
        const updated = await submitReview(examId, attemptId, {
          questionId,
          overrideScore,
          comment,
          accepted,
        });
        setRun(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Review failed");
      }
    },
    [examId, attemptId],
  );

  if (loading) return <div className="empty-state">Loading grading results…</div>;
  if (error) return <div style={{ color: "var(--danger-text)" }}>Error: {error}</div>;
  if (!run) return <div className="empty-state">No grading results found.</div>;

  const currentQ = run.questionResults.find((qr) => qr.questionId === selectedQ) ?? null;

  return (
    <>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: "var(--space-1)" }}>
          Grading Review
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Run {run.id} · Attempt {attemptId}
        </p>
      </div>

      <GradingSummaryCard run={run} />

      {/* Question selector */}
      <div className="tab-list" role="tablist" style={{ marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {run.questionResults.map((qr, i) => (
          <button
            key={qr.questionId}
            type="button"
            role="tab"
            aria-selected={selectedQ === qr.questionId}
            className={`tab-button ${selectedQ === qr.questionId ? "is-active" : ""}`}
            onClick={() => {
              setSelectedQ(qr.questionId);
              setActiveCriterion(null);
            }}
          >
            Q{i + 1}
            <span style={{ marginLeft: 4, fontSize: "0.75rem" }}>
              ({qr.rawScore}/{qr.maxPoints})
            </span>
          </button>
        ))}
      </div>

      {/* Selected question detail */}
      {currentQ && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
          {/* Left: evidence + answer */}
          <div>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              {QUESTION_TYPE_LABELS[currentQ.questionType] ?? currentQ.questionType}
              {" · "}
              <span style={{ fontWeight: "normal", color: "var(--muted)" }}>
                {currentQ.lane} {currentQ.model ? `(${currentQ.model})` : ""}
              </span>
            </h3>

            <div style={{ marginBottom: "var(--space-3)" }}>
              <strong>AI Rationale:</strong>
              <p style={{ fontSize: "0.9rem", marginTop: "var(--space-1)" }}>
                {currentQ.rationale}
              </p>
            </div>

            <div style={{ marginBottom: "var(--space-3)" }}>
              <strong>Student Answer (with evidence):</strong>
              <EvidenceHighlighter
                answerText="(Student answer text will be loaded from the attempt data)"
                evidenceSpans={currentQ.evidenceSpans}
                activeCriterionId={activeCriterion ?? undefined}
              />
            </div>

            <ManualOverridePanel
              questionResult={currentQ}
              onSubmit={(overrideScore, comment, accepted) =>
                handleReview(currentQ.questionId, overrideScore, comment, accepted)
              }
            />
          </div>

          {/* Right: criterion cards */}
          <div>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>
              Criteria ({currentQ.criterionResults.length})
            </h3>
            {currentQ.criterionResults.map((cr) => (
              <CriterionScoreCard
                key={cr.criterionId}
                criterion={cr}
                isActive={activeCriterion === cr.criterionId}
                onClick={() =>
                  setActiveCriterion(
                    activeCriterion === cr.criterionId ? null : cr.criterionId,
                  )
                }
              />
            ))}
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
  params: { examId: string; attemptId: string };
}) {
  return (
    <AuthenticatedShell requiredRole="staff">
      <AttemptReviewContent examId={params.examId} attemptId={params.attemptId} />
    </AuthenticatedShell>
  );
}
