import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StaffDashboardContent } from "./_content";

export default function StaffDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="staff">
      <StaffDashboardContent />
    </AuthenticatedShell>
  );
}

