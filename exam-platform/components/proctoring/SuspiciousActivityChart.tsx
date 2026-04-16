"use client";

/* ------------------------------------------------------------------ */
/*  SuspiciousActivityChart – alert timeline across the exam          */
/* ------------------------------------------------------------------ */

import type { ProctoringEvent } from "@/types";
import { eventTypeLabel, formatCountdown, formatTime } from "@/lib/utils/format";
import { Icon } from "@/components/ui";

interface TimelinePoint {
  id: string;
  eventType: string;
  startSeconds: number;
  endSeconds: number;
  timestamp: string;
  message: string;
  severity: number;
  durationSeconds: number;
}

interface SuspiciousActivityChartProps {
  events: ProctoringEvent[];
  durationSeconds: number;
  startedAt?: string | null;
  title?: string;
}

function severityColor(severity: number): string {
  if (severity >= 0.7) return "var(--danger-text)";
  if (severity >= 0.4) return "var(--warning-text)";
  return "var(--brand-primary)";
}

function buildTimelinePoints(
  events: ProctoringEvent[],
  durationSeconds: number,
  startedAt?: string | null,
): TimelinePoint[] {
  if (events.length === 0) return [];

  const fallbackStart =
    startedAt ??
    new Date(
      Math.min(...events.map((event) => new Date(event.timestamp).getTime())),
    ).toISOString();
  const startMs = new Date(fallbackStart).getTime();

  return [...events]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((event) => {
      const effectiveDuration = Math.max(1, event.durationSeconds ?? 1);
      const endSeconds = Math.max(
        0,
        Math.min(
          durationSeconds,
          Math.round((new Date(event.timestamp).getTime() - startMs) / 1000),
        ),
      );
      const explicitStartSeconds = event.startedAt
        ? Math.round((new Date(event.startedAt).getTime() - startMs) / 1000)
        : endSeconds - effectiveDuration;
      const startSeconds = Math.max(
        0,
        Math.min(durationSeconds, explicitStartSeconds),
      );

      return {
        id: event.id,
        eventType: eventTypeLabel(event.type),
        startSeconds,
        endSeconds: Math.max(startSeconds, endSeconds),
        timestamp: event.timestamp,
        message: event.message,
        severity: event.severity,
        durationSeconds: effectiveDuration,
      };
    });
}

export function SuspiciousActivityChart({
  events,
  durationSeconds,
  startedAt,
  title = "Alert Timeline",
}: SuspiciousActivityChartProps) {
  const data = buildTimelinePoints(events, durationSeconds, startedAt);
  const eventTypes = Array.from(new Set(data.map((point) => point.eventType)));
  const tickCount = Math.min(5, Math.max(2, Math.floor(durationSeconds / 15) + 1));
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round((durationSeconds * index) / (tickCount - 1 || 1)),
  );

  return (
    <div className="panel chart-card">
      <div className="title-with-icon" style={{ marginBottom: "var(--space-3)" }}>
        <Icon name="timeline" />
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{title}</h3>
      </div>
      {data.length === 0 ? (
        <div className="empty-state">
          <p className="helper-text">No alerts recorded yet. Points will appear as alerts occur.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "var(--space-4)",
              alignItems: "end",
            }}
          >
            <div />
            <div style={{ position: "relative", height: "1.5rem" }}>
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="timestamp"
                  style={{
                    position: "absolute",
                    left: `${(tick / durationSeconds) * 100}%`,
                    transform: "translateX(-50%)",
                    top: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatCountdown(tick)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            {eventTypes.map((eventType) => {
              const rowEvents = data.filter((point) => point.eventType === eventType);

              return (
                <div
                  key={eventType}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 1fr",
                    gap: "var(--space-4)",
                    alignItems: "center",
                  }}
                >
                  <div className="helper-text" style={{ fontWeight: 600 }}>
                    {eventType}
                  </div>
                  <div
                    style={{
                      position: "relative",
                      minHeight: "3rem",
                      borderRadius: "var(--radius-md)",
                      background: "rgba(15, 76, 129, 0.05)",
                      border: "1px solid var(--border-subtle)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "50%",
                        borderTop: "1px dashed var(--border-strong)",
                        transform: "translateY(-50%)",
                      }}
                    />
                    {rowEvents.map((point) => {
                      const lineLeft = (point.startSeconds / durationSeconds) * 100;
                      const lineWidth = Math.max(
                        ((Math.max(point.endSeconds - point.startSeconds, 1)) / durationSeconds) *
                          100,
                        1.2,
                      );
                      const color = severityColor(point.severity);
                      const tooltip = [
                        point.eventType,
                        `${formatCountdown(point.startSeconds)} to ${formatCountdown(point.endSeconds)}`,
                        `Duration: ${point.durationSeconds}s`,
                        `Logged at ${formatTime(point.timestamp)}`,
                        point.message,
                      ].join("\n");

                      return (
                        <button
                          key={point.id}
                          type="button"
                          title={tooltip}
                          aria-label={tooltip}
                          style={{
                            position: "absolute",
                            left: `${lineLeft}%`,
                            width: `${lineWidth}%`,
                            minWidth: "0.85rem",
                            top: "50%",
                            height: "1rem",
                            padding: 0,
                            border: 0,
                            background: "transparent",
                            transform: "translateY(-50%)",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              left: 0,
                              right: "0.4rem",
                              top: "50%",
                              height: "0.25rem",
                              borderRadius: "999px",
                              background: color,
                              transform: "translateY(-50%)",
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "50%",
                              width: "0.75rem",
                              height: "0.75rem",
                              borderRadius: "999px",
                              background: color,
                              border: "2px solid var(--surface-strong)",
                              transform: "translate(25%, -50%)",
                              boxShadow: "var(--shadow-sm)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
