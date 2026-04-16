/* ------------------------------------------------------------------ */
/*  RiskBadge – displays a 0–100 score with colour coding             */
/* ------------------------------------------------------------------ */

import { riskClassName } from "@/lib/utils/risk-score";

interface RiskBadgeProps {
  score: number;
}

export function RiskBadge({ score }: RiskBadgeProps) {
  return <span className={`risk-score ${riskClassName(score)}`}>{score}</span>;
}
