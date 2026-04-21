"use client";

/* ------------------------------------------------------------------ */
/*  Staff Analytics Dashboard                                         */
/*  Class-level + student-level analytics for a past exam.            */
/* ------------------------------------------------------------------ */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { getAnalyticsSnapshot, sendAnalyticsChat } from "@/features/analytics/analytics-service";
import type {
  ExamAnalyticsSnapshot,
  AnalyticsOverview,
  QuestionAnalytics,
  TopicAnalytics,
  StudentAnalyticsRecord,
  AnalyticsChatMessage,
} from "@/types";

/* ---- Inline SVG Icons ---- */

const IconBarChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
);
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
);
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
const IconTrendingUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
);
const IconTrendingDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
);
const IconAlertTriangle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const IconMessageCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
);
const IconChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);
const IconChevronUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
);

/* ---- Shared styles ---- */
const card: React.CSSProperties = {
  background: "var(--surface-strong)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-subtle)",
  padding: "var(--space-4)",
  boxShadow: "var(--shadow-sm)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  margin: "0 0 var(--space-3)",
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

/* ---- Tab type ---- */
type Tab = "class" | "students" | "chat";

/* ================================================================== */
/*  Metric Card                                                       */
/* ================================================================== */

function MetricCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ ...card, textAlign: "center", minWidth: 120 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ================================================================== */
/*  Score Distribution Bar Chart (simple CSS bars)                    */
/* ================================================================== */

function DistributionChart({ data, maxCount }: {
  data: { label: string; count: number }[];
  maxCount: number;
}) {
  if (!data.length) return null;
  const peak = maxCount || Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginBottom: 2 }}>{d.count}</div>
          <div
            style={{
              width: "100%",
              height: `${Math.max(4, (d.count / peak) * 80)}px`,
              background: "var(--hkust-blue-700)",
              borderRadius: "3px 3px 0 0",
              opacity: d.count > 0 ? 1 : 0.2,
            }}
          />
          <div style={{ fontSize: "0.55rem", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Question Table                                                    */
/* ================================================================== */

function QuestionTable({ questions, title, emptyMsg }: {
  questions: QuestionAnalytics[];
  title: string;
  emptyMsg: string;
}) {
  if (!questions.length) return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{emptyMsg}</p>;
  return (
    <div style={card}>
      <h3 style={sectionTitle}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ textAlign: "left", padding: "var(--space-2)", fontWeight: 600 }}>Question</th>
              <th style={{ textAlign: "right", padding: "var(--space-2)", fontWeight: 600 }}>Mean</th>
              <th style={{ textAlign: "right", padding: "var(--space-2)", fontWeight: 600 }}>Max</th>
              <th style={{ textAlign: "right", padding: "var(--space-2)", fontWeight: 600 }}>Success%</th>
              <th style={{ textAlign: "right", padding: "var(--space-2)", fontWeight: 600 }}>StdDev</th>
              <th style={{ textAlign: "right", padding: "var(--space-2)", fontWeight: 600 }}>Overrides</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.questionId} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "var(--space-2)" }}>
                  <div style={{ fontWeight: 500 }}>{q.questionTitle}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{q.questionType}{q.topicIds.length > 0 ? ` · ${q.topicIds.join(", ")}` : ""}</div>
                </td>
                <td style={{ textAlign: "right", padding: "var(--space-2)" }}>{q.meanScore.toFixed(1)}</td>
                <td style={{ textAlign: "right", padding: "var(--space-2)" }}>{q.maxPoints}</td>
                <td style={{ textAlign: "right", padding: "var(--space-2)", color: q.successRate < 50 ? "var(--danger-text)" : "var(--success-text)" }}>{q.successRate.toFixed(0)}%</td>
                <td style={{ textAlign: "right", padding: "var(--space-2)" }}>{q.stdDev.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "var(--space-2)" }}>{q.overrideCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Topic Summary Cards                                               */
/* ================================================================== */

function TopicCards({ topics }: { topics: TopicAnalytics[] }) {
  if (!topics.length) return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No topic data available. Add topicIds to questions to enable topic analytics.</p>;
  const sorted = [...topics].sort((a, b) => a.percentage - b.percentage);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
      {sorted.map((t) => (
        <div key={t.topicId} style={card}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "var(--space-1)" }}>{t.topicLabel}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "var(--space-2)" }}>
            <span>{t.meanScore.toFixed(1)} / {t.maxPossible}</span>
            <span style={{ fontWeight: 600, color: t.percentage < 50 ? "var(--danger-text)" : "var(--success-text)" }}>{t.percentage.toFixed(0)}%</span>
          </div>
          {/* progress bar */}
          <div style={{ height: 6, borderRadius: 3, background: "var(--slate-200)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, t.percentage)}%`, height: "100%", borderRadius: 3, background: t.percentage < 50 ? "var(--danger-text)" : "var(--success-text)", transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>{t.questionCount} question{t.questionCount !== 1 ? "s" : ""}</div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Student Analytics Table                                           */
/* ================================================================== */

function StudentTable({ students, maxScore }: {
  students: StudentAnalyticsRecord[];
  maxScore: number;
}) {
  const [sortKey, setSortKey] = useState<"percentage" | "totalScore" | "riskScore">("percentage");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...students];
    arr.sort((a, b) => {
      const av = sortKey === "riskScore" ? (a.riskScore ?? -1) : a[sortKey];
      const bv = sortKey === "riskScore" ? (b.riskScore ?? -1) : b[sortKey];
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [students, sortKey, sortAsc]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const SortIcon = sortAsc ? IconChevronUp : IconChevronDown;

  if (!students.length) return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No student data.</p>;

  return (
    <div style={{ ...card, padding: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th style={{ textAlign: "left", padding: "var(--space-3) var(--space-3)", fontWeight: 600 }}>Student</th>
              <th style={{ textAlign: "right", padding: "var(--space-3)", fontWeight: 600, cursor: "pointer" }} onClick={() => toggleSort("totalScore")}>
                Score {sortKey === "totalScore" && <SortIcon />}
              </th>
              <th style={{ textAlign: "right", padding: "var(--space-3)", fontWeight: 600, cursor: "pointer" }} onClick={() => toggleSort("percentage")}>
                % {sortKey === "percentage" && <SortIcon />}
              </th>
              <th style={{ textAlign: "right", padding: "var(--space-3)", fontWeight: 600, cursor: "pointer" }} onClick={() => toggleSort("riskScore")}>
                Risk {sortKey === "riskScore" && <SortIcon />}
              </th>
              <th style={{ textAlign: "right", padding: "var(--space-3)", fontWeight: 600 }}>Overrides</th>
              <th style={{ width: 40, padding: "var(--space-3)" }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const isExpanded = expandedId === s.studentId;
              return (
                <tr key={s.studentId} style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", background: isExpanded ? "var(--surface-muted)" : undefined }} onClick={() => setExpandedId(isExpanded ? null : s.studentId)}>
                  <td style={{ padding: "var(--space-2) var(--space-3)" }}>{s.studentName || s.studentId}</td>
                  <td style={{ textAlign: "right", padding: "var(--space-2) var(--space-3)" }}>{s.totalScore.toFixed(1)} / {s.maxScore}</td>
                  <td style={{ textAlign: "right", padding: "var(--space-2) var(--space-3)", fontWeight: 600, color: s.percentage < 50 ? "var(--danger-text)" : "var(--success-text)" }}>{s.percentage.toFixed(0)}%</td>
                  <td style={{ textAlign: "right", padding: "var(--space-2) var(--space-3)" }}>
                    {s.riskScore != null ? (
                      <span className={`badge badge-${s.riskScore > 60 ? "danger" : s.riskScore > 30 ? "warning" : "success"}`} style={{ fontSize: "0.7rem" }}>{s.riskScore}</span>
                    ) : <span style={{ color: "var(--text-muted)" }}>--</span>}
                  </td>
                  <td style={{ textAlign: "right", padding: "var(--space-2) var(--space-3)" }}>{s.reviewOverrideCount}</td>
                  <td style={{ padding: "var(--space-2) var(--space-3)" }}>{isExpanded ? <IconChevronUp /> : <IconChevronDown />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  AI Summary Card                                                   */
/* ================================================================== */

function AISummaryCard({ summary }: { summary?: ExamAnalyticsSnapshot["aiSummary"] }) {
  if (!summary) return null;
  return (
    <div style={{ ...card, borderLeft: "3px solid var(--hkust-blue-700)" }}>
      <h3 style={sectionTitle}>AI Summary <span className={`badge badge-${summary.confidence === "high" ? "success" : summary.confidence === "medium" ? "warning" : "info"}`} style={{ fontSize: "0.65rem" }}>{summary.confidence}</span></h3>
      {summary.commonMisconceptions.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "var(--space-1)" }}>Common Misconceptions</div>
          <ul style={{ margin: "0 0 var(--space-3)", paddingLeft: "var(--space-5)", fontSize: "0.82rem" }}>
            {summary.commonMisconceptions.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </>
      )}
      {summary.recommendations.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "var(--space-1)" }}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: "var(--space-5)", fontSize: "0.82rem" }}>
            {summary.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Analytics Chat Panel                                              */
/* ================================================================== */

function ChatPanel({ examId }: { examId: string }) {
  const [messages, setMessages] = useState<AnalyticsChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: AnalyticsChatMessage = { role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { reply, timestamp } = await sendAnalyticsChat(examId, text, [...messages, userMsg]);
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`, timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, examId, messages]);

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", height: 500 }}>
      <h3 style={sectionTitle}><IconMessageCircle /> Analytics Chat</h3>
      <div style={{ flex: 1, overflowY: "auto", marginBottom: "var(--space-3)", padding: "var(--space-2)", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", marginTop: "var(--space-8)" }}>Ask questions about the exam analytics data.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "var(--space-2)", textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{
              display: "inline-block",
              maxWidth: "80%",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              background: m.role === "user" ? "var(--hkust-blue-700)" : "var(--surface-strong)",
              color: m.role === "user" ? "#fff" : "var(--text-primary)",
              fontSize: "0.82rem",
              textAlign: "left",
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Thinking...</div>}
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about this exam's analytics..."
          style={{
            flex: 1,
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            fontSize: "0.85rem",
            outline: "none",
          }}
          disabled={loading}
        />
        <button className="button-primary" onClick={send} disabled={loading || !input.trim()} style={{ fontSize: "0.82rem" }}>Send</button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Analytics Page                                               */
/* ================================================================== */

function AnalyticsDashboardContent({ examId }: { examId: string }) {
  const [snapshot, setSnapshot] = useState<ExamAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("class");

  // Sync proctoring data on mount then fetch analytics
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {

        const data = await getAnalyticsSnapshot(examId);
        if (!cancelled) setSnapshot(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [examId]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Loading analytics...</div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <IconAlertTriangle />
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>Analytics Unavailable</span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 400, margin: "0 auto" }}>
          {error ?? "No grading data found for this exam. Run grading first to generate analytics."}
        </p>
      </div>
    );
  }

  const { overview: ov, questions, topics, students } = snapshot;

  // Sort questions for hardest/easiest
  const sortedBySuccess = [...questions].sort((a, b) => a.successRate - b.successRate);
  const hardest = sortedBySuccess.slice(0, 5);
  const easiest = [...sortedBySuccess].reverse().slice(0, 5);

  // Flagged: high score + high risk
  const flagged = students.filter(s => s.percentage >= 70 && (s.riskScore ?? 0) > 50);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <IconBarChart /> Analytics
        </h2>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "var(--space-1) 0 0" }}>
          {snapshot.courseCode} – {snapshot.examTitle} · {ov.gradedCount} student{ov.gradedCount !== 1 ? "s" : ""} graded
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "var(--space-2)" }}>
        {([
          { key: "class" as Tab, label: "Class Analytics", icon: <IconBarChart /> },
          { key: "students" as Tab, label: "Student Analytics", icon: <IconUsers /> },
          { key: "chat" as Tab, label: "AI Chat", icon: <IconMessageCircle /> },
        ]).map(t => (
          <button
            key={t.key}
            className={tab === t.key ? "button-primary" : "button-ghost"}
            style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "var(--space-1)" }}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Class Analytics Tab */}
      {tab === "class" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Overview metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
            <MetricCard label="Mean Score" value={`${ov.meanScore.toFixed(1)}`} sub={`/ ${ov.maxTotalPoints}`} />
            <MetricCard label="Mean %" value={`${ov.meanPercentage.toFixed(0)}%`} color={ov.meanPercentage < 50 ? "var(--danger-text)" : "var(--success-text)"} />
            <MetricCard label="Median" value={ov.medianScore.toFixed(1)} />
            <MetricCard label="Std Dev" value={ov.stdDev.toFixed(2)} />
            <MetricCard label="Pass Rate" value={`${ov.passRate.toFixed(0)}%`} color={ov.passRate < 50 ? "var(--danger-text)" : "var(--success-text)"} />
            <MetricCard label="Highest" value={ov.highestScore.toFixed(1)} />
            <MetricCard label="Lowest" value={ov.lowestScore.toFixed(1)} />
            <MetricCard label="Students" value={ov.studentCount} />
          </div>

          {/* Score distribution */}
          <div style={card}>
            <h3 style={sectionTitle}>Score Distribution</h3>
            <DistributionChart data={ov.scoreDistribution} maxCount={Math.max(...ov.scoreDistribution.map(d => d.count), 1)} />
          </div>

          {/* Hardest questions */}
          <QuestionTable questions={hardest} title="Hardest Questions (Lowest Success Rate)" emptyMsg="No questions." />

          {/* Easiest questions */}
          <QuestionTable questions={easiest} title="Easiest Questions (Highest Success Rate)" emptyMsg="No questions." />

          {/* Topics */}
          <div>
            <h3 style={sectionTitle}>Topic Performance</h3>
            <TopicCards topics={topics} />
          </div>

          {/* Flagged students */}
          {flagged.length > 0 && (
            <div style={{ ...card, borderLeft: "3px solid var(--danger-text)" }}>
              <h3 style={{ ...sectionTitle, color: "var(--danger-text)" }}><IconAlertTriangle /> Flagged: High Score + High Risk ({flagged.length})</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 var(--space-2)" }}>
                Students who scored above 70% but have a proctoring risk score above 50.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {flagged.map(s => (
                  <div key={s.studentId} style={{ ...card, padding: "var(--space-2) var(--space-3)", fontSize: "0.8rem" }}>
                    <strong>{s.studentName || s.studentId}</strong>
                    <span style={{ marginLeft: "var(--space-2)" }}>{s.percentage.toFixed(0)}%</span>
                    <span className="badge badge-danger" style={{ marginLeft: "var(--space-2)", fontSize: "0.65rem" }}>Risk: {s.riskScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          <AISummaryCard summary={snapshot.aiSummary} />

          {/* All Questions */}
          <QuestionTable questions={questions} title="All Questions" emptyMsg="No question data." />
        </div>
      )}

      {/* Student Analytics Tab */}
      {tab === "students" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-3)" }}>
            <MetricCard label="Total Students" value={students.length} />
            <MetricCard label="Mean Score" value={`${ov.meanPercentage.toFixed(0)}%`} />
            <MetricCard label="With Proctoring" value={students.filter(s => s.riskScore != null).length} />
            <MetricCard label="Override Count" value={students.reduce((acc, s) => acc + s.reviewOverrideCount, 0)} />
          </div>
          <StudentTable students={students} maxScore={ov.maxTotalPoints} />
        </div>
      )}

      {/* Chat Tab */}
      {tab === "chat" && <ChatPanel examId={examId} />}
    </div>
  );
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  return <AnalyticsDashboardContent examId={examId} />;
}
