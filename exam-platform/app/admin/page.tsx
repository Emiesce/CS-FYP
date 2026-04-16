/* app/admin/page.tsx – Server Component (no "use client") */
import { getCurrentSemester } from "@/lib/fixtures";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { AdminDashboardContent } from "./_content";

export default function AdminDashboardPage() {
  const initialSemesterId = getCurrentSemester().id;
  return (
    <AuthenticatedShell requiredRole="administrator">
      <AdminDashboardContent initialSemesterId={initialSemesterId} />
    </AuthenticatedShell>
  );
}
