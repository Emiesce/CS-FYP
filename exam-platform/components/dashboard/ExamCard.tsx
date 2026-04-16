"use client";

/* ------------------------------------------------------------------ */
/*  ExamCard – displays one exam in Current / Upcoming / Past lists   */
/* ------------------------------------------------------------------ */

import type { Exam } from "@/types";
import { formatDate } from "@/lib/utils/format";
import { StatusChip } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ExamCardProps {
  exam: Exam;
  /** Where clicking the card navigates. */
  href?: string;
  /** Extra actions (e.g. "Monitor" for staff). */
  actions?: React.ReactNode;
}

const statusVariant = {
  current: "info" as const,
  upcoming: "safe" as const,
  past: "warning" as const,
};

const statusLabel = {
  current: "In Progress",
  upcoming: "Upcoming",
  past: "Completed",
};

export function ExamCard({ exam, href, actions }: ExamCardProps) {
  const router = useRouter();

  /**
   * When both `href` AND `actions` are provided we must NOT wrap in a
   * `<Link>` because `actions` may itself contain `<Link>` / `<a>` elements,
   * which would produce the invalid `<a>` inside `<a>` that React warns about.
   *
   * Instead we make the card clickable via an onClick handler and use
   * `router.push`.  When there are no actions we can safely use `<Link>`.
   */
  const hasActionsAndHref = !!href && !!actions;

  const handleCardClick = hasActionsAndHref
    ? () => router.push(href)
    : undefined;

  const inner = (
    <div
      className="card exam-card"
      style={{ cursor: href ? "pointer" : "default" }}
      role={hasActionsAndHref ? "link" : undefined}
      tabIndex={hasActionsAndHref ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={
        hasActionsAndHref
          ? (e) => { if (e.key === "Enter" || e.key === " ") router.push(href); }
          : undefined
      }
    >
      <div className="exam-card__head">
        <StatusChip variant={statusVariant[exam.status]} label={statusLabel[exam.status]} />
        {exam.status === "current" && <span className="live-indicator">Live</span>}
      </div>
      <div>
        <h3 className="exam-card__title">
          {exam.courseCode} – {exam.title}
        </h3>
        <p className="helper-text exam-card__subtitle">
          {exam.courseName}
        </p>
      </div>
      <div className="exam-card__details">
        <span>Date: {formatDate(exam.date)}</span>
        <span>Start: {exam.startTime}</span>
        <span>Location: {exam.location}</span>
        {exam.studentCount !== undefined && <span>Students: {exam.studentCount}</span>}
      </div>
      {actions && (
        <div
          className="exam-card__actions"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );

  /* Only wrap in <Link> when there are NO actions (safe — no nested <a>) */
  if (href && !actions) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }

  return inner;
}
