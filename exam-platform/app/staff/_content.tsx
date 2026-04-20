"use client";

/* ------------------------------------------------------------------ */
/*  Staff Dashboard – client content                                  */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/*  so that useState is seeded with the same value on server + client */
/*  — no hydration mismatch, no useEffect required.                  */
/* ------------------------------------------------------------------ */

import { useMemo, useState, useSyncExternalStore } from "react";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import {
  DEMO_CURRENT_EXAM,
  UPCOMING_EXAMS,
  PAST_EXAMS,
  HKUST_SEMESTERS,
  COMP1023_EXAM,
  MGMT2110_EXAM,
  MGMT2110_EXAM_ID,
} from "@/lib/fixtures";
import { useSession } from "@/features/auth";
import {
  getAllSubmissions,
  getAllSubmissionsServer,
  subscribeToExamAnswers,
} from "@/features/exams/exam-answer-store";
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

  // Check if any student has submitted the COMP1023 exam
  const submissions = useSyncExternalStore(
    subscribeToExamAnswers,
    getAllSubmissions,
    getAllSubmissionsServer,
  );
  const comp1023HasSubmission = submissions.some((s) => s.examId === COMP1023_EXAM.id);

  const allExams = useMemo(() => {
    const comp1023: Exam = comp1023HasSubmission
      ? { ...COMP1023_EXAM, status: "past" }
      : COMP1023_EXAM;
    return [
      DEMO_CURRENT_EXAM,
      comp1023,
      ...UPCOMING_EXAMS,
      MGMT2110_EXAM,
      ...PAST_EXAMS,
    ];
  }, [comp1023HasSubmission]);

  const filtered = useMemo(
    () => allExams.filter((e) => e.semesterId === semester.id),
    [allExams, semester.id],
  );

  const currentExams  = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams     = filtered.filter((e) => e.status === "past");

  const canCreate        = user ? hasPermission(user.role, "exam:create")         : false;
  const canEdit          = user ? hasPermission(user.role, "exam:edit")           : false;
  const canViewQuestions = user ? hasPermission(user.role, "exam:view_questions") : false;

  const gradingExamIds = new Set([MGMT2110_EXAM_ID, COMP1023_EXAM.id]);

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current")                  return `/staff/exams/current/proctoring`;
    if (gradingExamIds.has(exam.id))                return `/staff/exams/${exam.id}/grading`;
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
      <Link
        href={
          gradingExamIds.has(exam.id)
            ? `/staff/exams/${exam.id}/grading`
            : `/staff/exams/${exam.id}/proctoring`
        }
        className="button-secondary"
        style={{ textDecoration: "none", fontSize: "0.85rem" }}
      >
        {gradingExamIds.has(exam.id) ? "Open Grading →" : "View Results →"}
      </Link>
    );
  };

  return (
    <>
      <DashboardHeader />

      <div
        className="flex-between"
        style={{ marginBottom: "var(--space-6)", gap: "var(--space-3)", flexWrap: "wrap" }}
      >
        <SemesterSwitcher
          semesters={HKUST_SEMESTERS}
          current={semester}
          onChange={setSemester}
        />
        {canCreate && (
          <Link href="/staff/exams/new" className="button" style={{ textDecoration: "none" }}>
            Create Exam
          </Link>
        )}
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
