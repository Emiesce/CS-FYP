"use client";

/* ------------------------------------------------------------------ */
/*  Floating role-switch button (bottom-right)                        */
/* ------------------------------------------------------------------ */

import { useSession, oppositeRole } from "@/features/auth";
import { DEMO_CREDENTIALS } from "@/lib/fixtures/users";

export function RoleSwitchButton() {
  const { user } = useSession();
  if (!user) return null;

  const target = oppositeRole(user.role);
  const targetLabel = target === "student" ? "Student" : "Teaching Staff";
  const targetCreds = DEMO_CREDENTIALS.find((c) => c.user.role === target);

  const handleClick = () => {
    // Open the opposite role in a new tab with auto-login via query param
    if (targetCreds) {
      const url = `${window.location.origin}/login?auto=${target}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="floating-role-switch">
      <button
        className="button-secondary"
        onClick={handleClick}
        aria-label={`Switch to ${targetLabel} view`}
        type="button"
      >
        Open as {targetLabel}
      </button>
    </div>
  );
}
