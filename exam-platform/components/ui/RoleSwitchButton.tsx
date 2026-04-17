"use client";

/* ------------------------------------------------------------------ */
/*  Floating role-switch + session-reset button (bottom-right)        */
/* ------------------------------------------------------------------ */

import { useSession } from "@/features/auth";
import { DEMO_CREDENTIALS } from "@/lib/fixtures/users";
import { clearAllExamData } from "@/features/exams/exam-answer-store";
import { clearPersistedProctoringSessions } from "@/features/proctoring/live-session-store";
import type { UserRole } from "@/types";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  instructor: "Instructor",
  teaching_assistant: "Teaching Assistant",
  administrator: "Administrator",
};

export function RoleSwitchButton() {
  const { user } = useSession();
  if (!user) return null;

  const otherCreds = DEMO_CREDENTIALS.filter((c) => c.user.role !== user.role);

  const handleReset = () => {
    clearAllExamData();
    clearPersistedProctoringSessions();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="floating-role-switch" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      {otherCreds.map((cred) => (
        <button
          key={cred.user.role}
          className="button-secondary"
          onClick={() => {
            window.open(`${window.location.origin}/login?auto=${cred.user.role}`, "_blank");
          }}
          aria-label={`Open as ${ROLE_LABELS[cred.user.role]}`}
          type="button"
        >
          Open as {ROLE_LABELS[cred.user.role]}
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
