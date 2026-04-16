/* ------------------------------------------------------------------ */
/*  Zod validation schemas – mirrors types/index.ts                   */
/* ------------------------------------------------------------------ */

import { z } from "zod";

export const UserRoleSchema = z.enum(["student", "teaching_staff"]);

export const ProctoringEventTypeSchema = z.enum([
  "gaze_away",
  "camera_blocked",
  "multiple_faces",
  "face_missing",
  "camera_unavailable",
]);

export const ExamStatusSchema = z.enum(["current", "upcoming", "past"]);
export const SessionStatusSchema = z.enum(["active", "warning", "completed", "terminated"]);

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: UserRoleSchema,
  studentId: z.string().regex(/^2\d{7}$/).optional(),
  avatarUrl: z.string().url().optional(),
});

export const ExamSchema = z.object({
  id: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  title: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  durationSeconds: z.number().int().positive(),
  location: z.string().min(1),
  status: ExamStatusSchema,
  studentCount: z.number().int().nonnegative().optional(),
});

export const ProctoringEventSchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  studentId: z.string().min(1),
  type: ProctoringEventTypeSchema,
  severity: z.number().min(0).max(1),
  timestamp: z.string(),
  message: z.string(),
  evidenceClipUrl: z.string().url().optional(),
});

export const ProctoringBucketSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  windowStartedAt: z.string(),
  windowEndedAt: z.string(),
  suspiciousActivityAverage: z.number().min(0).max(100),
  eventCounts: z.record(ProctoringEventTypeSchema, z.number().int().nonnegative()),
});

export const StudentRiskSummarySchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentNumber: z.string().regex(/^2\d{7}$/),
  avatarUrl: z.string().url().optional(),
  currentRiskScore: z.number().min(0).max(100),
  lastUpdatedAt: z.string(),
  highSeverityEventCount: z.number().int().nonnegative(),
  buckets: z.array(ProctoringBucketSchema),
  events: z.array(ProctoringEventSchema),
});

export const CurrentExamSessionSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  startedAt: z.string(),
  endsAt: z.string(),
  durationSeconds: z.number().int().positive(),
  status: SessionStatusSchema,
});

export const LiveViolationLogEntrySchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  studentId: z.string().min(1),
  studentName: z.string().min(1),
  studentNumber: z.string().min(1),
  timestamp: z.string(),
  eventType: ProctoringEventTypeSchema,
  message: z.string(),
  runningRiskScore: z.number().min(0).max(100),
});

export const LoginPayloadSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginPayload = z.infer<typeof LoginPayloadSchema>;

/* ------------------------------------------------------------------ */
/*  Exam authoring schemas                                            */
/* ------------------------------------------------------------------ */

export const QuestionTypeSchema = z.enum([
  "mcq",
  "short_answer",
  "long_answer",
  "essay",
  "coding",
  "mathematics",
]);

export const QuestionRubricSchema = z.object({
  text: z.string(),
  attachment: z
    .object({
      fileName: z.string().min(1),
      fileSize: z.number().int().nonnegative(),
      mimeType: z.string().min(1),
    })
    .optional(),
});

export const McqOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Option label is required."),
  isCorrect: z.boolean(),
});

const QuestionBaseSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1, "Question title is required."),
  prompt: z.string().min(1, "Question prompt is required."),
  points: z.number().min(0, "Points must be non-negative."),
  required: z.boolean(),
  rubric: QuestionRubricSchema.optional(),
});

export const McqQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("mcq"),
  options: z.array(McqOptionSchema).min(2, "At least 2 options are required."),
  allowMultiple: z.boolean(),
});

export const ShortAnswerQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("short_answer"),
  maxLength: z.number().int().positive().optional(),
  placeholder: z.string().optional(),
});

export const LongAnswerQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("long_answer"),
  expectedLengthHint: z.string().optional(),
});

export const EssayQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("essay"),
  expectedLengthHint: z.string().optional(),
});

export const CodingQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("coding"),
  language: z.string().min(1, "Programming language is required."),
  starterCode: z.string(),
  constraints: z.string().optional(),
});

export const MathQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("mathematics"),
  answerFormatHint: z.string().optional(),
});

export const ExamQuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  ShortAnswerQuestionSchema,
  LongAnswerQuestionSchema,
  EssayQuestionSchema,
  CodingQuestionSchema,
  MathQuestionSchema,
]);

export const ExamDefinitionSchema = z.object({
  id: z.string().min(1),
  courseCode: z.string().min(1),
  courseName: z.string().min(1),
  title: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  durationSeconds: z.number().int().positive(),
  location: z.string().min(1),
  instructions: z.string(),
  questions: z.array(ExamQuestionSchema),
  totalPoints: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/* ------------------------------------------------------------------ */
/*  Student attempt / response schemas                                */
/* ------------------------------------------------------------------ */

export const QuestionResponseSchema = z.object({
  questionId: z.string().min(1),
  questionType: QuestionTypeSchema,
  value: z.union([z.string(), z.array(z.string())]),
  answeredAt: z.string(),
});

export const AttemptStatusSchema = z.enum(["in_progress", "submitted", "timed_out"]);

export const ExamAttemptSchema = z.object({
  id: z.string().min(1),
  examId: z.string().min(1),
  studentId: z.string().min(1),
  status: AttemptStatusSchema,
  startedAt: z.string(),
  submittedAt: z.string().optional(),
  responses: z.array(QuestionResponseSchema),
  currentQuestionIndex: z.number().int().nonnegative(),
  flaggedQuestionIds: z.array(z.string()),
});
