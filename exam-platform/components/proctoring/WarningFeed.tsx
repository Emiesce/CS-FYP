"use client";

/* ------------------------------------------------------------------ */
/*  WarningFeed – timestamped list of suspicious events (student)     */
/* ------------------------------------------------------------------ */

import type { ProctoringEvent } from "@/types";
import { formatTime, eventTypeLabel } from "@/lib/utils/format";
import { EmptyState, Icon } from "@/components/ui";

interface WarningFeedProps {
  events: ProctoringEvent[];
}

function severityClass(severity: number): string {
  if (severity >= 0.7) return "is-danger";
  if (severity >= 0.4) return "is-warning";
  return "";
}

export function WarningFeed({ events }: WarningFeedProps) {
  if (events.length === 0) {
    return <EmptyState message="No warnings detected so far." />;
  }

  return (
    <div className="panel">
      <div className="title-with-icon" style={{ marginBottom: "var(--space-3)" }}>
        <Icon name="warning" />
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Warning Feed</h3>
      </div>
      <div className="log-list" role="log" aria-live="polite" aria-label="Proctoring warnings">
        {[...events].reverse().map((evt) => (
          <div key={evt.id} className={`warning-row ${severityClass(evt.severity)}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{eventTypeLabel(evt.type)}</strong>
              <span className="timestamp">{formatTime(evt.timestamp)}</span>
            </div>
            <p className="helper-text" style={{ margin: "var(--space-1) 0 0" }}>
              {evt.message}
            </p>
            {evt.evidenceImageUrl && (
              <img
                src={evt.evidenceImageUrl}
                alt={`Captured evidence for ${eventTypeLabel(evt.type)}`}
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  marginTop: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
