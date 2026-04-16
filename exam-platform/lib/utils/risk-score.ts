/* ------------------------------------------------------------------ */
/*  Risk-Score Calculation Utility                                    */
/*                                                                    */
/*  Single source of truth for violation-risk scoring.                */
/*  Deterministic & explainable: weight × severity, sum, normalize.   */
/* ------------------------------------------------------------------ */

import type { ProctoringEvent, ProctoringEventType } from "@/types";
import { MAX_SUSPICIOUS_SCORE, RISK_THRESHOLDS } from "@/lib/constants";

/** Per-event-type base weights (tune here). */
export const EVENT_WEIGHTS: Record<ProctoringEventType, number> = {
  gaze_away: 10,
  camera_blocked: 35,
  multiple_faces: 40,
  face_missing: 15,
  camera_unavailable: 25,
  tab_switch: 30,
  window_exit: 45,
} as const;

export type RiskLevel = "low" | "medium" | "high";

/**
 * Score a single proctoring event.
 * @returns Raw un-clamped score contribution.
 */
export function scoreEvent(event: ProctoringEvent): number {
  const weight = EVENT_WEIGHTS[event.type] ?? 0;
  return weight * event.severity;
}

/**
 * Compute the overall risk score for a set of events.
 * Formula: sum(weight × severity) / MAX_SUSPICIOUS_SCORE × 100, clamped to [0, 100].
 */
export function computeRiskScore(events: readonly ProctoringEvent[]): number {
  if (events.length === 0) return 0;
  const rawSum = events.reduce((acc, e) => acc + scoreEvent(e), 0);
  const normalized = (rawSum / MAX_SUSPICIOUS_SCORE) * 100;
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

/**
 * Map a 0–100 risk score to a semantic risk level.
 */
export function riskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.LOW_MAX) return "low";
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return "medium";
  return "high";
}

/**
 * CSS class suffix for a given risk level (maps to globals.css).
 */
export function riskClassName(score: number): string {
  const level = riskLevel(score);
  return `risk-${level}`;
}

/**
 * Build an event-type breakdown for a set of events,
 * useful for explaining the final score to staff.
 */
export function eventBreakdown(
  events: readonly ProctoringEvent[],
): { type: ProctoringEventType; count: number; totalWeight: number }[] {
  const map = new Map<ProctoringEventType, { count: number; totalWeight: number }>();

  for (const e of events) {
    const existing = map.get(e.type) ?? { count: 0, totalWeight: 0 };
    existing.count += 1;
    existing.totalWeight += scoreEvent(e);
    map.set(e.type, existing);
  }

  return Array.from(map.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

/**
 * Count events whose individual score exceeds a severity threshold.
 */
export function countHighSeverityEvents(
  events: readonly ProctoringEvent[],
  threshold = 0.7,
): number {
  return events.filter((e) => e.severity >= threshold).length;
}
