/* ------------------------------------------------------------------ */
/*  StatusChip – coloured pill for risk levels, session status, etc.  */
/* ------------------------------------------------------------------ */

import { riskLevel } from "@/lib/utils/risk-score";

interface StatusChipProps {
  /** Risk score 0–100 OR explicit variant. */
  score?: number;
  variant?: "safe" | "warning" | "danger" | "info";
  label: string;
}

export function StatusChip({ score, variant, label }: StatusChipProps) {
  let cls: string;

  if (variant) {
    cls = `status-chip status-chip--${variant}`;
  } else if (score !== undefined) {
    const level = riskLevel(score);
    const map = { low: "safe", medium: "warning", high: "danger" } as const;
    cls = `status-chip status-chip--${map[level]}`;
  } else {
    cls = "status-chip status-chip--info";
  }

  return <span className={cls}>{label}</span>;
}
