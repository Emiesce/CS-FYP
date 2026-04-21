"use client";

/* ------------------------------------------------------------------ */
/*  Student Dashboard – client content                                */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import { getDashboardCatalog } from "@/features/catalog/catalog-service";
import type { Exam, Semester } from "@/types";
export function StudentDashboardContent() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getDashboardCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setSemesters(catalog.semesters);
        setAllExams(catalog.exams);
        setSemester(
          catalog.semesters.find((item) => item.id === catalog.currentSemesterId) ??
            catalog.semesters[0] ??
            null,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => allExams.filter((e) => !semester || e.semesterId === semester.id),
    [allExams, semester],
  );

  const currentExams  = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams     = filtered.filter((e) => e.status === "past");

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") {
      return `/student/exams/current`;
    }
    if (exam.status === "past") return `/student/exams/${exam.id}`;
    return undefined;
  };

  return (
    <>
      <DashboardHeader />

      <div style={{ marginBottom: "var(--space-6)" }}>
        {semester ? (
          <SemesterSwitcher
            semesters={semesters}
            current={semester}
            onChange={(value) => setSemester(value)}
          />
        ) : null}
      </div>

      {loading && (
        <div className="panel">
          <p className="helper-text" style={{ margin: 0 }}>Loading your exam dashboard...</p>
        </div>
      )}

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
