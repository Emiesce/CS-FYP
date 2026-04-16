"use client";

/* ------------------------------------------------------------------ */
/*  Administrator Dashboard                                           */
/*  Course CRUD + member assignment, User Role management             */
/* ------------------------------------------------------------------ */

import { useCallback, useMemo, useState } from "react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { DashboardHeader, SemesterSwitcher } from "@/components/dashboard";
import { HKUST_SEMESTERS, getCurrentSemester, DEMO_COURSES } from "@/lib/fixtures";
import type { Course, Semester, User, UserRole } from "@/types";

/* ------------------------------------------------------------------ */
/*  Seed data (in-memory for demo)                                    */
/* ------------------------------------------------------------------ */

const SEED_USERS: User[] = [
  { id: "stu-001", email: "student@ust.hk", firstName: "Alex", lastName: "Chan", role: "student", studentId: "20845671" },
  { id: "staff-001", email: "instructor@ust.hk", firstName: "Dr. Wong", lastName: "Mei Ling", role: "instructor" },
  { id: "staff-002", email: "ta@ust.hk", firstName: "Kevin", lastName: "Lau", role: "teaching_assistant" },
  { id: "admin-001", email: "admin@ust.hk", firstName: "System", lastName: "Administrator", role: "administrator" },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teaching_assistant", label: "Teaching Assistant" },
  { value: "instructor", label: "Instructor" },
  { value: "administrator", label: "Administrator" },
];

/* ------------------------------------------------------------------ */
/*  Admin content                                                     */
/* ------------------------------------------------------------------ */

/* ---- MemberGroup – checkbox list for a single role category ---- */

function MemberGroup({
  label,
  candidates,
  selected,
  onToggle,
}: {
  label: string;
  candidates: User[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (candidates.length === 0) {
    return (
      <div>
        <p className="form-label" style={{ marginBottom: "var(--space-2)" }}>{label}</p>
        <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No {label.toLowerCase()} found.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="form-label" style={{ marginBottom: "var(--space-2)" }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {candidates.map((u) => (
          <label key={u.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => onToggle(u.id)}
            />
            {u.firstName} {u.lastName} <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>({u.email})</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---- MemberAssignPanel ---- */

interface MemberAssignPanelProps {
  course: Course;
  users: User[];
  onSave: (courseId: string, instructorIds: string[], taIds: string[], studentIds: string[]) => void;
  onClose: () => void;
}

function MemberAssignPanel({ course, users, onSave, onClose }: MemberAssignPanelProps) {
  const [instructorIds, setInstructorIds] = useState<string[]>(course.instructorIds);
  const [taIds, setTaIds] = useState<string[]>(course.taIds);
  const [studentIds, setStudentIds] = useState<string[]>(course.studentIds);

  const instructors = users.filter((u) => u.role === "instructor");
  const tas = users.filter((u) => u.role === "teaching_assistant");
  const students = users.filter((u) => u.role === "student");

  function toggle(ids: string[], setIds: (v: string[]) => void, id: string) {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  return (
    <div className="panel" style={{ marginBottom: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          Manage Members — <strong>{course.code}</strong> {course.name}
        </h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-5)" }}>
        <MemberGroup
          label="Instructors"
          candidates={instructors}
          selected={instructorIds}
          onToggle={(id) => toggle(instructorIds, setInstructorIds, id)}
        />
        <MemberGroup
          label="Teaching Assistants"
          candidates={tas}
          selected={taIds}
          onToggle={(id) => toggle(taIds, setTaIds, id)}
        />
        <MemberGroup
          label="Students"
          candidates={students}
          selected={studentIds}
          onToggle={(id) => toggle(studentIds, setStudentIds, id)}
        />
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="button" onClick={() => onSave(course.id, instructorIds, taIds, studentIds)}>
          Save Members
        </button>
        <button className="button-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AdminDashboardContent() {
  const [semester, setSemester] = useState<Semester>(() => getCurrentSemester());
  const [courses, setCourses] = useState<Course[]>(DEMO_COURSES);
  const [users, setUsers] = useState<User[]>(SEED_USERS);
  const [activeTab, setActiveTab] = useState<"courses" | "users">("courses");

  /* ---- Course CRUD ---- */
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [memberCourseId, setMemberCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({ code: "", name: "" });

  const filteredCourses = useMemo(
    () => courses.filter((c) => c.semesterId === semester.id),
    [courses, semester.id],
  );

  const startCreateCourse = useCallback(() => {
    setCourseForm({ code: "", name: "" });
    setEditCourseId("__new__");
    setMemberCourseId(null);
  }, []);

  const startEditCourse = useCallback((c: Course) => {
    setCourseForm({ code: c.code, name: c.name });
    setEditCourseId(c.id);
    setMemberCourseId(null);
  }, []);

  const saveCourse = useCallback(() => {
    if (!courseForm.code.trim() || !courseForm.name.trim()) return;
    const now = new Date().toISOString();
    if (editCourseId === "__new__") {
      const newCourse: Course = {
        id: `course-${Date.now()}`,
        code: courseForm.code.trim(),
        name: courseForm.name.trim(),
        semesterId: semester.id,
        instructorIds: [],
        taIds: [],
        studentIds: [],
        createdAt: now,
        updatedAt: now,
      };
      setCourses((prev) => [...prev, newCourse]);
    } else {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === editCourseId
            ? { ...c, code: courseForm.code.trim(), name: courseForm.name.trim(), updatedAt: now }
            : c,
        ),
      );
    }
    setEditCourseId(null);
  }, [courseForm, editCourseId, semester.id]);

  const deleteCourse = useCallback((id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    if (memberCourseId === id) setMemberCourseId(null);
  }, [memberCourseId]);

  const saveMembers = useCallback(
    (courseId: string, instructorIds: string[], taIds: string[], studentIds: string[]) => {
      const now = new Date().toISOString();
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, instructorIds, taIds, studentIds, updatedAt: now } : c,
        ),
      );
      setMemberCourseId(null);
    },
    [],
  );

  /* ---- User role management ---- */
  const changeUserRole = useCallback((userId: string, newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    );
  }, []);

  return (
    <>
      <DashboardHeader />

      <div style={{ marginBottom: "var(--space-6)" }}>
        <SemesterSwitcher semesters={HKUST_SEMESTERS} current={semester} onChange={setSemester} />
      </div>

      {/* Tabs */}
      <div className="tab-list" role="tablist" style={{ marginBottom: "var(--space-6)" }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "courses"}
          className={`tab-button ${activeTab === "courses" ? "is-active" : ""}`}
          onClick={() => setActiveTab("courses")}
        >
          Courses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "users"}
          className={`tab-button ${activeTab === "users" ? "is-active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users &amp; Permissions
        </button>
      </div>

      {/* ---- Courses tab ---- */}
      {activeTab === "courses" && (
        <div className="section-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
            <h2 className="section-title" style={{ margin: 0, border: "none", paddingBottom: 0 }}>
              Courses – {semester.label}
            </h2>
            <button className="button" onClick={startCreateCourse}>
              + New Course
            </button>
          </div>

          {/* Inline editor */}
          {editCourseId && (
            <div className="panel" style={{ marginBottom: "var(--space-5)", display: "grid", gap: "var(--space-3)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>
                {editCourseId === "__new__" ? "Create Course" : "Edit Course"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto auto", gap: "var(--space-3)", alignItems: "end" }}>
                <label className="form-label">
                  Code
                  <input
                    className="input"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm((p) => ({ ...p, code: e.target.value }))}
                    placeholder="COMP3511"
                  />
                </label>
                <label className="form-label">
                  Name
                  <input
                    className="input"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Operating Systems"
                  />
                </label>
                <button className="button" onClick={saveCourse} style={{ alignSelf: "end" }}>Save</button>
                <button className="button-ghost" onClick={() => setEditCourseId(null)} style={{ alignSelf: "end" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Member assignment panel */}
          {memberCourseId && (() => {
            const mc = courses.find((c) => c.id === memberCourseId);
            return mc ? (
              <MemberAssignPanel
                course={mc}
                users={users}
                onSave={saveMembers}
                onClose={() => setMemberCourseId(null)}
              />
            ) : null;
          })()}

          {filteredCourses.length === 0 ? (
            <div className="empty-state">No courses for this semester.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Instructors</th>
                  <th>TAs</th>
                  <th>Students</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c) => (
                  <tr key={c.id} style={memberCourseId === c.id ? { background: "var(--surface-raised)" } : undefined}>
                    <td><strong>{c.code}</strong></td>
                    <td>{c.name}</td>
                    <td>{c.instructorIds.length}</td>
                    <td>{c.taIds.length}</td>
                    <td>{c.studentIds.length}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        <button
                          className="button-ghost"
                          onClick={() => { setMemberCourseId((prev) => prev === c.id ? null : c.id); setEditCourseId(null); }}
                          style={{ fontSize: "0.85rem" }}
                        >
                          {memberCourseId === c.id ? "Close Members" : "Manage Members"}
                        </button>
                        <button className="button-ghost" onClick={() => startEditCourse(c)} style={{ fontSize: "0.85rem" }}>Edit</button>
                        <button className="button-ghost" onClick={() => deleteCourse(c.id)} style={{ fontSize: "0.85rem", color: "var(--danger-text)" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ---- Users tab ---- */}
      {activeTab === "users" && (
        <div className="section-group">
          <h2 className="section-title">Users &amp; Role Management</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.firstName} {u.lastName}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "administrator" ? "badge-danger" : u.role === "instructor" ? "badge-info" : u.role === "teaching_assistant" ? "badge-warning" : "badge-success"}`}>
                      {ROLE_OPTIONS.find((r) => r.value === u.role)?.label}
                    </span>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={u.role}
                      onChange={(e) => changeUserRole(u.id, e.target.value as UserRole)}
                      style={{ width: "auto", minWidth: 160, fontSize: "0.85rem" }}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="administrator">
      <AdminDashboardContent />
    </AuthenticatedShell>
  );
}
