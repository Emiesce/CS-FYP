/* ------------------------------------------------------------------ */
/*  Staff Dashboard – Server Component shell                         */
/*  Calls getCurrentSemester() once on the server and passes the     */
/*  resulting ID as a plain string prop to the client content.       */
/*  This guarantees server HTML == client hydration: no mismatch.    */
/* ------------------------------------------------------------------ */

import { getCurrentSemester } from "@/lib/fixtures";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StaffDashboardContent } from "./_content";

export default function StaffDashboardPage() {
  const initialSemesterId = getCurrentSemester().id;
  return (
    <AuthenticatedShell requiredRole="staff">
      <StaffDashboardContent initialSemesterId={initialSemesterId} />
    </AuthenticatedShell>
  );
}

