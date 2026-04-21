import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { AdminDashboardContent } from "./_content";

export default function AdminDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="administrator">
      <AdminDashboardContent />
    </AuthenticatedShell>
  );
}
