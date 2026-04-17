/* ------------------------------------------------------------------ */
/*  MGMT2110 Essay Grading Test Fixture                               */
/* ------------------------------------------------------------------ */

import type { Exam, ExamDefinition, QuestionResponse } from "@/types";
import type { ExamSubmissionStatus } from "@/features/exams/exam-answer-store";
import mgmtAnswers from "../../mgmtAns.json";

interface MgmtAnswerRecord {
  studentId: string;
  studentName: string;
  answers: Array<{
    questionId: string;
    answerText: string;
  }>;
}

export const MGMT2110_EXAM_ID = "mgmt2110-ob-essay-test-s26";

export const MGMT2110_EXAM: Exam = {
  id: MGMT2110_EXAM_ID,
  courseCode: "MGMT2110",
  courseName: "Organizationl Behaviour",
  title: "Essay Grading Test Module",
  date: "2026-04-17",
  startTime: "12:00",
  durationSeconds: 5400,
  location: "Take-home Dataset",
  status: "past",
  studentCount: mgmtAnswers.length,
  semesterId: "2025-26-spring",
};

const RUBRIC_TEXT = [
  "Criteria:",
  "1. Explain planning fallacy using the Inside-Outside Model.",
  "2. Explain planning fallacy using bias and attribution.",
  "3. Explain planning fallacy using motivated reasoning.",
  "4. Support the answer with evidence, examples, and application.",
].join("\n");

const ESSAY_PROMPT =
  "Explain the psychology factor of planning fallacy. Discuss the Inside-Outside Model, relevant biases and attribution, motivated reasoning, and support your explanation with examples or evidence.";

export const MGMT2110_EXAM_DEFINITION: ExamDefinition = {
  id: MGMT2110_EXAM_ID,
  courseCode: "MGMT2110",
  courseName: "Organizationl Behaviour",
  title: "Essay Grading Test Module",
  date: "2026-04-17",
  startTime: "12:00",
  durationSeconds: 5400,
  location: "Take-home Dataset",
  instructions:
    "The exam has already been completed. Use this dataset to test the essay-grading architecture on a single long-form management answer.",
  totalPoints: 20,
  createdAt: "2026-04-17T04:00:00Z",
  updatedAt: "2026-04-17T04:00:00Z",
  questions: [
    {
      id: "q1",
      order: 1,
      type: "essay",
      title: "Explain the psychology factor of planning fallacy",
      prompt: ESSAY_PROMPT,
      points: 20,
      required: true,
      expectedLengthHint: "400-700 words",
      rubric: {
        text: RUBRIC_TEXT,
      },
    },
  ],
};

function buildResponse(answerText: string): QuestionResponse {
  return {
    questionId: "q1",
    questionType: "essay",
    value: answerText,
    answeredAt: "2026-04-17T04:00:00Z",
  };
}

export const MGMT2110_SEEDED_SUBMISSIONS: ExamSubmissionStatus[] = (
  mgmtAnswers as MgmtAnswerRecord[]
).map((record, index) => {
  const submittedAt = new Date(
    Date.UTC(2026, 3, 17, 4, 0 + index, 0),
  ).toISOString();

  return {
    examId: MGMT2110_EXAM_ID,
    studentId: record.studentId,
    studentName: record.studentName,
    submittedAt,
    responses: record.answers.map((answer) => buildResponse(answer.answerText)),
  };
});
