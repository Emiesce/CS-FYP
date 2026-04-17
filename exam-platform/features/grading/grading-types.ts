/* ------------------------------------------------------------------ */
/*  Grading feature – TypeScript types                                */
/*  Re-exports from types/index.ts + feature-specific helpers         */
/* ------------------------------------------------------------------ */

export type {
  GradingLane,
  QuestionGradingStatus,
  GradingRunStatus,
  RubricCriterion,
  RubricScoreBand,
  StructuredRubric,
  EvidenceSpan,
  CriterionGradeResult,
  CriterionReviewOverride,
  QuestionGradeResult,
  GradingReviewDecision,
  GradingRun,
  ModelUsageRecord,
} from "@/types";

/** Payload for triggering a grading run. */
export interface GradingRunRequest {
  attemptId: string;
  studentId: string;
  rubrics?: Record<string, import("@/types").StructuredRubric>;
  mode?: "low_cost" | "balanced" | "quality_first";
}

/** Payload for submitting a review override. */
export interface ReviewSubmitPayload {
  questionId: string;
  overrideScore?: number;
  comment?: string;
  criteriaOverrides?: Array<{
    criterionId: string;
    overrideScore?: number;
    reasoning?: string;
  }>;
  accepted: boolean;
}

/** Payload for rubric generation. */
export interface RubricGeneratePayload {
  examId: string;
  questionId: string;
  questionPrompt: string;
  questionType: string;
  points: number;
  instructorNotes?: string;
  supportFileText?: string;
}
