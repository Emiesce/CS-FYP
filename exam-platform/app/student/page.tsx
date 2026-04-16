"use client";

/* ------------------------------------------------------------------ */
/*  Student Dashboard                                                 */
/* ------------------------------------------------------------------ */

import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DashboardHeader, ExamSection } from "@/components/dashboard";
import { DEMO_CURRENT_EXAM, UPCOMING_EXAMS, PAST_EXAMS } from "@/lib/fixtures";
import type { Exam } from "@/types";

function StudentDashboardContent() {
  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") return `/student/exams/current`;
    if (exam.status === "past") return `/student/exams/${exam.id}`;
    return undefined;
  };

  return (
    <>
      <DashboardHeader />
      <div className="section-stack">
        <ExamSection
          title="Current Exam"
          exams={[DEMO_CURRENT_EXAM]}
          hrefForExam={hrefForExam}
          emptyMessage="No exam is currently in progress."
        />
        <ExamSection
          title="Upcoming Examinations"
          exams={UPCOMING_EXAMS}
          emptyMessage="No upcoming exams scheduled."
        />
        <ExamSection
          title="Past Examinations"
          exams={PAST_EXAMS}
          hrefForExam={hrefForExam}
          emptyMessage="No past exams to show."
        />
      </div>
    </>
  );
}

export default function StudentDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <StudentDashboardContent />
    </AuthenticatedShell>
  );
}
