"use client";

/* ------------------------------------------------------------------ */
/*  SemesterSwitcher – dropdown to pick the active semester           */
/* ------------------------------------------------------------------ */

import type { Semester } from "@/types";

interface SemesterSwitcherProps {
  semesters: Semester[];
  current: Semester;
  onChange: (semester: Semester) => void;
}

export function SemesterSwitcher({ semesters, current, onChange }: SemesterSwitcherProps) {
  return (
    <div className="semester-switcher">
      <label htmlFor="semester-select" className="semester-switcher__label">
        Semester
      </label>
      <select
        id="semester-select"
        className="select semester-switcher__select"
        value={current.id}
        onChange={(e) => {
          const sem = semesters.find((s) => s.id === e.target.value);
          if (sem) onChange(sem);
        }}
      >
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
