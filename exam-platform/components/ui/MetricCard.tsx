/* ------------------------------------------------------------------ */
/*  MetricCard – single KPI display                                   */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  label: string;
  value: string | number;
  className?: string;
}

export function MetricCard({ label, value, className = "" }: MetricCardProps) {
  return (
    <div className={`card metric-card ${className}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
