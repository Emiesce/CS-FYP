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
  return (
    <div className="panel qnav-panel">
      <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
        Questions
      </h4>
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
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", fontSize: "0.8rem" }}>
        <span className="qnav-legend"><span className="qnav-dot answered" /> Answered</span>
        <span className="qnav-legend"><span className="qnav-dot flagged" /> Flagged</span>
        <span className="qnav-legend"><span className="qnav-dot" /> Unanswered</span>
      </div>
    </div>
  );
}
