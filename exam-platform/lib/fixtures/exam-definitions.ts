/* ------------------------------------------------------------------ */
/*  Shared exam-definition resolver for grading/test flows            */
/* ------------------------------------------------------------------ */

import type { ExamDefinition } from "@/types";
import { DEMO_EXAM_DEFINITION } from "./exams";
import { COMP1023_EXAM_DEFINITION } from "./comp1023";
import { MGMT2110_EXAM_DEFINITION } from "./mgmt2110";

export function getExamDefinitionById(examId: string): ExamDefinition | null {
  if (examId === COMP1023_EXAM_DEFINITION.id) {
    return COMP1023_EXAM_DEFINITION;
  }

  if (examId === MGMT2110_EXAM_DEFINITION.id) {
    return MGMT2110_EXAM_DEFINITION;
  }

  if (examId === DEMO_EXAM_DEFINITION.id) {
    return DEMO_EXAM_DEFINITION;
  }

  return null;
}
