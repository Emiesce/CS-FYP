"use client";

/* ------------------------------------------------------------------ */
/*  Administrator Dashboard – client content                         */
/*  Receives initialSemesterId from the Server Component (page.tsx)  */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader, SemesterSwitcher } from "@/components/dashboard";
import {
  createCourse,
  deleteCourse,
  getAdminBootstrap,
  updateCourse,
  updateCourseMembers,
  updateUserRole,
} from "@/features/catalog/catalog-service";
import type { Course, Semester, User, UserRole } from "@/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teaching_assistant", label: "Teaching Assistant" },
  { value: "instructor", label: "Instructor" },
  { value: "administrator", label: "Administrator" },
];

/* ------------------------------------------------------------------ */
/*  MemberGroup – checkbox list for a single role category           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  MemberAssignPanel                                                 */
/* ------------------------------------------------------------------ */

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
  const tas         = users.filter((u) => u.role === "teaching_assistant");
  const students    = users.filter((u) => u.role === "student");

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
        <MemberGroup label="Instructors"        candidates={instructors} selected={instructorIds} onToggle={(id) => toggle(instructorIds, setInstructorIds, id)} />
        <MemberGroup label="Teaching Assistants" candidates={tas}        selected={taIds}         onToggle={(id) => toggle(taIds, setTaIds, id)} />
        <MemberGroup label="Students"           candidates={students}   selected={studentIds}    onToggle={(id) => toggle(studentIds, setStudentIds, id)} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="button" onClick={() => onSave(course.id, instructorIds, taIds, studentIds)}>Save Members</button>
        <button className="button-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AdminDashboardContent                                             */
/* ------------------------------------------------------------------ */

export function AdminDashboardContent() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [courses, setCourses]     = useState<Course[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"courses" | "users">("courses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAdminBootstrap()
      .then((payload) => {
        if (cancelled) return;
        setSemesters(payload.semesters);
        setSemester(
          payload.semesters.find((item) => item.id === payload.currentSemesterId) ??
            payload.semesters[0] ??
            null,
        );
        setCourses(payload.courses);
        setUsers(payload.users);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load admin data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Course CRUD ---- */
  const [editCourseId,   setEditCourseId]   = useState<string | null>(null);
  const [memberCourseId, setMemberCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm]         = useState({ code: "", name: "" });

  const filteredCourses = useMemo(
    () => courses.filter((c) => !semester || c.semesterId === semester.id),
    [courses, semester],
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

  const saveCourse = useCallback(async () => {
    if (!courseForm.code.trim() || !courseForm.name.trim() || !semester) return;
    try {
      if (editCourseId === "__new__") {
        const created = await createCourse({
          code: courseForm.code.trim(),
          name: courseForm.name.trim(),
          semesterId: semester.id,
        });
        setCourses((prev) => [...prev, created]);
      } else if (editCourseId) {
        const updated = await updateCourse(editCourseId, {
          code: courseForm.code.trim(),
          name: courseForm.name.trim(),
          semesterId: semester.id,
        });
        setCourses((prev) => prev.map((course) => (course.id === updated.id ? updated : course)));
      }
      setEditCourseId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course.");
    }
  }, [courseForm, editCourseId, semester]);

  const handleDeleteCourse = useCallback(async (id: string) => {
    try {
      await deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      if (memberCourseId === id) setMemberCourseId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course.");
    }
  }, [memberCourseId]);

  const saveMembers = useCallback(
    async (courseId: string, instructorIds: string[], taIds: string[], studentIds: string[]) => {
      try {
        const updated = await updateCourseMembers(courseId, { instructorIds, taIds, studentIds });
        setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setMemberCourseId(null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update course members.");
      }
    },
    [],
  );

  /* ---- User role management ---- */
  const changeUserRole = useCallback(async (userId: string, newRole: UserRole) => {
    try {
      const updated = await updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role.");
    }
  }, []);

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
          <p className="helper-text" style={{ margin: 0 }}>Loading admin data...</p>
        </div>
      )}

      {error && (
        <div className="badge-danger" style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-4)" }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-list" role="tablist" style={{ marginBottom: "var(--space-6)" }}>
        <button type="button" role="tab" aria-selected={activeTab === "courses"} className={`tab-button ${activeTab === "courses" ? "is-active" : ""}`} onClick={() => setActiveTab("courses")}>
          Courses
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "users"} className={`tab-button ${activeTab === "users" ? "is-active" : ""}`} onClick={() => setActiveTab("users")}>
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
            <button className="button" onClick={startCreateCourse}>+ New Course</button>
          </div>

          {/* Inline create/edit editor */}
          {editCourseId && (
            <div className="panel" style={{ marginBottom: "var(--space-5)", display: "grid", gap: "var(--space-3)" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>
                {editCourseId === "__new__" ? "Create Course" : "Edit Course"}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto auto", gap: "var(--space-3)", alignItems: "end" }}>
                <label className="form-label">
                  Code
                  <input className="input" value={courseForm.code} onChange={(e) => setCourseForm((p) => ({ ...p, code: e.target.value }))} placeholder="COMP3511" />
                </label>
                <label className="form-label">
                  Name
                  <input className="input" value={courseForm.name} onChange={(e) => setCourseForm((p) => ({ ...p, name: e.target.value }))} placeholder="Operating Systems" />
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
              <MemberAssignPanel course={mc} users={users} onSave={saveMembers} onClose={() => setMemberCourseId(null)} />
            ) : null;
          })()}

          {filteredCourses.length === 0 ? (
            <div className="empty-state">No courses for this semester.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Instructors</th><th>TAs</th><th>Students</th>
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
                        <button className="button-ghost" style={{ fontSize: "0.85rem" }}
                          onClick={() => { setMemberCourseId((prev) => prev === c.id ? null : c.id); setEditCourseId(null); }}
                        >
                          {memberCourseId === c.id ? "Close Members" : "Manage Members"}
                        </button>
                        <button className="button-ghost" onClick={() => startEditCourse(c)} style={{ fontSize: "0.85rem" }}>Edit</button>
                        <button className="button-ghost" onClick={() => void handleDeleteCourse(c.id)} style={{ fontSize: "0.85rem", color: "var(--danger-text)" }}>Delete</button>
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
              <tr><th>Name</th><th>Email</th><th>Current Role</th><th>Change Role</th></tr>
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
                    <select className="select" value={u.role} onChange={(e) => changeUserRole(u.id, e.target.value as UserRole)} style={{ width: "auto", minWidth: 160, fontSize: "0.85rem" }}>
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
