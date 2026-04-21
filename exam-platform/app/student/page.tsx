import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { StudentDashboardContent } from "./_content";

export default function StudentDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <StudentDashboardContent />
    </AuthenticatedShell>
  );
}
