"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { useSession } from "@/features/auth";
import { getVisibleCourses } from "@/features/catalog/catalog-service";
import type { Course } from "@/types";

function CreateExamCourseSelectionContent() {
  const { user } = useSession();
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getVisibleCourses(undefined, "visible")
      .then((courses) => {
        if (!cancelled) setAssignedCourses(courses);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const instructorCourses = assignedCourses.filter((course) => course.instructorIds.includes(user?.id ?? ""));

  return (
    <>
      <div className="flex-between" style={{ marginBottom: "var(--space-6)", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div className="flex-row">
          <Link href="/staff" className="button-ghost" style={{ textDecoration: "none" }}>
            ← Back
          </Link>
          <h1 className="page-title" style={{ fontSize: "1.5rem" }}>
            Create Exam
          </h1>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "var(--space-2)" }}>Choose a course</h2>
        <p className="helper-text" style={{ margin: 0 }}>
          You can only create examinations for courses where you are assigned as an instructor.
        </p>
      </div>

      {loading ? (
        <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <p className="helper-text" style={{ margin: 0 }}>Loading your courses...</p>
        </div>
      ) : instructorCourses.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <p className="helper-text" style={{ margin: 0 }}>
            You are not currently assigned to any courses that allow exam creation.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          {instructorCourses.map((course) => (
            <div
              key={course.id}
              className="panel"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--space-4)",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ marginTop: 0, marginBottom: "var(--space-1)" }}>
                  {course.code}: {course.name}
                </h3>
                <p className="helper-text" style={{ margin: 0 }}>
                  Semester: {course.semesterId}
                </p>
              </div>
              <Link
                href={`/staff/exams/new/edit?courseId=${encodeURIComponent(course.id)}`}
                className="button"
                style={{ textDecoration: "none" }}
              >
                Create Exam for This Course
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CreateExamCourseSelectionPage() {
  return (
    <AuthenticatedShell requiredRole="instructor">
      <CreateExamCourseSelectionContent />
    </AuthenticatedShell>
  );
}
