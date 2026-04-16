/* ------------------------------------------------------------------ */
/*  Demo credentials & users                                          */
/* ------------------------------------------------------------------ */

import type { DemoCredentials, User } from "@/types";

export const DEMO_STUDENT: User = {
  id: "stu-001",
  email: "student@ust.hk",
  firstName: "Alex",
  lastName: "Chan",
  role: "student",
  studentId: "20845671",
  avatarUrl: "/avatars/student-01.jpg",
};

export const DEMO_INSTRUCTOR: User = {
  id: "staff-001",
  email: "instructor@ust.hk",
  firstName: "Dr. Wong",
  lastName: "Mei Ling",
  role: "instructor",
};

export const DEMO_TA: User = {
  id: "staff-002",
  email: "ta@ust.hk",
  firstName: "Kevin",
  lastName: "Lau",
  role: "teaching_assistant",
};

export const DEMO_ADMIN: User = {
  id: "admin-001",
  email: "admin@ust.hk",
  firstName: "System",
  lastName: "Administrator",
  role: "administrator",
};

/** @deprecated – kept for backward compatibility */
export const DEMO_STAFF = DEMO_INSTRUCTOR;

export const DEMO_CREDENTIALS: DemoCredentials[] = [
  { email: "student@ust.hk",    password: "student123",    user: DEMO_STUDENT },
  { email: "instructor@ust.hk", password: "instructor123", user: DEMO_INSTRUCTOR },
  { email: "ta@ust.hk",         password: "ta123",         user: DEMO_TA },
  { email: "admin@ust.hk",      password: "admin123",      user: DEMO_ADMIN },
];
