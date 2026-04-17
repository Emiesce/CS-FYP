"use client";

/* ------------------------------------------------------------------ */
/*  Student Dashboard – client content                                */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/* ------------------------------------------------------------------ */

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import {
  DEMO_CURRENT_EXAM,
  UPCOMING_EXAMS,
  PAST_EXAMS,
  HKUST_SEMESTERS,
  COMP1023_EXAM,
} from "@/lib/fixtures";
import { useSession } from "@/features/auth";
import {
  isExamSubmitted,
  getAllSubmissions,
  getAllSubmissionsServer,
  subscribeToExamAnswers,
} from "@/features/exams/exam-answer-store";
import type { Exam, Semester } from "@/types";

interface Props {
  initialSemesterId: string;
}

export function StudentDashboardContent({ initialSemesterId }: Props) {
  const { user } = useSession();
  const studentId = user?.studentId ?? user?.id ?? "";

  const [semester, setSemester] = useState<Semester>(
    () => HKUST_SEMESTERS.find((s) => s.id === initialSemesterId) ?? HKUST_SEMESTERS[0],
  );

  // Use cached snapshot to avoid infinite loop
  const submissions = useSyncExternalStore(
    subscribeToExamAnswers,
    getAllSubmissions,
    getAllSubmissionsServer,
  );
  const comp1023Submitted = submissions.some(
    (s) => s.examId === COMP1023_EXAM.id && s.studentId === studentId,
  );

  const allExams = useMemo(() => {
    // If COMP1023 is submitted, show it as "past" instead of "current"
    const comp1023: Exam = comp1023Submitted
      ? { ...COMP1023_EXAM, status: "past" }
      : COMP1023_EXAM;
    return [DEMO_CURRENT_EXAM, comp1023, ...UPCOMING_EXAMS, ...PAST_EXAMS];
  }, [comp1023Submitted]);

  const filtered = useMemo(
    () => allExams.filter((e) => e.semesterId === semester.id),
    [allExams, semester.id],
  );

  const currentExams  = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams     = filtered.filter((e) => e.status === "past");

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") {
      if (exam.id === COMP1023_EXAM.id) return `/student/exams/${exam.id}/take`;
      return `/student/exams/current`;
    }
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
