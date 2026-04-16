/* ------------------------------------------------------------------ */
/*  HKUST Semester fixtures                                           */
/*                                                                    */
/*  HKUST academic year: Sep → Aug                                    */
/*   Fall:   Sep 1 – Dec 31                                           */
/*   Winter: Jan 1 – Jan 31                                           */
/*   Spring: Feb 1 – May 31                                           */
/*   Summer: Jun 1 – Aug 31                                           */
/* ------------------------------------------------------------------ */

import type { Semester } from "@/types";

export const HKUST_SEMESTERS: Semester[] = [
  // 2025-26
  {
    id: "2025-26-fall",
    label: "Fall 2025-26",
    term: "fall",
    academicYear: "2025-26",
    startDate: "2025-09-01",
    endDate: "2025-12-31",
  },
  {
    id: "2025-26-winter",
    label: "Winter 2025-26",
    term: "winter",
    academicYear: "2025-26",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  },
  {
    id: "2025-26-spring",
    label: "Spring 2025-26",
    term: "spring",
    academicYear: "2025-26",
    startDate: "2026-02-01",
    endDate: "2026-05-31",
  },
  {
    id: "2025-26-summer",
    label: "Summer 2025-26",
    term: "summer",
    academicYear: "2025-26",
    startDate: "2026-06-01",
    endDate: "2026-08-31",
  },
  // 2026-27
  {
    id: "2026-27-fall",
    label: "Fall 2026-27",
    term: "fall",
    academicYear: "2026-27",
    startDate: "2026-09-01",
    endDate: "2026-12-31",
  },
];

/**
 * Return the semester whose date range contains `today`, or the most
 * recent one if today falls between semesters.
 */
export function getCurrentSemester(today = new Date()): Semester {
  const iso = today.toISOString().slice(0, 10);
  const current = HKUST_SEMESTERS.find(
    (s) => iso >= s.startDate && iso <= s.endDate,
  );
  if (current) return current;

  // Fallback: closest past semester
  const past = HKUST_SEMESTERS
    .filter((s) => s.endDate < iso)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  return past[0] ?? HKUST_SEMESTERS[0];
}
