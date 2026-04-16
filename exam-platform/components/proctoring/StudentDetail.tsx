"use client";

/* ------------------------------------------------------------------ */
/*  StudentDetail – risk summary, breakdown, timeline for one student */
/* ------------------------------------------------------------------ */

import type { StudentRiskSummary } from "@/types";
import { MetricCard, RiskBadge } from "@/components/ui";
import { eventBreakdown } from "@/lib/utils/risk-score";
import { eventTypeLabel } from "@/lib/utils/format";
import { ViolationTimeline } from "./ViolationTimeline";
import { SuspiciousActivityChart } from "./SuspiciousActivityChart";

interface StudentDetailProps {
  summary: StudentRiskSummary;
}

export function StudentDetail({ summary }: StudentDetailProps) {
  const breakdown = eventBreakdown(summary.events);
  const durationSeconds = Math.max(summary.buckets.length * 10, 60);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div className="panel" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <div className="avatar" style={{ width: "4rem", height: "4rem" }}>
          {summary.avatarUrl ? (
            <img src={summary.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                fontSize: "1.5rem",
              }}
            >
              {summary.studentName.charAt(0)}
            </span>
          )}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{summary.studentName}</h2>
          <p className="helper-text" style={{ margin: 0 }}>
            {summary.studentNumber}
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <RiskBadge score={summary.currentRiskScore} />
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-3">
        <MetricCard label="Overall Risk Score" value={summary.currentRiskScore} />
        <MetricCard label="High Severity Events" value={summary.highSeverityEventCount} />
        <MetricCard label="Total Events" value={summary.events.length} />
      </div>

      {/* Event breakdown table */}
      {breakdown.length > 0 && (
        <div className="panel">
          <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "1rem" }}>Event Breakdown</h3>
          <table className="table" aria-label="Event breakdown by type">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Count</th>
                <th>Total Weight</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.type}>
                  <td>{eventTypeLabel(b.type)}</td>
                  <td>{b.count}</td>
                  <td>{b.totalWeight.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart */}
      <SuspiciousActivityChart
        events={summary.events}
        durationSeconds={durationSeconds}
        startedAt={summary.buckets[0]?.windowStartedAt}
        title="Violation Timeline"
      />

      {/* Timeline */}
      <ViolationTimeline events={summary.events} />
    </div>
  );
}
