"use client";

/* ------------------------------------------------------------------ */
/*  StudentRoster – searchable list of students for staff review      */
/* ------------------------------------------------------------------ */

import { useState, useMemo } from "react";
import type { StudentRiskSummary } from "@/types";
import { RiskBadge } from "@/components/ui";

interface StudentRosterProps {
  students: StudentRiskSummary[];
  onSelect: (studentId: string) => void;
  selectedStudentId?: string;
}

type SortField = "name" | "risk";

export function StudentRoster({ students, onSelect, selectedStudentId }: StudentRosterProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("risk");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? students.filter(
          (s) =>
            s.studentName.toLowerCase().includes(q) ||
            s.studentNumber.includes(q),
        )
      : students;

    return [...list].sort((a, b) => {
      if (sortBy === "risk") return b.currentRiskScore - a.currentRiskScore;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [students, search, sortBy]);

  return (
    <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
      <h3 style={{ margin: 0, fontSize: "1rem" }}>Student Roster</h3>

      {/* Search & Sort */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <input
          className="input"
          type="search"
          placeholder="Search by name or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search students"
          style={{ flex: 1, minWidth: "180px" }}
        />
        <select
          className="select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortField)}
          aria-label="Sort students by"
          style={{ width: "auto" }}
        >
          <option value="risk">Sort by Risk Score</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* List */}
      <div className="list-stack" role="listbox" aria-label="Student list">
        {filtered.length === 0 ? (
          <p className="helper-text">No students match your search.</p>
        ) : (
          filtered.map((s) => (
            <button
              key={s.studentId}
              type="button"
              className="student-row"
              onClick={() => onSelect(s.studentId)}
              aria-selected={s.studentId === selectedStudentId}
              role="option"
              style={{
                cursor: "pointer",
                outline: s.studentId === selectedStudentId ? "3px solid var(--ring)" : "none",
                textAlign: "left",
              }}
            >
              <div className="avatar">
                {s.avatarUrl ? (
                  <img src={s.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "100%",
                      fontSize: "1.2rem",
                    }}
                  >
                    {s.studentName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="student-meta">
                <span className="student-name">{s.studentName}</span>
                <span className="student-id">{s.studentNumber}</span>
              </div>
              <RiskBadge score={s.currentRiskScore} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
