"use client";

/* ------------------------------------------------------------------ */
/*  ViolationTimeline – chronological event timeline for staff review  */
/* ------------------------------------------------------------------ */

import { useState, type CSSProperties } from "react";
import type { ProctoringEvent } from "@/types";
import { formatTime, eventTypeLabel } from "@/lib/utils/format";
import { EmptyState, Icon } from "@/components/ui";

interface ViolationTimelineProps {
  events: ProctoringEvent[];
}

function severityClass(severity: number): string {
  if (severity >= 0.7) return "is-danger";
  if (severity >= 0.4) return "is-warning";
  return "";
}

function severityLabel(severity: number): string {
  if (severity >= 0.7) return "High";
  if (severity >= 0.4) return "Medium";
  return "Low";
}

function severityColor(severity: number): string {
  if (severity >= 0.7) return "var(--danger-text)";
  if (severity >= 0.4) return "var(--warning-text)";
  return "var(--success-text)";
}

/* ---- Inline tooltip component ----------------------------------- */

function EventTooltip({
  event,
  visible,
}: {
  event: ProctoringEvent;
  visible: boolean;
}) {
  if (!visible) return null;

  const style: CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 30,
    background: "var(--slate-950)",
    color: "var(--white)",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-sm)",
    fontSize: "0.82rem",
    lineHeight: 1.45,
    whiteSpace: "nowrap",
    boxShadow: "var(--shadow-md)",
    pointerEvents: "none",
  };

  return (
    <div style={style} role="tooltip">
      <strong style={{ color: severityColor(event.severity) }}>
        {severityLabel(event.severity)} Severity ({(event.severity * 100).toFixed(0)}%)
      </strong>
      <br />
      Type: {eventTypeLabel(event.type)}
      <br />
      Time: {formatTime(event.timestamp)}
      {event.evidenceImageUrl && <><br />📸 Screenshot evidence attached</>}
      {event.evidenceClipUrl && <><br />🎬 Video evidence attached</>}
    </div>
  );
}

/* ---- Main component --------------------------------------------- */

export function ViolationTimeline({ events }: ViolationTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (events.length === 0) {
    return <EmptyState message="No violation events recorded for this student." />;
  }

  return (
    <div className="panel">
      <div className="title-with-icon" style={{ marginBottom: "var(--space-4)" }}>
        <Icon name="list" />
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Violation Timeline</h3>
      </div>
      <div className="timeline-list" aria-label="Violation event timeline">
        {events.map((evt) => (
          <TimelineRow
            key={evt.id}
            event={evt}
            isHovered={hoveredId === evt.id}
            onHover={setHoveredId}
          />
        ))}
      </div>
    </div>
  );
}

/* ---- Single row (extracted for ref management) ------------------- */

function TimelineRow({
  event,
  isHovered,
  onHover,
}: {
  event: ProctoringEvent;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      className={`timeline-row ${severityClass(event.severity)}`}
      style={{ position: "relative" }}
      onMouseEnter={() => onHover(event.id)}
      onMouseLeave={() => onHover(null)}
    >
      <EventTooltip event={event} visible={isHovered} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{eventTypeLabel(event.type)}</strong>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <span
            className="badge"
            style={{
              background: severityColor(event.severity),
              color: "var(--white)",
              fontSize: "0.75rem",
              padding: "0.15rem 0.5rem",
              minHeight: "auto",
            }}
          >
            {severityLabel(event.severity)}
          </span>
          <span className="timestamp">{formatTime(event.timestamp)}</span>
        </div>
      </div>
      <p className="helper-text" style={{ margin: "var(--space-1) 0 0" }}>
        {event.message}
      </p>
      {event.evidenceImageUrl && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <img
            src={event.evidenceImageUrl}
            alt={`Screen capture evidence for ${eventTypeLabel(event.type)} at ${formatTime(event.timestamp)}`}
            style={{
              width: "100%",
              maxWidth: "400px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
            }}
          />
        </div>
      )}
      {event.evidenceClipUrl && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <video
            controls
            preload="metadata"
            style={{
              width: "100%",
              maxWidth: "400px",
              borderRadius: "var(--radius-sm)",
              background: "var(--slate-900)",
            }}
            aria-label={`Evidence clip for ${eventTypeLabel(event.type)} at ${formatTime(event.timestamp)}`}
          >
            <source
              src={event.evidenceClipUrl}
              type={event.evidenceClipMimeType ?? "video/webm"}
            />
            <track kind="captions" />
            Your browser does not support video playback.
          </video>
        </div>
      )}
    </div>
  );
}
