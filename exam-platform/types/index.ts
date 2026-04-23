/* ------------------------------------------------------------------ */
/*  HKUST CSE Exam Platform – Domain Types                            */
/* ------------------------------------------------------------------ */

/** User roles supported by the platform. */
export type UserRole = "student" | "instructor" | "teaching_assistant" | "administrator";

/** Convenience grouping: roles that can access the staff dashboard. */
export type StaffRole = "instructor" | "teaching_assistant";

/** Check helpers */
export function isStaffRole(role: UserRole): role is StaffRole {
  return role === "instructor" || role === "teaching_assistant";
}
export function isAdminRole(role: UserRole): role is "administrator" {
  return role === "administrator";
}

/** All proctoring event categories the engine can emit. */
export type ProctoringEventType =
  | "gaze_away"
  | "camera_blocked"
  | "multiple_faces"
  | "face_missing"
  | "camera_unavailable"
  | "tab_switch"
  | "window_exit"
  | "clipboard_paste"
  | "clipboard_copy"
  | "clipboard_cut"
  | "select_all"
  | "browser_shortcut"
  | "devtools_open";

/** Status of an exam from the student's perspective. */
export type ExamStatus = "current" | "upcoming" | "past";

/** Live session status for a student sitting an exam. */
export type SessionStatus = "active" | "warning" | "completed" | "terminated";

/** Live status labels shown on the student proctoring panel. */
export interface LiveProctoringStatus {
  gazeStatus: "normal" | "away";
  cameraStatus: "clear" | "blocked" | "unavailable";
  faceCount: number;
  screenStatus: "inactive" | "monitoring";
  focusStatus: "focused" | "background";
}

/* ------------------------------------------------------------------ */
/*  User / Auth                                                       */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  studentId?: string; // 8-digit ID starting with 2 for students
  avatarUrl?: string;
}

export interface DemoCredentials {
  email: string;
  password: string;
  user: User;
}

/* ------------------------------------------------------------------ */
/*  Exams                                                             */
/* ------------------------------------------------------------------ */

export interface Exam {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  date: string;        // ISO date string
  startTime: string;   // e.g. "14:00"
  durationSeconds: number;
  location: string;
  status: ExamStatus;
  studentCount?: number;
  semesterId?: string;
}

/* ------------------------------------------------------------------ */
/*  Proctoring Events & Buckets                                       */
/* ------------------------------------------------------------------ */

export interface ProctoringEvent {
  id: string;
  examId: string;
  studentId: string;
  type: ProctoringEventType;
  severity: number;   // 0–1
  timestamp: string;  // ISO string
  message: string;
  /** ISO string: when the episode (e.g. sustained gaze-away) started. */
  startedAt?: string;
  /** Duration of the episode in seconds. */
  durationSeconds?: number;
  evidenceClipUrl?: string;
  evidenceClipMimeType?: string;
  evidenceImageUrl?: string;
}

export interface ProctoringBucket {
  examId: string;
  studentId: string;
  windowStartedAt: string;
  windowEndedAt: string;
  suspiciousActivityAverage: number; // 0–100
  eventCounts: Record<ProctoringEventType, number>;
}

/* ------------------------------------------------------------------ */
/*  Risk & Session summaries                                          */
/* ------------------------------------------------------------------ */

export interface StudentRiskSummary {
  studentId: string;
  studentName: string;
  studentNumber: string;
  avatarUrl?: string;
  currentRiskScore: number; // 0–100
  lastUpdatedAt: string;
  highSeverityEventCount: number;
  buckets: ProctoringBucket[];
  events: ProctoringEvent[];
}

export interface CurrentExamSession {
  examId: string;
  studentId: string;
  startedAt: string;
  endsAt: string;
  durationSeconds: number;
  status: SessionStatus;
}

export interface LiveViolationLogEntry {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  timestamp: string;
  eventType: ProctoringEventType;
  message: string;
  runningRiskScore: number;
}

/* ------------------------------------------------------------------ */
/*  Module stubs for staff past-exam view                             */
/* ------------------------------------------------------------------ */

export type ModuleKey = "proctoring" | "grading" | "analytics";

export interface ExamModule {
  key: ModuleKey;
  label: string;
  enabled: boolean;
  description: string;
}

/* ------------------------------------------------------------------ */
/*  Exam Authoring – question types & definitions                     */
/* ------------------------------------------------------------------ */

export type QuestionType =
  | "mcq"
  | "short_answer"
  | "long_answer"
  | "essay"
  | "coding"
  | "mathematics";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
  essay: "Essay",
  coding: "Coding",
  mathematics: "Mathematics",
};

/** Rubric / marking scheme attached to a question. */
export interface QuestionRubric {
  /** Structured rubric text (e.g. markdown / plain text criteria). */
  text: string;
  /** Fully structured rubric with criteria and score bands. */
  structuredRubric?: StructuredRubric;
  /** Optional file attachment metadata for demo. */
  attachment?: {
    fileName: string;
    fileSize: number; // bytes
    mimeType: string;
  };
}

/** MCQ-specific option. */
export interface McqOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

/* ---- Base question fields ---------------------------------------- */

interface QuestionBase {
  id: string;
  /** 1-based display order. */
  order: number;
  title: string;
  prompt: string;
  points: number;
  required: boolean;
  rubric?: QuestionRubric;
  /** Topic / learning-outcome tags for analytics grouping. */
  topicIds?: string[];
}

/* ---- Per-type discriminated unions ------------------------------- */

export interface McqQuestion extends QuestionBase {
  type: "mcq";
  options: McqOption[];
  /** Whether multiple options can be selected. */
  allowMultiple: boolean;
}

export interface ShortAnswerQuestion extends QuestionBase {
  type: "short_answer";
  maxLength?: number;
  placeholder?: string;
}

export interface LongAnswerQuestion extends QuestionBase {
  type: "long_answer";
  expectedLengthHint?: string; // e.g. "200-400 words"
}

export interface EssayQuestion extends QuestionBase {
  type: "essay";
  expectedLengthHint?: string;
}

export interface CodingQuestion extends QuestionBase {
  type: "coding";
  language: string;       // e.g. "python", "java", "cpp"
  starterCode: string;
  constraints?: string;   // test-note placeholder
}

export interface MathQuestion extends QuestionBase {
  type: "mathematics";
  /** Hint about expected answer format (e.g. "numeric expression"). */
  answerFormatHint?: string;
}

export type ExamQuestion =
  | McqQuestion
  | ShortAnswerQuestion
  | LongAnswerQuestion
  | EssayQuestion
  | CodingQuestion
  | MathQuestion;

/* ------------------------------------------------------------------ */
/*  Exam Definition (staff authored)                                  */
/* ------------------------------------------------------------------ */

export interface ExamDefinition {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  date: string;
  startTime: string;
  durationSeconds: number;
  location: string;
  instructions: string;
  questions: ExamQuestion[];
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Student Exam Attempt & Responses                                  */
/* ------------------------------------------------------------------ */

export type QuestionStatus = "unanswered" | "answered" | "flagged";

export interface QuestionNavItem {
  questionId: string;
  order: number;
  status: QuestionStatus;
}

/** Per-question response from a student. */
export interface QuestionResponse {
  questionId: string;
  questionType: QuestionType;
  /** MCQ: selected option id(s). Text: string content. Coding: code string. */
  value: string | string[];
  answeredAt: string;
}

export type AttemptStatus = "in_progress" | "submitted" | "timed_out";

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  responses: QuestionResponse[];
  currentQuestionIndex: number;
  flaggedQuestionIds: string[];
}

/* ------------------------------------------------------------------ */
/*  HKUST Semesters                                                   */
/* ------------------------------------------------------------------ */

/**
 * HKUST academic calendar semesters:
 * - fall:   Sep 1 – Dec 31
 * - winter: Jan 1 – Jan 31
 * - spring: Feb 1 – May 31
 * - summer: Jun 1 – Aug 31
 */
export type SemesterTerm = "fall" | "winter" | "spring" | "summer";

export interface Semester {
  id: string;                // e.g. "2025-26-spring"
  label: string;             // e.g. "Spring 2025-26"
  term: SemesterTerm;
  academicYear: string;      // e.g. "2025-26"
  startDate: string;         // ISO date
  endDate: string;           // ISO date
}

export const SEMESTER_TERM_LABELS: Record<SemesterTerm, string> = {
  fall: "Fall",
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
};

/* ------------------------------------------------------------------ */
/*  Courses (admin-managed)                                           */
/* ------------------------------------------------------------------ */

export interface Course {
  id: string;
  code: string;             // e.g. "COMP3511"
  name: string;             // e.g. "Operating Systems"
  semesterId: string;       // links to Semester
  instructorIds: string[];  // User ids with instructor role
  taIds: string[];          // User ids with teaching_assistant role
  studentIds: string[];     // enrolled student User ids
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Permissions – per-role capability matrix                          */
/* ------------------------------------------------------------------ */

export type Permission =
  | "exam:create"
  | "exam:edit"
  | "exam:publish"
  | "exam:delete"
  | "exam:grade"
  | "exam:monitor"
  | "exam:take"
  | "exam:view_questions"
  | "course:create"
  | "course:edit"
  | "course:delete"
  | "user:manage_roles";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  administrator: [
    "course:create", "course:edit", "course:delete",
    "user:manage_roles",
  ],
  instructor: [
    "exam:create", "exam:edit", "exam:publish", "exam:delete",
    "exam:grade", "exam:monitor", "exam:view_questions",
    "course:edit",
  ],
  teaching_assistant: [
    "exam:grade", "exam:monitor", "exam:view_questions",
  ],
  student: [
    "exam:take",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/* ------------------------------------------------------------------ */
/*  Grading – Rubric, Results, Evidence                               */
/* ------------------------------------------------------------------ */

/** Grading lane used to grade a question. */
export type GradingLane = "incomplete" | "deterministic" | "cheap_llm" | "quality_llm" | "escalated";

/** Status of a single question grading job. */
export type QuestionGradingStatus =
  | "pending"
  | "grading"
  | "graded"
  | "escalated"
  | "reviewed"
  | "finalized";

/** Overall status of a grading run. */
export type GradingRunStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "reviewed";

/** A single rubric criterion with score bands. */
export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  maxPoints: number;
  scoreBands: RubricScoreBand[];
  /** Optional model answer to guide AI grading for this criterion. */
  modelAnswer?: string;
}

/** Score band within a rubric criterion. */
export interface RubricScoreBand {
  label: string;           // e.g. "Excellent", "Good", "Poor"
  minPoints: number;
  maxPoints: number;
  description: string;
}

/** Structured rubric for a question (parsed from text / generated). */
export interface StructuredRubric {
  questionId: string;
  criteria: RubricCriterion[];
  totalPoints: number;
  generatedBy?: string;     // model id if AI-generated
  version: number;
}

/** Evidence span highlighting a portion of the student answer. */
export interface EvidenceSpan {
  startIndex: number;
  endIndex: number;
  quote: string;
  criterionId: string;
  reason: string;
}

/** Grading result for one rubric criterion. */
export interface CriterionGradeResult {
  criterionId: string;
  criterionLabel: string;
  score: number;
  maxPoints: number;
  rationale: string;
  evidenceSpans: EvidenceSpan[];
  overrideScore?: number;
  reviewerRationale?: string;
}

export interface CriterionReviewOverride {
  criterionId: string;
  originalScore: number;
  overrideScore?: number;
  reasoning?: string;
}

/** Grading result for one question within an attempt. */
export interface QuestionGradeResult {
  questionId: string;
  questionType: QuestionType;
  status: QuestionGradingStatus;
  lane: GradingLane;
  model?: string;
  rawScore: number;
  maxPoints: number;
  normalizedScore: number;   // 0-1
  confidence: number;        // 0-1
  rationale: string;
  studentAnswer?: string;
  criterionResults: CriterionGradeResult[];
  evidenceSpans: EvidenceSpan[];
  escalationNotes?: string;
  latencyMs?: number;
  tokenUsage?: { prompt: number; completion: number };
}

/** Staff review decision for a graded question. */
export interface GradingReviewDecision {
  questionId: string;
  reviewerId: string;
  originalScore: number;
  overrideScore?: number;
  comment?: string;
  criteriaOverrides: CriterionReviewOverride[];
  accepted: boolean;
  reviewedAt: string;
}

/** A complete grading run for one student attempt. */
export interface GradingRun {
  id: string;
  examId: string;
  attemptId: string;
  studentId: string;
  status: GradingRunStatus;
  questionResults: QuestionGradeResult[];
  totalScore: number;
  maxTotalPoints: number;
  reviews: GradingReviewDecision[];
  startedAt: string;
  completedAt?: string;
  modelUsage: ModelUsageRecord[];
}

/** Tracks token/cost usage per model call. */
export interface ModelUsageRecord {
  model: string;
  questionId: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  cached: boolean;
}

/* ------------------------------------------------------------------ */
/*  Analytics – Domain Types                                          */
/* ------------------------------------------------------------------ */

/** Per-student record within an analytics snapshot. */
export interface StudentAnalyticsRecord {
  studentId: string;
  studentName: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionScores: Record<string, { score: number; maxPoints: number }>;
  topicScores: Record<string, { score: number; maxPoints: number }>;
  riskScore?: number;
  highSeverityEventCount?: number;
  proctoringEventCount?: number;
  reviewOverrideCount: number;
}

/** Per-question aggregated analytics. */
export interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  maxPoints: number;
  topicIds: string[];
  meanScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
  stdDev: number;
  /** Percentage of students scoring ≥70% on this question. */
  successRate: number;
  overrideCount: number;
  scoreDistribution: { label: string; count: number }[];
}

/** Per-topic aggregated analytics. */
export interface TopicAnalytics {
  topicId: string;
  topicLabel: string;
  questionCount: number;
  meanScore: number;
  maxPossible: number;
  percentage: number;
  weakestQuestionId?: string;
}

/** Exam-level analytics overview. */
export interface AnalyticsOverview {
  examId: string;
  studentCount: number;
  gradedCount: number;
  meanScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  stdDev: number;
  maxTotalPoints: number;
  meanPercentage: number;
  scoreDistribution: { label: string; count: number }[];
  passRate: number;
}

/** Full analytics snapshot for an exam. */
export interface ExamAnalyticsSnapshot {
  examId: string;
  courseCode: string;
  courseName: string;
  examTitle: string;
  generatedAt: string;
  overview: AnalyticsOverview;
  questions: QuestionAnalytics[];
  topics: TopicAnalytics[];
  students: StudentAnalyticsRecord[];
  aiSummary?: AnalyticsAISummary;
}

/** AI-generated analytics summary. */
export interface AnalyticsAISummary {
  commonMisconceptions: string[];
  recommendations: string[];
  confidence: "high" | "medium" | "low";
  generatedAt: string;
}

/** Chat message in analytics assistant. */
export interface AnalyticsChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
