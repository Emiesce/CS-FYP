"use client";

/* ------------------------------------------------------------------ */
/*  Floating role-switch + session-reset button (bottom-right)        */
/* ------------------------------------------------------------------ */

import { useSession } from "@/features/auth";
import { clearAllExamData } from "@/features/exams/exam-answer-store";
import { clearPersistedProctoringSessions } from "@/features/proctoring/live-session-store";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  instructor: "Instructor",
  teaching_assistant: "Teaching Assistant",
  administrator: "Administrator",
};

const ALL_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

export function RoleSwitchButton() {
  const { user } = useSession();
  if (!user) return null;

  const otherRoles = ALL_ROLES.filter((role) => role !== user.role);

  const handleReset = () => {
    clearAllExamData();
    clearPersistedProctoringSessions();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="floating-role-switch" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      {otherRoles.map((role) => (
        <button
          key={role}
          className="button-secondary"
          onClick={() => {
            window.open(`${window.location.origin}/login?auto=${role}`, "_blank");
          }}
          aria-label={`Open as ${ROLE_LABELS[role]}`}
          type="button"
        >
          Open as {ROLE_LABELS[role]}
        </button>
      ))}
      <button
        className="button-secondary"
        onClick={handleReset}
        type="button"
        style={{ background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-text)" }}
        aria-label="Reset session to start"
      >
        Reset Session
      </button>
    </div>
  );
}
