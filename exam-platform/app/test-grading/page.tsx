"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSessionToken } from "@/features/auth";
import { BACKEND_API_BASE } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface McqOption { id: string; label: string }

interface ExamQuestion {
  id: string; order: number; title: string; prompt: string;
  points: number; question_type: string; options: McqOption[] | null;
}

interface ExamData {
  id: string; course_code: string; course_name: string;
  title: string; total_points: number; questions: ExamQuestion[];
}

interface EvidenceSpan {
  start_index: number; end_index: number; quote: string;
  criterion_id: string; reason: string;
}

interface CriterionResult {
  criterion_id: string; criterion_label: string; score: number;
  max_points: number; rationale: string; evidence_spans: EvidenceSpan[];
}

interface QuestionGradeResult {
  question_id: string; question_type: string; status: string;
  lane: string; model: string | null; raw_score: number;
  max_points: number; normalized_score: number; confidence: number;
  rationale: string; criterion_results: CriterionResult[];
  evidence_spans: EvidenceSpan[]; escalation_notes: string | null;
}

interface ReviewDecision {
  question_id: string; reviewer_id: string; original_score: number;
  override_score: number | null; comment: string | null;
  accepted: boolean; reviewed_at: string;
}

interface GradingRun {
  id: string; exam_id: string; attempt_id: string; student_id: string;
  status: string; question_results: QuestionGradeResult[];
  total_score: number; max_total_points: number;
  reviews: ReviewDecision[]; started_at: string; completed_at: string | null;
}

const API = BACKEND_API_BASE;

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  Problem metadata                                                   */
/* ------------------------------------------------------------------ */

const PROBLEM_META: Record<string, { title: string }> = {
  "1": { title: "True / False Questions" },
  "2": { title: "Branching & Looping" },
  "3": { title: "Functions & Lists" },
  "4": { title: "Mini Store System" },
  "5": { title: "Number Guessing Game" },
  "6": { title: "Car Accessories Sales" },
};

function getProblemNum(title: string): string {
  const m = title.match(/^Q(\d+)/);
  return m ? m[1] : "0";
}

/* ------------------------------------------------------------------ */
/*  Inline styles using globals.css variables                          */
/* ------------------------------------------------------------------ */

const S = {
  page: { minHeight: "100vh", background: "var(--background)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" } as React.CSSProperties,
  container: { width: "min(100% - 2rem, var(--container-width))", marginInline: "auto" } as React.CSSProperties,
  surface: { background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", backdropFilter: "blur(16px)" } as React.CSSProperties,
  surfaceStrong: { background: "var(--surface-strong)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" } as React.CSSProperties,
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", minHeight: "2.75rem", padding: "0.7rem 1.1rem", borderRadius: "999px", border: "1px solid transparent", cursor: "pointer", fontWeight: 700, background: "var(--brand-primary)", color: "var(--white)", boxShadow: "var(--shadow-sm)", transition: "transform var(--transition-base), background var(--transition-base)" } as React.CSSProperties,
  btnGhost: { display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.85rem", borderRadius: "999px", border: "1px solid var(--border-subtle)", cursor: "pointer", fontWeight: 700, background: "transparent", color: "var(--text-primary)", transition: "background var(--transition-base)" } as React.CSSProperties,
  input: { width: "100%", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", background: "var(--surface-strong)", color: "var(--text-primary)", padding: "0.8rem 0.95rem", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)", transition: "border-color var(--transition-base), box-shadow var(--transition-base)", outline: "none" } as React.CSSProperties,
  textMuted: { color: "var(--text-muted)" } as React.CSSProperties,
  textSecondary: { color: "var(--text-secondary)" } as React.CSSProperties,
  brandPrimary: { color: "var(--brand-primary)" } as React.CSSProperties,
} as const;

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

type Phase = "loading" | "exam" | "grading" | "review";

export default function TestGradingPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradingRun, setGradingRun] = useState<GradingRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gradingElapsed, setGradingElapsed] = useState(0);
  const [gradingDone, setGradingDone] = useState(false);
  const [totalGradingTime, setTotalGradingTime] = useState<number | null>(null);
  const [streamedResults, setStreamedResults] = useState<QuestionGradeResult[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore persisted grading run on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("grading_run");
      if (saved) {
        const parsed = JSON.parse(saved) as GradingRun;
        setGradingRun(parsed);
        setStreamedResults(parsed.question_results ?? []);
        setGradingDone(true);
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  useEffect(() => {
    fetch(`${API}/api/test-grading/exam`, { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: ExamData) => {
        setExam(data);
        // If we have a persisted run, go straight to review
        const saved = localStorage.getItem("grading_run");
        if (saved) {
          setPhase("review");
        } else {
          setPhase("exam");
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (phase !== "grading" && phase !== "review") return;
    if (gradingDone) return;
    setGradingElapsed(0);
    const t = setInterval(() => setGradingElapsed((p) => p + 1), 1000);
    timerRef.current = t;
    return () => clearInterval(t);
  }, [phase, gradingDone]);

  const updateAnswer = useCallback((qid: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  }, []);

  const handleSubmit = async () => {
    if (!exam) return;
    setPhase("grading");
    setError(null);
    setGradingDone(false);
    setTotalGradingTime(null);
    setStreamedResults([]);
    const startTime = Date.now();

    const payload = exam.questions.map((q) => ({
      question_id: q.id, value: answers[q.id] ?? "",
    }));

    try {
      const res = await fetch(`${API}/api/test-grading/submit-stream`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ answers: payload }),
      });
      if (!res.ok) throw new Error(`Grading failed: ${await res.text()}`);

      // Switch to review immediately — results will stream in
      setPhase("review");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (eventType === "result") {
                setStreamedResults((prev) => {
                  // Replace if same question_id exists (evidence update), else append
                  const idx = prev.findIndex((r) => r.question_id === data.question_id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = data;
                    return copy;
                  }
                  return [...prev, data];
                });
              } else if (eventType === "done") {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                setTotalGradingTime(elapsed);
                setGradingDone(true);
                if (timerRef.current) clearInterval(timerRef.current);
                setGradingRun(data as GradingRun);
                // Persist so results survive navigation
                try { localStorage.setItem("grading_run", JSON.stringify(data)); } catch {}
              } else if (eventType === "error") {
                setError(data.error);
              }
            } catch { /* skip malformed */ }
            eventType = "";
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      if (streamedResults.length === 0) setPhase("exam");
    }
  };

  const handleOverride = async (questionId: string, overrideScore: number, comment: string) => {
    if (!gradingRun) return;
    try {
      const res = await fetch(`${API}/api/test-grading/review/${gradingRun.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, override_score: overrideScore, comment, accepted: true }),
      });
      if (!res.ok) throw new Error("Review failed");
      const updated = await res.json();
      setGradingRun(updated);
      try { localStorage.setItem("grading_run", JSON.stringify(updated)); } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Build a partial GradingRun from streamed results for the ReviewView
  const liveRun: GradingRun | null = useMemo(() => {
    if (gradingRun) return gradingRun; // final run available
    if (!exam || streamedResults.length === 0) return null;
    const totalScore = streamedResults.reduce((s, r) => s + r.raw_score, 0);
    const maxPts = exam.total_points;
    return {
      id: "streaming…",
      exam_id: exam.id,
      attempt_id: "",
      student_id: "test-student",
      status: "in_progress",
      question_results: streamedResults,
      total_score: totalScore,
      max_total_points: maxPts,
      reviews: [],
      started_at: new Date().toISOString(),
      completed_at: null,
    };
  }, [exam, gradingRun, streamedResults]);

  if (error && phase === "loading")
    return (
      <div className="auth-shell">
        <div className="panel" style={{ maxWidth: 480 }}>
          <div className="badge-danger" style={{ marginBottom: "var(--space-4)" }}>Error</div>
          <p>{error}</p>
        </div>
      </div>
    );

  if (phase === "loading")
    return (
      <div className="auth-shell">
        <div style={{ textAlign: "center" }}>
          <div className="live-indicator" style={{ fontSize: "1.2rem", marginBottom: "var(--space-4)" }}>Loading exam…</div>
        </div>
      </div>
    );

  if (phase === "grading")
    return <GradingLoader elapsed={gradingElapsed} totalQuestions={exam?.questions.length ?? 0} />;

  if (phase === "review" && liveRun && exam)
    return <ReviewView exam={exam} run={liveRun} answers={answers} onOverride={handleOverride} error={error} gradingDone={gradingDone} gradingElapsed={gradingElapsed} totalGradingTime={totalGradingTime} onReset={() => {
      localStorage.removeItem("grading_run");
      setGradingRun(null);
      setStreamedResults([]);
      setGradingDone(false);
      setTotalGradingTime(null);
      setAnswers({});
      setPhase("exam");
    }} />;

  return <ExamView exam={exam!} answers={answers} onUpdate={updateAnswer} onSubmit={handleSubmit} error={error} />;
}

/* ================================================================== */
/*  Grading Loader                                                     */
/* ================================================================== */

function GradingLoader({ elapsed, totalQuestions }: { elapsed: number; totalQuestions: number }) {
  const tips = [
    "Analyzing your code structure…",
    "Checking against rubric criteria…",
    "Evaluating logical correctness…",
    "Comparing with model solutions…",
    "Assigning partial credit…",
    "Running evidence extraction…",
    "Almost there…",
  ];
  const tipIdx = Math.min(Math.floor(elapsed / 8), tips.length - 1);

  return (
    <div style={{
      ...S.page,
      background: "linear-gradient(135deg, var(--hkust-blue-900) 0%, var(--slate-950) 100%)",
      display: "grid", placeItems: "center",
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        {/* Animated spinner */}
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto var(--space-8)" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.1)",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: 8, borderRadius: "50%",
            border: "4px solid transparent", borderTopColor: "var(--hkust-gold-500)",
            animation: "spin 1s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "1.8rem", fontWeight: 800,
          }}>{elapsed}s</div>
        </div>
        <h2 style={{ color: "#fff", fontSize: "1.75rem", margin: "0 0 var(--space-2)", letterSpacing: "-0.02em" }}>
          AI Grading in Progress
        </h2>
        <p style={{ color: "var(--hkust-blue-100)", margin: "0 0 var(--space-6)", fontSize: "0.95rem" }}>
          Grading {totalQuestions} questions with DeepSeek
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "var(--space-6)" }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--hkust-gold-500)",
              opacity: (i <= (Math.floor(elapsed / 3) % 5)) ? 1 : 0.25,
              transition: "opacity 0.4s",
            }}/>
          ))}
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>{tips[tipIdx]}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

/* ================================================================== */
/*  Exam-Taking View                                                   */
/* ================================================================== */

function ExamView({
  exam, answers, onUpdate, onSubmit, error,
}: {
  exam: ExamData; answers: Record<string, string>;
  onUpdate: (qid: string, val: string) => void;
  onSubmit: () => void; error: string | null;
}) {
  const groups = groupQuestions(exam.questions);
  const [activeGroup, setActiveGroup] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const answeredCount = exam.questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const progress = Math.round((answeredCount / exam.questions.length) * 100);

  const scrollToGroup = (idx: number) => {
    setActiveGroup(idx);
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={S.page}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "var(--surface)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ ...S.container, padding: "var(--space-3) 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--brand-primary)" }}>
              {exam.course_code} — {exam.title}
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", ...S.textMuted }}>
              {exam.course_name} • {exam.total_points} points total
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            {/* Progress ring */}
            <div style={{ position: "relative", width: 42, height: 42 }}>
              <svg width="42" height="42" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--brand-primary)" strokeWidth="3"
                  strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" />
              </svg>
              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800 }}>
                {answeredCount}
              </span>
            </div>
            <button style={S.btn} onClick={onSubmit}>Submit &amp; Grade</button>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ ...S.container, paddingBottom: "var(--space-2)", display: "flex", gap: "var(--space-1)", overflowX: "auto" }}>
          {groups.map(([, , problemNum], idx) => {
            const meta = PROBLEM_META[problemNum] ?? { title: "Other" };
            const groupQs = groups[idx][1];
            const allDone = groupQs.every((q) => (answers[q.id] ?? "").trim() !== "");
            const isActive = activeGroup === idx;
            return (
              <button key={problemNum} onClick={() => scrollToGroup(idx)} style={{
                ...S.btnGhost,
                fontSize: "0.8rem", padding: "0.4rem 0.75rem",
                ...(isActive ? { background: "var(--info-bg)", color: "var(--info-text)", borderColor: "transparent" } : {}),
              }}>
                P{problemNum}
                {allDone && <span style={{ color: "var(--success-text)" }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div style={S.container}>
          <div className="badge-danger" style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", background: "var(--danger-bg)", color: "var(--danger-text)", fontSize: "0.9rem" }}>
            {error}
          </div>
        </div>
      )}

      <div className="page-shell" style={S.container}>
        <div className="section-stack">
          {groups.map(([groupTitle, questions, problemNum], idx) => {
            const meta = PROBLEM_META[problemNum] ?? { title: groupTitle };
            const groupPts = questions.reduce((s, q) => s + q.points, 0);
            return (
              <div key={groupTitle} ref={(el) => { sectionRefs.current[idx] = el; }} style={S.surfaceStrong}>
                <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-muted)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--slate-950)" }}>
                        Problem {problemNum} — {meta.title}
                      </h2>
                      <p style={{ margin: 0, fontSize: "0.8rem", ...S.textMuted }}>
                        {groupPts} points • {questions.length} question{questions.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "var(--space-6)", display: "grid", gap: "var(--space-6)" }}>
                  {questions.map((q) => (
                    <QuestionField key={q.id} question={q} value={answers[q.id] ?? ""} onChange={(val) => onUpdate(q.id, val)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-8)", paddingBottom: "var(--space-12)" }}>
          <span style={{ ...S.textMuted, fontSize: "0.9rem" }}>{answeredCount} / {exam.questions.length} answered</span>
          <button style={{ ...S.btn, fontSize: "1.05rem", padding: "0.8rem 1.5rem" }} onClick={onSubmit}>
            Submit &amp; Grade →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Question input                                                     */
/* ------------------------------------------------------------------ */

function QuestionField({ question, value, onChange }: {
  question: ExamQuestion; value: string; onChange: (val: string) => void;
}) {
  const isMcq = question.question_type === "mcq";
  const isCoding = question.question_type === "coding";
  const answered = value.trim() !== "";

  return (
    <div style={{ borderLeft: `3px solid ${answered ? "var(--success-text)" : "var(--border-subtle)"}`, paddingLeft: "var(--space-4)", transition: "border-color var(--transition-base)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--slate-950)" }}>
          {question.title}
          <span className="badge-info" style={{ marginLeft: "var(--space-2)", fontSize: "0.78rem", padding: "0.2rem 0.6rem" }}>
            {question.points} pt{question.points !== 1 ? "s" : ""}
          </span>
        </h3>
        {answered && <span style={{ color: "var(--success-text)", fontSize: "0.8rem", fontWeight: 700 }}>✓ Answered</span>}
      </div>
      <div style={{ fontSize: "0.9rem", ...S.textSecondary, marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
        <FormattedPrompt text={question.prompt} />
      </div>
      {isMcq && question.options ? (
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {question.options.map((opt) => (
            <button key={opt.id} onClick={() => onChange(opt.id)} style={{
              padding: "0.6rem 1.2rem", borderRadius: "var(--radius-md)", fontWeight: 700, fontSize: "0.9rem",
              border: `2px solid ${value === opt.id ? "var(--brand-primary)" : "var(--border-subtle)"}`,
              background: value === opt.id ? "var(--info-bg)" : "var(--surface-strong)",
              color: value === opt.id ? "var(--info-text)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all var(--transition-base)",
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      ) : isCoding ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6}
          style={{ ...S.input, fontFamily: "monospace", fontSize: "0.85rem", background: "var(--surface-muted)", resize: "vertical" }}
          placeholder={"def solution():\n    # Write your code here…"} />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          style={{ ...S.input, resize: "vertical" }}
          placeholder="Type your answer…" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Formatted prompt (code blocks + inline code)                       */
/* ------------------------------------------------------------------ */

function FormattedPrompt({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre key={i} style={{ background: "var(--surface-muted)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)", overflow: "auto", margin: "var(--space-2) 0", fontSize: "0.8rem", fontFamily: "monospace" }}>
              <code>{code}</code>
            </pre>
          );
        }
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((ip, j) =>
              ip.startsWith("`") && ip.endsWith("`")
                ? <code key={j} style={{ background: "var(--surface-muted)", color: "var(--danger-text)", padding: "0.15rem 0.4rem", borderRadius: "4px", fontSize: "0.82rem", fontFamily: "monospace" }}>{ip.slice(1, -1)}</code>
                : <span key={j}>{ip}</span>
            )}
          </span>
        );
      })}
    </>
  );
}

/* ================================================================== */
/*  Evidence-Highlighted Answer                                        */
/*  Renders student answer with clickable highlighted spans.           */
/*  On hover, shows a tooltip with criterion label, score, rationale. */
/* ================================================================== */

function HighlightedAnswer({
  answer,
  evidenceSpans,
  criterionResults,
  onHighlightCriterion,
}: {
  answer: string;
  evidenceSpans: EvidenceSpan[];
  criterionResults: CriterionResult[];
  onHighlightCriterion: (criterionId: string) => void;
}) {
  const [hoveredSpan, setHoveredSpan] = useState<EvidenceSpan | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Build criterion lookup
  const criterionMap = useMemo(() => {
    const m: Record<string, CriterionResult> = {};
    for (const cr of criterionResults) m[cr.criterion_id] = cr;
    return m;
  }, [criterionResults]);

  // Sort spans by start_index and merge overlapping
  const sortedSpans = useMemo(() => {
    if (!evidenceSpans.length) return [];
    const sorted = [...evidenceSpans].sort((a, b) => a.start_index - b.start_index);
    return sorted;
  }, [evidenceSpans]);

  const criterionColors = useMemo(() => {
    const palette = [
      { bg: "rgba(234,179,8,0.18)", border: "#eab308" },
      { bg: "rgba(59,130,246,0.15)", border: "#3b82f6" },
      { bg: "rgba(168,85,247,0.15)", border: "#a855f7" },
      { bg: "rgba(34,197,94,0.15)", border: "#22c55e" },
      { bg: "rgba(239,68,68,0.12)", border: "#ef4444" },
      { bg: "rgba(236,72,153,0.12)", border: "#ec4899" },
    ];
    const map: Record<string, typeof palette[0]> = {};
    let idx = 0;
    for (const criterion of criterionResults) {
      map[criterion.criterion_id] = palette[idx % palette.length];
      idx++;
    }
    return map;
  }, [criterionResults]);

  // Build segments: plain text + highlighted spans
  const segments = useMemo(() => {
    if (!sortedSpans.length) return [{ text: answer, span: null as EvidenceSpan | null }];
    const segs: { text: string; span: EvidenceSpan | null }[] = [];
    let pos = 0;
    for (const sp of sortedSpans) {
      const start = Math.max(sp.start_index, pos);
      const end = Math.min(sp.end_index, answer.length);
      if (start > pos) segs.push({ text: answer.slice(pos, start), span: null });
      if (end > start) segs.push({ text: answer.slice(start, end), span: sp });
      pos = Math.max(pos, end);
    }
    if (pos < answer.length) segs.push({ text: answer.slice(pos), span: null });
    return segs;
  }, [answer, sortedSpans]);

  const handleMouseEnter = (e: React.MouseEvent, span: EvidenceSpan) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10 });
    }
    setHoveredSpan(span);
  };

  if (!sortedSpans.length) {
    return (
      <pre style={{ ...codePreStyle, maxHeight: 300, overflowY: "auto" }}>
        {answer || "(no answer)"}
      </pre>
    );
  }

  const hoveredCriterion = hoveredSpan ? criterionMap[hoveredSpan.criterion_id] : null;

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <pre style={{ ...codePreStyle, maxHeight: 300, overflowY: "auto", lineHeight: 1.8 }}>
        {segments.map((seg, i) => {
          if (!seg.span) return <span key={i}>{seg.text}</span>;
          const color = criterionColors[seg.span.criterion_id] ?? { bg: "rgba(234,179,8,0.18)", border: "#eab308" };
          return (
            <span
              key={i}
              onMouseEnter={(e) => handleMouseEnter(e, seg.span!)}
              onMouseLeave={() => setHoveredSpan(null)}
              onClick={() => onHighlightCriterion(seg.span!.criterion_id)}
              style={{
                background: color.bg,
                borderBottom: `2px solid ${color.border}`,
                cursor: "pointer",
                borderRadius: "2px",
                padding: "1px 0",
                transition: "background var(--transition-base)",
              }}
            >
              {seg.text}
            </span>
          );
        })}
      </pre>
      {/* Tooltip */}
      {hoveredSpan && (
        <div style={{
          position: "absolute",
          left: Math.min(tooltipPos.x, 350),
          top: tooltipPos.y,
          transform: "translateY(-100%)",
          background: "var(--slate-950)",
          color: "#fff",
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8rem",
          maxWidth: 380,
          zIndex: 50,
          boxShadow: "var(--shadow-lg)",
          pointerEvents: "none",
          lineHeight: 1.5,
        }}>
          {hoveredCriterion && (
            <div style={{ fontWeight: 700, color: "var(--hkust-gold-500)", marginBottom: 4 }}>
              {hoveredCriterion.criterion_label}
              <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 8 }}>
                {hoveredCriterion.score}/{hoveredCriterion.max_points} pts
              </span>
            </div>
          )}
          <div style={{ marginBottom: 4 }}>
            <span style={{ opacity: 0.6 }}>Evidence: </span>
            &ldquo;{hoveredSpan.quote}&rdquo;
          </div>
          <div style={{ opacity: 0.8 }}>
            <span style={{ opacity: 0.6 }}>Reason: </span>
            {hoveredSpan.reason}
          </div>
          {hoveredCriterion && (
            <div style={{ marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 4, opacity: 0.7, fontSize: "0.75rem" }}>
              <span style={{ opacity: 0.6 }}>Rubric rationale: </span>
              {hoveredCriterion.rationale}
            </div>
          )}
          <div style={{ position: "absolute", bottom: -6, left: 20, width: 12, height: 12, background: "var(--slate-950)", transform: "rotate(45deg)" }}/>
        </div>
      )}
    </div>
  );
}

const codePreStyle: React.CSSProperties = {
  background: "var(--surface-muted)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  overflowX: "auto",
  margin: 0,
};

/* ================================================================== */
/*  Review View                                                        */
/* ================================================================== */

function ReviewView({
  exam, run, answers, onOverride, error, gradingDone, gradingElapsed, totalGradingTime, onReset,
}: {
  exam: ExamData; run: GradingRun; answers: Record<string, string>;
  onOverride: (qid: string, score: number, comment: string) => void; error: string | null;
  gradingDone: boolean; gradingElapsed: number; totalGradingTime: number | null;
  onReset: () => void;
}) {
  const [selectedQ, setSelectedQ] = useState<string | null>(run.question_results[0]?.question_id ?? null);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideComment, setOverrideComment] = useState("");
  const [highlightedCriterion, setHighlightedCriterion] = useState<string | null>(null);
  const criterionRef = useRef<HTMLDivElement>(null);

  // ---- Anti-anchoring: track which questions the human has reviewed ----
  // Deterministic questions (MCQ, unanswered) are auto-revealed.
  // For AI-graded questions, the human must submit their own score first.
  const [humanReviewed, setHumanReviewed] = useState<Record<string, { score: number; comment: string }>>({});
  // Per-criterion human scores for the current question
  const [criterionScores, setCriterionScores] = useState<Record<string, string>>({});

  const isDeterministic = (qr: QuestionGradeResult) =>
    qr.lane === "deterministic" || qr.question_type === "mcq" || qr.rationale.startsWith("Incomplete");

  const qMap = Object.fromEntries(exam.questions.map((q) => [q.id, q]));
  const resultMap = Object.fromEntries(run.question_results.map((r) => [r.question_id, r]));
  const selectedResult = selectedQ ? resultMap[selectedQ] : null;
  const selectedExamQ = selectedQ ? qMap[selectedQ] : null;

  const isRevealed = (qid: string) => {
    const qr = resultMap[qid];
    if (!qr) return false;
    return isDeterministic(qr) || qid in humanReviewed;
  };

  const pctVal = run.max_total_points > 0 ? (run.total_score / run.max_total_points) * 100 : 0;
  const pct = pctVal.toFixed(1);
  const groups = groupQuestions(exam.questions);

  // Count reviewed questions for progress
  const totalGraded = run.question_results.length;
  const totalReviewed = run.question_results.filter(
    (qr) => isDeterministic(qr) || qr.question_id in humanReviewed
  ).length;
  const needsReviewCount = run.question_results.filter(
    (qr) => !isDeterministic(qr) && !(qr.question_id in humanReviewed)
  ).length;

  const handleSubmitOverride = () => {
    if (!selectedQ || overrideScore === "") return;
    onOverride(selectedQ, parseFloat(overrideScore), overrideComment);
    setOverrideScore(""); setOverrideComment("");
  };

  // Human submits their independent review before seeing AI scores
  const handleHumanReview = () => {
    if (!selectedQ || !selectedResult) return;
    // Collect total from criterion scores or fallback to overrideScore
    const totalHumanScore = selectedResult.criterion_results.length > 0
      ? selectedResult.criterion_results.reduce((sum, cr) => {
          const val = parseFloat(criterionScores[cr.criterion_id] ?? "0");
          return sum + (isNaN(val) ? 0 : val);
        }, 0)
      : parseFloat(overrideScore || "0");
    if (isNaN(totalHumanScore)) return;
    setHumanReviewed((prev) => ({
      ...prev,
      [selectedQ]: { score: totalHumanScore, comment: overrideComment },
    }));
    setCriterionScores({});
    setOverrideScore("");
    setOverrideComment("");
  };

  const handleHighlightCriterion = (criterionId: string) => {
    setHighlightedCriterion(criterionId);
    criterionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scoreSemantic = (p: number) =>
    p >= 80 ? "success" : p >= 50 ? "warning" : "danger";

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ background: "var(--surface-strong)", borderBottom: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ ...S.container, padding: "var(--space-4) 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "var(--brand-primary)" }}>
              Grading Review — {exam.course_code}
            </h1>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: "0.82rem", ...S.textMuted }}>
              {gradingDone ? (
                <>
                  Run <code style={{ background: "var(--surface-muted)", padding: "0.1rem 0.4rem", borderRadius: 4, fontSize: "0.78rem" }}>{run.id}</code>
                  {" • "}
                  <span style={{ color: "var(--success-text)", fontWeight: 700 }}>completed</span>
                  {totalGradingTime != null && (
                    <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>in {totalGradingTime}s</span>
                  )}
                </>
              ) : (
                <>
                  <span className="live-indicator" style={{ fontSize: "0.82rem" }}>
                    Grading in progress… {gradingElapsed}s
                  </span>
                  {" • "}
                  <span style={{ color: "var(--warning-text)", fontWeight: 700 }}>
                    {run.question_results.length} / {exam.questions.length} done
                  </span>
                </>
              )}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--brand-primary)" }}>
              {totalReviewed} / {exam.questions.length}
            </div>
            <div style={{ fontSize: "0.78rem", ...S.textMuted, marginTop: 2 }}>
              {needsReviewCount > 0
                ? `${needsReviewCount} question${needsReviewCount !== 1 ? "s" : ""} awaiting your review`
                : "All questions reviewed"}
            </div>
            {gradingDone && (
              <button style={{ ...S.btnGhost, marginTop: "var(--space-2)", fontSize: "0.78rem" }} onClick={onReset}>
                Reset &amp; Retake
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={S.container}>
          <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", background: "var(--danger-bg)", color: "var(--danger-text)", fontSize: "0.9rem" }}>
            {error}
          </div>
        </div>
      )}

      <div style={{ ...S.container, padding: "var(--space-6) 0", display: "flex", gap: "var(--space-6)", alignItems: "flex-start" }}>
        {/* Sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ ...S.surfaceStrong, position: "sticky", top: "var(--space-6)", overflow: "hidden" }}>
            {/* Progress header */}
            <div style={{
              padding: "var(--space-4)",
              borderBottom: "1px solid var(--border-subtle)",
              textAlign: "center",
              background: needsReviewCount === 0 ? "var(--success-bg)" : "var(--info-bg)",
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: needsReviewCount === 0 ? "var(--success-text)" : "var(--info-text)" }}>
                {totalReviewed} / {exam.questions.length}
              </div>
              <div style={{ fontSize: "0.78rem", ...S.textMuted }}>
                {needsReviewCount > 0 ? "questions reviewed" : "✓ review complete"}
              </div>
            </div>
            <div style={{ padding: "var(--space-3)", maxHeight: "60vh", overflowY: "auto" }}>
              {groups.map(([, questions, problemNum]) => {
                const meta = PROBLEM_META[problemNum] ?? { title: "Other" };
                return (
                  <div key={problemNum} style={{ marginBottom: "var(--space-3)" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", ...S.textMuted, padding: "0 var(--space-2)", marginBottom: "var(--space-1)" }}>
                      P{problemNum}
                    </div>
                    {questions.map((q) => {
                      const qr = resultMap[q.id];
                      const isSelected = selectedQ === q.id;
                      if (!qr) {
                        // Not yet graded — show loading placeholder
                        return (
                          <div key={q.id} style={{
                            width: "100%", textAlign: "left",
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.78rem", marginBottom: 2,
                            border: "1px solid transparent",
                            opacity: 0.5,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{q.title}</span>
                              <span style={{ fontSize: "0.7rem", animation: "pulse 1.5s ease-in-out infinite" }}>⏳</span>
                            </div>
                            <div style={{ fontSize: "0.72rem", ...S.textMuted, marginTop: 2 }}>grading…</div>
                          </div>
                        );
                      }
                      const qPct = qr.max_points > 0 ? (qr.raw_score / qr.max_points) * 100 : 0;
                      const sem = scoreSemantic(qPct);
                      const revealed = isRevealed(q.id);
                      return (
                        <button key={q.id} onClick={() => { setSelectedQ(q.id); setHighlightedCriterion(null); setCriterionScores({}); }}
                          style={{
                            width: "100%", textAlign: "left",
                            padding: "var(--space-2) var(--space-3)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.78rem",
                            marginBottom: 2,
                            border: isSelected ? "1px solid var(--brand-primary)" : "1px solid transparent",
                            background: isSelected ? "var(--info-bg)" : "transparent",
                            cursor: "pointer",
                            transition: "all var(--transition-base)",
                          }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{q.title}</span>
                            {revealed ? (
                              <span style={{
                                fontFamily: "monospace", fontWeight: 800,
                                color: sem === "success" ? "var(--success-text)" : sem === "warning" ? "var(--warning-text)" : "var(--danger-text)",
                              }}>{qr.raw_score.toFixed(1)}/{qr.max_points}</span>
                            ) : (
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)" }}>??/{qr.max_points}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                              background: revealed
                                ? (qr.lane === "deterministic" ? "var(--slate-500)" : qr.lane === "cheap_llm" ? "var(--info-text)" : "var(--brand-secondary)")
                                : "var(--warning-text)",
                            }}/>
                            <span style={{ ...S.textMuted, fontSize: "0.72rem" }}>
                              {revealed ? qr.lane.replace(/_/g, " ") : "awaiting review"}
                            </span>
                            {qr.status === "escalated" && (
                              <span className="badge-danger" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem", minHeight: "auto" }}>error</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main detail panel */}
        <div style={{ flex: 1, minWidth: 0 }} className="section-stack">
          {selectedResult && selectedExamQ ? (
            <>
              {/* Question prompt */}
              <div className="panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--slate-950)" }}>{selectedExamQ.title}</h3>
                  <span className="badge-info">{selectedExamQ.points} pts</span>
                </div>
                <div style={{ fontSize: "0.9rem", ...S.textSecondary, lineHeight: 1.6 }}>
                  <FormattedPrompt text={selectedExamQ.prompt} />
                </div>
              </div>

              {/* Student answer with evidence highlighting */}
              <div className="panel">
                <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "var(--info-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>📝</span>
                  Student Answer
                  {isRevealed(selectedQ!) && selectedResult.evidence_spans.length > 0 && (
                    <span className="badge-warning" style={{ fontSize: "0.72rem", marginLeft: "auto" }}>
                      {selectedResult.evidence_spans.length} evidence span{selectedResult.evidence_spans.length !== 1 ? "s" : ""} — hover to inspect
                    </span>
                  )}
                </h4>
                {selectedExamQ.question_type === "mcq" ? (
                  <div className="badge-info" style={{ fontSize: "1rem", padding: "var(--space-2) var(--space-4)" }}>
                    Selected: <strong>{answers[selectedQ!] || "—"}</strong>
                  </div>
                ) : isRevealed(selectedQ!) ? (
                  <HighlightedAnswer
                    answer={answers[selectedQ!] || "(no answer)"}
                    evidenceSpans={selectedResult.evidence_spans}
                    criterionResults={selectedResult.criterion_results}
                    onHighlightCriterion={handleHighlightCriterion}
                  />
                ) : (
                  /* Before human review: show answer without evidence highlights */
                  <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", border: "1px solid var(--border-subtle)" }}>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: selectedExamQ.question_type === "coding" ? "monospace" : "inherit", fontSize: "0.9rem", margin: 0, lineHeight: 1.6 }}>
                      {answers[selectedQ!] || "(no answer)"}
                    </pre>
                  </div>
                )}
              </div>

              {/* ---- ANTI-ANCHORING: Human Review FIRST (for non-deterministic) ---- */}
              {!isDeterministic(selectedResult) && !isRevealed(selectedQ!) && (
                <div className="panel" style={{ border: "2px solid var(--brand-primary)" }}>
                  <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "var(--warning-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>✏️</span>
                    Your Independent Review
                  </h4>
                  <p style={{ fontSize: "0.82rem", ...S.textMuted, marginBottom: "var(--space-4)" }}>
                    Score this question independently before viewing the AI&apos;s assessment. This prevents anchoring bias.
                  </p>

                  {/* Per-criterion scoring if criteria exist */}
                  {selectedResult.criterion_results.length > 0 ? (
                    <div style={{ marginBottom: "var(--space-4)" }}>
                      <h5 style={{ margin: "0 0 var(--space-3)", fontSize: "0.88rem", fontWeight: 700 }}>Criteria</h5>
                      <div className="list-stack">
                        {selectedResult.criterion_results.map((cr) => (
                          <div key={cr.criterion_id} style={{
                            display: "flex", alignItems: "center", gap: "var(--space-3)",
                            padding: "var(--space-3)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            background: "var(--surface-muted)",
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>{cr.criterion_label}</div>
                              <div style={{ fontSize: "0.75rem", ...S.textMuted }}>max {cr.max_points} pts</div>
                            </div>
                            <input
                              type="number" min={0} max={cr.max_points} step={0.5}
                              value={criterionScores[cr.criterion_id] ?? ""}
                              onChange={(e) => setCriterionScores((prev) => ({ ...prev, [cr.criterion_id]: e.target.value }))}
                              placeholder="—"
                              style={{ ...S.input, width: 80, textAlign: "center", fontWeight: 700 }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: "var(--space-3)", fontSize: "0.85rem", fontWeight: 700, textAlign: "right" }}>
                        Your total:{" "}
                        {selectedResult.criterion_results.reduce((sum, cr) => {
                          const v = parseFloat(criterionScores[cr.criterion_id] ?? "0");
                          return sum + (isNaN(v) ? 0 : v);
                        }, 0).toFixed(1)}{" "}
                        / {selectedResult.max_points}
                      </div>
                    </div>
                  ) : (
                    /* No criteria — single score input */
                    <div style={{ marginBottom: "var(--space-4)" }}>
                      <label style={{ display: "block", fontSize: "0.8rem", ...S.textMuted, marginBottom: "var(--space-1)", fontWeight: 700 }}>
                        Your Score (0–{selectedResult.max_points})
                      </label>
                      <input type="number" min={0} max={selectedResult.max_points} step={0.5}
                        value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)}
                        style={{ ...S.input, width: 120 }}
                        placeholder="—" />
                    </div>
                  )}

                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", ...S.textMuted, marginBottom: "var(--space-1)", fontWeight: 700 }}>Comment (optional)</label>
                    <input type="text" value={overrideComment} onChange={(e) => setOverrideComment(e.target.value)}
                      style={S.input} placeholder="Notes on your scoring…" />
                  </div>

                  <button
                    onClick={handleHumanReview}
                    disabled={
                      selectedResult.criterion_results.length > 0
                        ? selectedResult.criterion_results.some((cr) => (criterionScores[cr.criterion_id] ?? "") === "")
                        : overrideScore === ""
                    }
                    style={{
                      ...S.btn,
                      width: "100%",
                      opacity: (selectedResult.criterion_results.length > 0
                        ? selectedResult.criterion_results.some((cr) => (criterionScores[cr.criterion_id] ?? "") === "")
                        : overrideScore === "") ? 0.4 : 1,
                    }}>
                    Submit Review &amp; Reveal AI Score →
                  </button>
                </div>
              )}

              {/* ---- REVEALED: AI Grading Result (shown for deterministic or after human review) ---- */}
              {isRevealed(selectedQ!) && (
                <>
                  {/* Comparison banner for human-reviewed questions */}
                  {selectedQ! in humanReviewed && (
                    <div className="panel" style={{ background: "var(--info-bg)", border: "1px solid rgba(59,130,246,0.2)" }}>
                      <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "0.92rem", fontWeight: 700, color: "var(--info-text)" }}>
                        📊 Score Comparison
                      </h4>
                      <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", ...S.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Your Score</div>
                          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {humanReviewed[selectedQ!].score.toFixed(1)} / {selectedResult.max_points}
                          </div>
                        </div>
                        <div style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>vs</div>
                        <div>
                          <div style={{ fontSize: "0.75rem", ...S.textMuted, fontWeight: 700, textTransform: "uppercase" }}>AI Score</div>
                          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--brand-primary)" }}>
                            {selectedResult.raw_score.toFixed(1)} / {selectedResult.max_points}
                          </div>
                        </div>
                        {(() => {
                          const diff = selectedResult.raw_score - humanReviewed[selectedQ!].score;
                          if (Math.abs(diff) < 0.1) return <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--success-text)" }}>✓ Agreement</span>;
                          return <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--warning-text)" }}>Δ {diff > 0 ? "+" : ""}{diff.toFixed(1)}</span>;
                        })()}
                      </div>
                      {humanReviewed[selectedQ!].comment && (
                        <div style={{ marginTop: "var(--space-2)", fontSize: "0.82rem", ...S.textMuted }}>
                          Your note: {humanReviewed[selectedQ!].comment}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "rgba(168,85,247,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>🤖</span>
                        AI Grading Result
                      </h4>
                      <div className={`risk-score risk-${scoreSemantic(selectedResult.normalized_score * 100) === "success" ? "low" : scoreSemantic(selectedResult.normalized_score * 100) === "warning" ? "medium" : "high"}`}>
                        {selectedResult.raw_score.toFixed(1)} / {selectedResult.max_points}
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                      <span className={`badge badge-${selectedResult.lane === "deterministic" ? "info" : selectedResult.lane === "cheap_llm" ? "info" : "warning"}`}>
                        Lane: {selectedResult.lane.replace(/_/g, " ")}
                      </span>
                      <span className="badge badge-info">
                        Model: {selectedResult.model ?? "deterministic"}
                      </span>
                      {selectedResult.status === "escalated" && (
                        <span className="badge badge-danger">Failed / Escalated</span>
                      )}
                    </div>

                    {/* Rationale */}
                    <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "0.9rem", ...S.textSecondary, marginBottom: "var(--space-4)", border: "1px solid var(--border-subtle)" }}>
                      <strong style={{ color: "var(--text-primary)" }}>Rationale: </strong>
                      {selectedResult.rationale}
                    </div>

                    {selectedResult.escalation_notes && (
                      <div style={{ background: "var(--warning-bg)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "0.9rem", color: "var(--warning-text)", marginBottom: "var(--space-4)", border: "1px solid rgba(154,103,0,0.2)" }}>
                        <strong>⚠ Escalation: </strong>{selectedResult.escalation_notes}
                      </div>
                    )}

                    {/* Criterion results */}
                    {selectedResult.criterion_results.length > 0 && (
                      <div ref={criterionRef}>
                        <h5 style={{ margin: "0 0 var(--space-2)", fontSize: "0.88rem", fontWeight: 700, color: "var(--slate-950)" }}>Criteria Breakdown</h5>
                        <div className="list-stack">
                          {selectedResult.criterion_results.map((cr) => {
                            const crPct = cr.max_points > 0 ? (cr.score / cr.max_points) * 100 : 0;
                            const sem = scoreSemantic(crPct);
                            const isHighlighted = highlightedCriterion === cr.criterion_id;
                            // Show human score comparison if available
                            const humanCrScore = humanReviewed[selectedQ!]
                              ? parseFloat(criterionScores[cr.criterion_id] ?? "")
                              : NaN;
                            return (
                              <div key={cr.criterion_id} style={{
                                display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                                padding: "var(--space-3)",
                                borderRadius: "var(--radius-md)",
                                border: isHighlighted ? "2px solid var(--brand-primary)" : "1px solid var(--border-subtle)",
                                background: isHighlighted ? "var(--info-bg)" : "var(--surface-muted)",
                                transition: "all 0.3s",
                              }}>
                                <div className={`risk-score risk-${sem === "success" ? "low" : sem === "warning" ? "medium" : "high"}`}
                                  style={{ fontSize: "0.82rem", minWidth: 55, flexShrink: 0 }}>
                                  {cr.score}/{cr.max_points}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>{cr.criterion_label}</div>
                                  <div style={{
                                    fontSize: "0.8rem", marginTop: 4, lineHeight: 1.5,
                                    background: "rgba(255, 235, 130, 0.25)",
                                    border: "1px solid rgba(200, 170, 50, 0.3)",
                                    borderRadius: "var(--radius-sm)",
                                    padding: "var(--space-2) var(--space-3)",
                                    color: "var(--text-secondary)",
                                  }}>
                                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", marginRight: "var(--space-1)" }}>AI:</span>
                                    {cr.rationale}
                                  </div>
                                  {/* Show evidence for this criterion inline */}
                                  {cr.evidence_spans.length > 0 && (
                                    <div style={{ marginTop: "var(--space-2)" }}>
                                      {cr.evidence_spans.map((es, ei) => (
                                        <div key={ei} style={{ background: "var(--warning-bg)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", fontSize: "0.78rem", marginBottom: 2, display: "flex", gap: "var(--space-2)", lineHeight: 1.4 }}>
                                          <span style={{ color: "var(--warning-text)", fontFamily: "monospace" }}>&ldquo;{es.quote}&rdquo;</span>
                                          <span style={{ ...S.textMuted }}>→ {es.reason}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Override (only after reveal) */}
                  <div className="panel">
                    <h4 style={{ margin: "0 0 var(--space-3)", fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "var(--warning-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>✏️</span>
                      Manual Override
                    </h4>
                    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", ...S.textMuted, marginBottom: "var(--space-1)", fontWeight: 700 }}>
                          Score (0–{selectedResult.max_points})
                        </label>
                        <input type="number" min={0} max={selectedResult.max_points} step={0.5}
                          value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)}
                          style={{ ...S.input, width: 90 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "0.8rem", ...S.textMuted, marginBottom: "var(--space-1)", fontWeight: 700 }}>Comment</label>
                        <input type="text" value={overrideComment} onChange={(e) => setOverrideComment(e.target.value)}
                          style={S.input} placeholder="Optional justification…" />
                      </div>
                      <button onClick={handleSubmitOverride} disabled={overrideScore === ""}
                        style={{ ...S.btn, background: "var(--brand-secondary)", opacity: overrideScore === "" ? 0.4 : 1 }}>
                        Override
                      </button>
                    </div>

                    {run.reviews.filter((r) => r.question_id === selectedQ).length > 0 && (
                      <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
                        <h5 style={{ margin: "0 0 var(--space-2)", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", ...S.textMuted }}>History</h5>
                        {run.reviews.filter((r) => r.question_id === selectedQ).map((r, i) => (
                          <div key={i} style={{ fontSize: "0.8rem", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", marginBottom: 2, border: "1px solid var(--border-subtle)" }}>
                            <strong>{r.original_score} → {r.override_score ?? "accepted"}</strong>
                            {r.comment && <span style={S.textMuted}> — {r.comment}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : selectedExamQ && !selectedResult ? (
            <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--space-4)" }}>⏳</div>
              <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem", fontWeight: 700 }}>{selectedExamQ.title}</h3>
              <p style={{ ...S.textMuted, fontSize: "0.9rem" }}>
                This question is still being graded by the AI…
              </p>
              <div style={{ marginTop: "var(--space-4)", display: "inline-flex", gap: 6 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-primary)", opacity: 0.3, animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite` }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p style={{ fontSize: "1.05rem", ...S.textMuted }}>← Select a question from the sidebar</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with grading time */}
      {gradingDone && totalGradingTime != null && (
        <div style={{ ...S.container, padding: "var(--space-4) 0 var(--space-8)", textAlign: "center" }}>
          <div style={{ ...S.surfaceStrong, display: "inline-flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-6)" }}>
            <span style={{ fontSize: "1.1rem" }}>⏱</span>
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Total grading time: {totalGradingTime}s
            </span>
            <span style={{ fontSize: "0.82rem", ...S.textMuted }}>
              ({run.question_results.length} questions • {run.question_results.filter(r => r.lane !== "deterministic").length} AI-graded)
            </span>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.3 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function groupQuestions(questions: ExamQuestion[]): [string, ExamQuestion[], string][] {
  const groups: Map<string, ExamQuestion[]> = new Map();
  for (const q of questions) {
    const num = getProblemNum(q.title);
    const key = num || "0";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(q);
  }
  return Array.from(groups.entries()).map(([num, qs]) => {
    const meta = PROBLEM_META[num] ?? { title: "Other" };
    return [`Problem ${num} — ${meta.title}`, qs, num];
  });
}
