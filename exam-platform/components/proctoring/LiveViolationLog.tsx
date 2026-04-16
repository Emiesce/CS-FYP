"use client";

/* ------------------------------------------------------------------ */
/*  LiveViolationLog – teaching staff real-time violation feed         */
/* ------------------------------------------------------------------ */

import type { LiveViolationLogEntry } from "@/types";
import { formatTime, eventTypeLabel } from "@/lib/utils/format";
import { RiskBadge, EmptyState, StatusChip } from "@/components/ui";

interface LiveViolationLogProps {
  entries: LiveViolationLogEntry[];
  sessionStatus: "active" | "warning" | "completed" | "terminated";
}

const sessionStatusMap = {
  active: { variant: "safe" as const, label: "Active" },
  warning: { variant: "warning" as const, label: "Warning" },
  completed: { variant: "info" as const, label: "Completed" },
  terminated: { variant: "danger" as const, label: "Terminated" },
};

export function LiveViolationLog({ entries, sessionStatus }: LiveViolationLogProps) {
  const statusInfo = sessionStatusMap[sessionStatus];

  return (
    <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Live Violation Log</h3>
        <StatusChip variant={statusInfo.variant} label={`Session: ${statusInfo.label}`} />
      </div>

      {entries.length === 0 ? (
        <EmptyState message="No violations detected yet." />
      ) : (
        <div className="log-list" role="log" aria-live="polite" aria-label="Live violation log">
          {[...entries].reverse().map((entry) => (
            <div key={entry.id} className="warning-row">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                <div>
                  <strong>{entry.studentName}</strong>
                  <span className="student-id" style={{ marginLeft: "var(--space-2)" }}>
                    {entry.studentNumber}
                  </span>
                </div>
                <RiskBadge score={entry.runningRiskScore} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{eventTypeLabel(entry.eventType)}: {entry.message}</span>
                <span className="timestamp">{formatTime(entry.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
