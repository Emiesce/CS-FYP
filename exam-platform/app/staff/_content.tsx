"use client";

/* ------------------------------------------------------------------ */
/*  Staff Dashboard – client content                                  */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/*  so that useState is seeded with the same value on server + client */
/*  — no hydration mismatch, no useEffect required.                  */
/* ------------------------------------------------------------------ */

import { useMemo, useState } from "react";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import {
  DEMO_CURRENT_EXAM,
  UPCOMING_EXAMS,
  PAST_EXAMS,
  EXAM_MODULES,
  HKUST_SEMESTERS,
} from "@/lib/fixtures";
import { useSession } from "@/features/auth";
import { hasPermission } from "@/types";
import type { Exam, Semester } from "@/types";
import Link from "next/link";

interface Props {
  initialSemesterId: string;
}

export function StaffDashboardContent({ initialSemesterId }: Props) {
  const { user } = useSession();

  // Seeded from the server — same value on both passes, no mismatch.
  const [semester, setSemester] = useState<Semester>(
    () => HKUST_SEMESTERS.find((s) => s.id === initialSemesterId) ?? HKUST_SEMESTERS[0],
  );

  const allExams = useMemo(
    () => [DEMO_CURRENT_EXAM, ...UPCOMING_EXAMS, ...PAST_EXAMS],
    [],
  );

  const filtered = useMemo(
    () => allExams.filter((e) => e.semesterId === semester.id),
    [allExams, semester.id],
  );

  const currentExams  = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams     = filtered.filter((e) => e.status === "past");

  const canEdit          = user ? hasPermission(user.role, "exam:edit")           : false;
  const canViewQuestions = user ? hasPermission(user.role, "exam:view_questions") : false;

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current")                  return `/staff/exams/current/proctoring`;
    if (exam.status === "past")                     return `/staff/exams/${exam.id}/proctoring`;
    if (exam.status === "upcoming" && canEdit)      return `/staff/exams/${exam.id}/edit`;
    if (exam.status === "upcoming" && canViewQuestions) return `/staff/exams/${exam.id}/view`;
    return undefined;
  };

  const actionsForUpcomingExam = (exam: Exam) => {
    if (exam.status !== "upcoming") return null;
    return (
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {canEdit && (
          <Link href={`/staff/exams/${exam.id}/edit`} className="button-secondary" style={{ textDecoration: "none" }}>
            Edit Exam
          </Link>
        )}
        {canViewQuestions && (
          <Link href={`/staff/exams/${exam.id}/view`} className="button-ghost" style={{ textDecoration: "none" }}>
            View Questions
          </Link>
        )}
      </div>
    );
  };

  const actionsForPastExam = (exam: Exam) => {
    if (exam.status !== "past") return null;
    return (
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
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
          exams={upcomingExams}
          hrefForExam={hrefForExam}
          actionsForExam={actionsForUpcomingExam}
          emptyMessage="No upcoming exams scheduled."
        />
        <ExamSection
          title="Past Examinations"
          exams={pastExams}
          hrefForExam={hrefForExam}
          actionsForExam={actionsForPastExam}
          emptyMessage="No past exams to show."
        />
      </div>
    </>
  );
}
