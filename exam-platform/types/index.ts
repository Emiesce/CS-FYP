/* ------------------------------------------------------------------ */
/*  HKUST CSE Exam Platform – Domain Types                            */
/* ------------------------------------------------------------------ */

/** User roles supported by the MVP. */
export type UserRole = "student" | "teaching_staff";

/** All proctoring event categories the engine can emit. */
export type ProctoringEventType =
  | "gaze_away"
  | "camera_blocked"
  | "multiple_faces"
  | "face_missing"
  | "camera_unavailable"
  | "tab_switch"
  | "window_exit";

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
