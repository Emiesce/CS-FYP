"use client";

/* ------------------------------------------------------------------ */
/*  Staff Dashboard – client content                                  */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/*  so that useState is seeded with the same value on server + client */
/*  — no hydration mismatch, no useEffect required.                  */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import { getDashboardCatalog } from "@/features/catalog/catalog-service";
import { useSession } from "@/features/auth";
import { hasPermission } from "@/types";
import type { Exam, Semester } from "@/types";
import Link from "next/link";
export function StaffDashboardContent() {
  const { user } = useSession();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void getDashboardCatalog()
        .then((catalog) => {
          if (cancelled) return;
          setSemesters(catalog.semesters);
          setAllExams(catalog.exams);
          setSemester((prev) =>
            prev
              ? (catalog.semesters.find((s) => s.id === prev.id) ?? prev)
              : (catalog.semesters.find((item) => item.id === catalog.currentSemesterId) ??
                  catalog.semesters[0] ??
                  null),
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    // Poll every 30 s so that an exam transitioning from "current" → "past"
    // is reflected without requiring a manual page refresh.
    const interval = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(
    () => allExams.filter((e) => !semester || e.semesterId === semester.id),
    [allExams, semester],
  );

  const currentExams  = filtered.filter((e) => e.status === "current");
  const upcomingExams = filtered.filter((e) => e.status === "upcoming");
  const pastExams     = filtered.filter((e) => e.status === "past");

  const canCreate        = user ? hasPermission(user.role, "exam:create")         : false;
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
      <Link
        href={
          `/staff/exams/${exam.id}/proctoring`
        }
        className="button-secondary"
        style={{ textDecoration: "none", fontSize: "0.85rem" }}
      >
        View Results →
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
        {semester ? (
          <SemesterSwitcher
            semesters={semesters}
            current={semester}
            onChange={(value) => setSemester(value)}
          />
        ) : null}
        {canCreate && (
          <Link href="/staff/exams/new" className="button" style={{ textDecoration: "none" }}>
            Create Exam
          </Link>
        )}
      </div>

      {loading && (
        <div className="panel">
          <p className="helper-text" style={{ margin: 0 }}>Loading exam catalog...</p>
        </div>
      )}

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
