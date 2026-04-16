import type { Course } from "@/types";

/* ------------------------------------------------------------------ */
/*  Demo courses – shared across admin and staff views                */
/* ------------------------------------------------------------------ */

export const DEMO_COURSES: Course[] = [
  {
    id: "course-001",
    code: "COMP3511",
    name: "Operating Systems",
    semesterId: "2025-26-spring",
    instructorIds: ["staff-001"],
    taIds: ["staff-002"],
    studentIds: ["stu-001"],
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "course-002",
    code: "COMP4321",
    name: "Search Engines",
    semesterId: "2025-26-spring",
    instructorIds: ["staff-001"],
    taIds: [],
    studentIds: ["stu-001"],
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "course-003",
    code: "COMP2012",
    name: "OOP & Data Structures",
    semesterId: "2025-26-spring",
    instructorIds: [],
    taIds: ["staff-002"],
    studentIds: ["stu-001"],
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
];
