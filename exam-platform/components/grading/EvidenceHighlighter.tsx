"use client";

/* ------------------------------------------------------------------ */
/*  EvidenceHighlighter – renders answer text with highlighted spans   */
/* ------------------------------------------------------------------ */

import type { EvidenceSpan } from "@/types";

interface EvidenceHighlighterProps {
  answerText: string;
  evidenceSpans: EvidenceSpan[];
  /** Which criterion to highlight, or undefined for all */
  activeCriterionId?: string;
}

const HIGHLIGHT_COLORS = [
  "rgba(255, 213, 79, 0.35)",
  "rgba(129, 199, 132, 0.35)",
  "rgba(144, 202, 249, 0.35)",
  "rgba(239, 154, 154, 0.35)",
  "rgba(206, 147, 216, 0.35)",
];

export function EvidenceHighlighter({
  answerText,
  evidenceSpans,
  activeCriterionId,
}: EvidenceHighlighterProps) {
  const filtered = activeCriterionId
    ? evidenceSpans.filter((s) => s.criterionId === activeCriterionId)
    : evidenceSpans;

  if (filtered.length === 0) {
    return (
      <div className="panel" style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
        {answerText}
      </div>
    );
  }

  // Sort spans by startIndex
  const sorted = [...filtered].sort((a, b) => a.startIndex - b.startIndex);

  // Build non-overlapping segments
  const segments: { text: string; span?: EvidenceSpan; colorIdx: number }[] = [];
  let cursor = 0;
  const criterionIds = [...new Set(sorted.map((s) => s.criterionId))];

  for (const span of sorted) {
    const start = Math.max(span.startIndex, cursor);
    const end = Math.min(span.endIndex, answerText.length);
    if (start >= end) continue;

    // Add un-highlighted text before this span
    if (cursor < start) {
      segments.push({ text: answerText.slice(cursor, start), colorIdx: -1 });
    }

    const colorIdx = criterionIds.indexOf(span.criterionId) % HIGHLIGHT_COLORS.length;
    segments.push({ text: answerText.slice(start, end), span, colorIdx });
    cursor = end;
  }

  // Remaining text
  if (cursor < answerText.length) {
    segments.push({ text: answerText.slice(cursor), colorIdx: -1 });
  }

  return (
    <div className="panel" style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.7 }}>
      {segments.map((seg, i) =>
        seg.span ? (
          <span
            key={i}
            title={`${seg.span.reason} (${seg.span.criterionId})`}
            style={{
              backgroundColor: HIGHLIGHT_COLORS[seg.colorIdx],
              borderRadius: 3,
              padding: "1px 2px",
              cursor: "help",
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </div>
  );
}
