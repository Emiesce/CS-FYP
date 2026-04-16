"use client";

/* ------------------------------------------------------------------ */
/*  AuthenticatedShell – wraps all role-aware pages with session       */
/*  provider, role guard, and floating role-switch button.             */
/* ------------------------------------------------------------------ */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider, useSession, dashboardPath } from "@/features/auth";
import { clearPersistedProctoringSessions } from "@/features/proctoring/live-session-store";
import { RoleSwitchButton } from "@/components/ui";
import { isStaffRole } from "@/types";
import type { UserRole } from "@/types";

/** Roles accepted by AuthenticatedShell. "staff" matches both instructor & TA. */
type AcceptedRole = UserRole | "staff";

interface AuthGuardProps {
  requiredRole: AcceptedRole;
  children: React.ReactNode;
}

function roleMatches(userRole: UserRole, required: AcceptedRole): boolean {
  if (required === "staff") return isStaffRole(userRole);
  return userRole === required;
}

function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const { isAuthenticated, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user && !roleMatches(user.role, requiredRole)) {
      router.replace(dashboardPath(user.role));
    }
  }, [isAuthenticated, user, requiredRole, router]);

  if (!isAuthenticated || !user || !roleMatches(user.role, requiredRole)) return null;

  return <>{children}</>;
}

export function AuthenticatedShell({
  requiredRole,
  children,
}: {
  requiredRole: AcceptedRole;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearPersistedProctoringSessions();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <SessionProvider>
      <AuthGuard requiredRole={requiredRole}>
        <main className="container page-shell">{children}</main>
        <RoleSwitchButton />
      </AuthGuard>
    </SessionProvider>
  );
}
