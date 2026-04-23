"use client";

import { BACKEND_API_BASE } from "@/lib/constants";
import { getSessionToken } from "@/features/auth";
import { apiFetch } from "@/lib/utils/api-fetch";
import type { Course, Exam, Semester, User, UserRole } from "@/types";

interface BackendSemester {
  id: string;
  label: string;
  term: Semester["term"];
  academic_year: string;
  start_date: string;
  end_date: string;
}

interface BackendExam {
  id: string;
  course_code: string;
  course_name: string;
  title: string;
  date: string;
  start_time: string;
  duration_seconds: number;
  location: string;
  status: Exam["status"];
  semester_id: string;
  student_count: number;
}

interface BackendCourse {
  id: string;
  code: string;
  name: string;
  semester_id: string;
  instructor_ids: string[];
  ta_ids: string[];
  student_ids: string[];
  created_at: string;
  updated_at: string;
}

interface BackendUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  student_number?: string | null;
  avatar_url?: string | null;
}

interface DashboardCatalogResponse {
  current_semester_id: string;
  semesters: BackendSemester[];
  exams: BackendExam[];
}

interface CurrentExamResponse {
  exam: BackendExam | null;
}

interface AdminBootstrapResponse {
  current_semester_id: string;
  semesters: BackendSemester[];
  courses: BackendCourse[];
  users: BackendUser[];
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getSessionToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`${BACKEND_API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: authHeaders(init?.headers),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function normalizeSemester(raw: BackendSemester): Semester {
  return {
    id: raw.id,
    label: raw.label,
    term: raw.term,
    academicYear: raw.academic_year,
    startDate: raw.start_date,
    endDate: raw.end_date,
  };
}

function normalizeExam(raw: BackendExam): Exam {
  return {
    id: raw.id,
    courseCode: raw.course_code,
    courseName: raw.course_name,
    title: raw.title,
    date: raw.date,
    startTime: raw.start_time,
    durationSeconds: raw.duration_seconds,
    location: raw.location,
    status: raw.status,
    studentCount: raw.student_count,
    semesterId: raw.semester_id,
  };
}

function normalizeCourse(raw: BackendCourse): Course {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    semesterId: raw.semester_id,
    instructorIds: raw.instructor_ids,
    taIds: raw.ta_ids,
    studentIds: raw.student_ids,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function normalizeUser(raw: BackendUser): User {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name,
    lastName: raw.last_name,
    role: raw.role,
    studentId: raw.student_number ?? undefined,
    avatarUrl: raw.avatar_url ?? undefined,
  };
}

export async function getDashboardCatalog(): Promise<{
  currentSemesterId: string;
  semesters: Semester[];
  exams: Exam[];
}> {
  const payload = await apiJson<DashboardCatalogResponse>("/api/catalog/dashboard");
  return {
    currentSemesterId: payload.current_semester_id,
    semesters: payload.semesters.map(normalizeSemester),
    exams: payload.exams.map(normalizeExam),
  };
}

export async function getCurrentExam(): Promise<Exam | null> {
  const payload = await apiJson<CurrentExamResponse>("/api/catalog/current-exam");
  return payload.exam ? normalizeExam(payload.exam) : null;
}

export async function getVisibleCourses(semesterId?: string, scope: "visible" | "all" = "visible"): Promise<Course[]> {
  const query = new URLSearchParams();
  query.set("scope", scope);
  if (semesterId) query.set("semester_id", semesterId);
  const payload = await apiJson<BackendCourse[]>(`/api/catalog/courses?${query.toString()}`);
  return payload.map(normalizeCourse);
}

export async function getAdminBootstrap(): Promise<{
  currentSemesterId: string;
  semesters: Semester[];
  courses: Course[];
  users: User[];
}> {
  const payload = await apiJson<AdminBootstrapResponse>("/api/catalog/admin/bootstrap");
  return {
    currentSemesterId: payload.current_semester_id,
    semesters: payload.semesters.map(normalizeSemester),
    courses: payload.courses.map(normalizeCourse),
    users: payload.users.map(normalizeUser),
  };
}

export async function createCourse(input: {
  code: string;
  name: string;
  semesterId: string;
}): Promise<Course> {
  const payload = await apiJson<BackendCourse>("/api/catalog/admin/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      name: input.name,
      semester_id: input.semesterId,
    }),
  });
  return normalizeCourse(payload);
}

export async function updateCourse(courseId: string, input: {
  code: string;
  name: string;
  semesterId: string;
}): Promise<Course> {
  const payload = await apiJson<BackendCourse>(`/api/catalog/admin/courses/${encodeURIComponent(courseId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      name: input.name,
      semester_id: input.semesterId,
    }),
  });
  return normalizeCourse(payload);
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiJson(`/api/catalog/admin/courses/${encodeURIComponent(courseId)}`, {
    method: "DELETE",
  });
}

export async function updateCourseMembers(
  courseId: string,
  input: { instructorIds: string[]; taIds: string[]; studentIds: string[] },
): Promise<Course> {
  const payload = await apiJson<BackendCourse>(`/api/catalog/admin/courses/${encodeURIComponent(courseId)}/members`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructor_ids: input.instructorIds,
      ta_ids: input.taIds,
      student_ids: input.studentIds,
    }),
  });
  return normalizeCourse(payload);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  const payload = await apiJson<BackendUser>(`/api/catalog/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return normalizeUser(payload);
}
