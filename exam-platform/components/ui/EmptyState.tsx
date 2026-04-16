/* ------------------------------------------------------------------ */
/*  EmptyState – dashed placeholder for no-content areas              */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon ? <p style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>{icon}</p> : null}
      <p className="helper-text">{message}</p>
    </div>
  );
}
