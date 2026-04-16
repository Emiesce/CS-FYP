"use client";

/* ------------------------------------------------------------------ */
/*  Teaching Staff Dashboard                                          */
/* ------------------------------------------------------------------ */

import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DashboardHeader, ExamSection } from "@/components/dashboard";
import { DEMO_CURRENT_EXAM, UPCOMING_EXAMS, PAST_EXAMS, EXAM_MODULES } from "@/lib/fixtures";
import type { Exam } from "@/types";
import Link from "next/link";

function StaffDashboardContent() {
  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") return `/staff/exams/current/proctoring`;
    if (exam.status === "past") return `/staff/exams/${exam.id}/proctoring`;
    if (exam.status === "upcoming") return `/staff/exams/${exam.id}/edit`;
    return undefined;
  };

  const actionsForUpcomingExam = (exam: Exam) => {
    if (exam.status !== "upcoming") return null;
    return (
      <Link
        href={`/staff/exams/${exam.id}/edit`}
        className="button-secondary"
        style={{ textDecoration: "none" }}
      >
        Edit Exam
      </Link>
    );
  };

  const actionsForPastExam = (exam: Exam) => {
    if (exam.status !== "past") return null;
    return (
      <div className="flex-row" style={{ flexWrap: "wrap" }}>
        {EXAM_MODULES.map((mod) => (
          <span key={mod.key}>
            {mod.enabled ? (
              <Link
                href={`/staff/exams/${exam.id}/${mod.key}`}
                className="badge badge-info"
                style={{ textDecoration: "none" }}
              >
                {mod.label}
              </Link>
            ) : (
              <span className="badge badge-warning" style={{ opacity: 0.6, cursor: "not-allowed" }}>
                {mod.label} – Coming Soon
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <DashboardHeader />
      <div className="section-stack">
        <ExamSection
          title="Current Exam"
          exams={[DEMO_CURRENT_EXAM]}
          hrefForExam={hrefForExam}
          actionsForExam={(exam) =>
            exam.status === "current" ? (
              <Link href="/staff/exams/current/proctoring" className="button" style={{ textDecoration: "none" }}>
                Monitor Live
              </Link>
            ) : null
          }
          emptyMessage="No exam is currently in progress."
        />
        <ExamSection
          title="Upcoming Examinations"
          exams={UPCOMING_EXAMS}
          hrefForExam={hrefForExam}
          actionsForExam={actionsForUpcomingExam}
          emptyMessage="No upcoming exams scheduled."
        />
        <ExamSection
          title="Past Examinations"
          exams={PAST_EXAMS}
          hrefForExam={hrefForExam}
          actionsForExam={actionsForPastExam}
          emptyMessage="No past exams to show."
        />
      </div>
    </>
  );
}

export default function StaffDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="teaching_staff">
      <StaffDashboardContent />
    </AuthenticatedShell>
  );
}
