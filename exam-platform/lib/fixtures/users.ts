/* ------------------------------------------------------------------ */
/*  Demo credentials & users                                          */
/* ------------------------------------------------------------------ */

import type { DemoCredentials, User } from "@/types";

export const DEMO_STUDENT: User = {
  id: "stu-001",
  email: "student@ust.hl",
  firstName: "Alex",
  lastName: "Chan",
  role: "student",
  studentId: "20845671",
  avatarUrl: "/avatars/student-01.jpg",
};

export const DEMO_STAFF: User = {
  id: "staff-001",
  email: "teach@ust.hk",
  firstName: "Dr. Wong",
  lastName: "Mei Ling",
  role: "teaching_staff",
};

export const DEMO_CREDENTIALS: DemoCredentials[] = [
  { email: "student@ust.hl", password: "student123", user: DEMO_STUDENT },
  { email: "teach@ust.hk", password: "teaching123", user: DEMO_STAFF },
];
