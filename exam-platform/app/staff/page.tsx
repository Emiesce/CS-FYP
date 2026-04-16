"use client";

/* ------------------------------------------------------------------ */
/*  Teaching Staff Dashboard (Instructor & TA)                        */
/* ------------------------------------------------------------------ */

import { useCallback, useMemo, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DashboardHeader, ExamSection, SemesterSwitcher } from "@/components/dashboard";
import { DEMO_CURRENT_EXAM, UPCOMING_EXAMS, PAST_EXAMS, EXAM_MODULES, HKUST_SEMESTERS, getCurrentSemester, DEMO_COURSES } from "@/lib/fixtures";
import { useSession } from "@/features/auth";
import { hasPermission } from "@/types";
import type { Course, Exam, Semester } from "@/types";
import Link from "next/link";

function StaffDashboardContent() {
  const { user } = useSession();
  const [semester, setSemester] = useState<Semester>(() => getCurrentSemester());
  const [myCourses, setMyCourses] = useState<Course[]>(DEMO_COURSES);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({ code: "", name: "" });

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

  const canEdit = user ? hasPermission(user.role, "exam:edit") : false;
  const canViewQuestions = user ? hasPermission(user.role, "exam:view_questions") : false;
  const canEditCourse = user ? hasPermission(user.role, "course:edit") : false;

  const instructorCourses = useMemo(
    () => myCourses.filter(
      (c) => c.semesterId === semester.id && user && c.instructorIds.includes(user.id),
    ),
    [myCourses, semester.id, user],
  );

  const startEditCourse = useCallback((c: Course) => {
    setCourseForm({ code: c.code, name: c.name });
    setEditingCourseId(c.id);
  }, []);

  const saveCourse = useCallback(() => {
    if (!courseForm.code.trim() || !courseForm.name.trim()) return;
    setMyCourses((prev) =>
      prev.map((c) =>
        c.id === editingCourseId
          ? { ...c, code: courseForm.code.trim(), name: courseForm.name.trim(), updatedAt: new Date().toISOString() }
          : c,
      ),
    );
    setEditingCourseId(null);
  }, [courseForm, editingCourseId]);

  const hrefForExam = (exam: Exam) => {
    if (exam.status === "current") return `/staff/exams/current/proctoring`;
    if (exam.status === "past") return `/staff/exams/${exam.id}/proctoring`;
    if (exam.status === "upcoming" && canEdit) return `/staff/exams/${exam.id}/edit`;
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

      {/* ---- My Courses (Instructors only) ---- */}
      {canEditCourse && (
        <div className="section-group">
          <h2 className="section-title">My Courses – {semester.label}</h2>

          {instructorCourses.length === 0 ? (
            <div className="empty-state">No courses assigned to you this semester.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {instructorCourses.map((c) => (
                  <tr key={c.id}>
                    {editingCourseId === c.id ? (
                      <>
                        <td>
                          <input
                            className="input"
                            value={courseForm.code}
                            onChange={(e) => setCourseForm((p) => ({ ...p, code: e.target.value }))}
                            style={{ width: "7rem" }}
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            value={courseForm.name}
                            onChange={(e) => setCourseForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <button className="button" style={{ fontSize: "0.85rem" }} onClick={saveCourse}>Save</button>
                            <button className="button-ghost" style={{ fontSize: "0.85rem" }} onClick={() => setEditingCourseId(null)}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{c.code}</strong></td>
                        <td>{c.name}</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="button-ghost" style={{ fontSize: "0.85rem" }} onClick={() => startEditCourse(c)}>
                            Edit Code / Title
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

export default function StaffDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="staff">
      <StaffDashboardContent />
    </AuthenticatedShell>
  );
}
