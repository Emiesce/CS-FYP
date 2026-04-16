/* ------------------------------------------------------------------ */
/*  Student Dashboard – Server Component shell                       */
/* ------------------------------------------------------------------ */

import { getCurrentSemester } from "@/lib/fixtures";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StudentDashboardContent } from "./_content";

export default function StudentDashboardPage() {
  const initialSemesterId = getCurrentSemester().id;
  return (
    <AuthenticatedShell requiredRole="student">
      <StudentDashboardContent initialSemesterId={initialSemesterId} />
    </AuthenticatedShell>
  );
}
