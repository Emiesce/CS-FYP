"use client";

/* ------------------------------------------------------------------ */
/*  Student Dashboard                                                 */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import { DEMO_CURRENT_EXAM, UPCOMING_EXAMS, PAST_EXAMS, HKUST_SEMESTERS, getCurrentSemester } from "@/lib/fixtures";
import type { Exam, Semester } from "@/types";

function StudentDashboardContent() {
  const [semester, setSemester] = useState<Semester>(() => getCurrentSemester());

  const allExams = useMemo(
    () => [DEMO_CURRENT_EXAM, ...UPCOMING_EXAMS, ...PAST_EXAMS],
    [],
  );

  const filtered = useMemo(
    () => allExams.filter((e) => e.semesterId === semester.id),
    [allExams, semester.id],
  );

  const currentExams = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams = filtered.filter((e) => e.status === "past");

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") return `/student/exams/current`;
    if (exam.status === "past") return `/student/exams/${exam.id}`;
    return undefined;
  };

  return (
    <>
      <DashboardHeader />

      <div style={{ marginBottom: "var(--space-6)" }}>
        <SemesterSwitcher
          semesters={HKUST_SEMESTERS}
          current={semester}
          onChange={setSemester}
        />
      </div>

      <div className="section-stack">
        <ExamSection
          title="Current Exam"
          exams={currentExams}
          hrefForExam={hrefForExam}
          emptyMessage="No exam is currently in progress."
        />
        <ExamSection
          title="Upcoming Examinations"
          exams={upcomingExams}
          emptyMessage="No upcoming exams scheduled."
        />
        <ExamSection
          title="Past Examinations"
          exams={pastExams}
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
