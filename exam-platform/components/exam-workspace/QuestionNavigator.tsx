"use client";

/* ------------------------------------------------------------------ */
/*  QuestionNavigator – numbered grid for jumping between questions    */
/* ------------------------------------------------------------------ */

import type { QuestionNavItem } from "@/types";

interface QuestionNavigatorProps {
  items: QuestionNavItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

const statusClass: Record<string, string> = {
  answered: "qnav-btn answered",
  flagged: "qnav-btn flagged",
  unanswered: "qnav-btn",
};

export function QuestionNavigator({ items, currentIndex, onNavigate }: QuestionNavigatorProps) {
  const answeredCount = items.filter((i) => i.status === "answered").length;
  const flaggedCount = items.filter((i) => i.status === "flagged").length;

  return (
    <aside className="qnav-sidebar">
      {/* Header */}
      <div className="qnav-header">
        <span className="qnav-title">Questions</span>
        <span className="qnav-progress-label">
          {answeredCount}/{items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="qnav-progress-bar">
        <div
          className="qnav-progress-fill"
          style={{ width: `${items.length > 0 ? (answeredCount / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* Grid */}
      <div className="qnav-grid">
        {items.map((item, idx) => (
          <button
            key={item.questionId}
            className={`${statusClass[item.status] ?? "qnav-btn"}${idx === currentIndex ? " current" : ""}`}
            onClick={() => onNavigate(idx)}
            title={`Q${item.order} – ${item.status}`}
          >
            {item.order}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="qnav-legend-group">
        <span className="qnav-legend">
          <span className="qnav-dot answered" />
          <span>Answered <strong>({answeredCount})</strong></span>
        </span>
        <span className="qnav-legend">
          <span className="qnav-dot flagged" />
          <span>Flagged <strong>({flaggedCount})</strong></span>
        </span>
        <span className="qnav-legend">
          <span className="qnav-dot" />
          <span>Unanswered <strong>({items.length - answeredCount - flaggedCount})</strong></span>
        </span>
      </div>
    </aside>
  );
}
