/* ------------------------------------------------------------------ */
/*  Mock proctoring data – events, buckets, risk summaries            */
/* ------------------------------------------------------------------ */

import type {
  ProctoringEvent,
  ProctoringBucket,
  StudentRiskSummary,
  ProctoringEventType,
} from "@/types";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";

/* ------------------------------------------------------------------ */
/*  Helper to build ISO timestamps relative to a base                 */
/* ------------------------------------------------------------------ */
function ts(offsetSec: number, base = "2026-03-15T14:00:00.000Z"): string {
  return new Date(new Date(base).getTime() + offsetSec * 1000).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Past exam events for exam-past-001 (multiple students)            */
/* ------------------------------------------------------------------ */
const studentPool: { id: string; name: string; number: string; avatar?: string }[] = [
  { id: "stu-001", name: "Alex Chan", number: "20845671", avatar: "/avatars/student-01.jpg" },
  { id: "stu-002", name: "Bella Li", number: "20734582", avatar: "/avatars/student-02.jpg" },
  { id: "stu-003", name: "Charlie Ng", number: "20956723", avatar: "/avatars/student-03.jpg" },
  { id: "stu-004", name: "Diana Wu", number: "20123456", avatar: "/avatars/student-04.jpg" },
  { id: "stu-005", name: "Ethan Ho", number: "20867432", avatar: "/avatars/student-05.jpg" },
];

function makeEvent(
  idx: number,
  examId: string,
  studentId: string,
  type: ProctoringEventType,
  severity: number,
  offsetSec: number,
  message: string,
  clip?: string,
): ProctoringEvent {
  return {
    id: `evt-${examId}-${idx.toString().padStart(3, "0")}`,
    examId,
    studentId,
    type,
    severity,
    timestamp: ts(offsetSec),
    message,
    evidenceClipUrl: clip,
  };
}

export const PAST_EXAM_EVENTS: ProctoringEvent[] = [
  // Student 001 – moderate risk
  makeEvent(1, "exam-past-001", "stu-001", "gaze_away", 0.6, 120, "Looked away from screen for 4 seconds"),
  makeEvent(2, "exam-past-001", "stu-001", "tab_switch", 0.65, 340, "Exam tab was hidden during the session"),
  makeEvent(3, "exam-past-001", "stu-001", "face_missing", 0.5, 780, "Face not detected for 3 seconds"),
  // Student 002 – high risk
  makeEvent(4, "exam-past-001", "stu-002", "multiple_faces", 0.9, 200, "Two faces detected in frame"),
  makeEvent(5, "exam-past-001", "stu-002", "camera_blocked", 0.85, 450, "Camera obstructed for 8 seconds"),
  makeEvent(6, "exam-past-001", "stu-002", "gaze_away", 0.7, 600, "Extended gaze deviation detected"),
  makeEvent(7, "exam-past-001", "stu-002", "multiple_faces", 0.8, 900, "Second person visible in background"),
  // Student 003 – low risk
  makeEvent(8, "exam-past-001", "stu-003", "gaze_away", 0.3, 500, "Momentary gaze shift"),
  // Student 004 – medium risk
  makeEvent(9, "exam-past-001", "stu-004", "camera_blocked", 0.6, 300, "Partial camera obstruction detected"),
  makeEvent(10, "exam-past-001", "stu-004", "face_missing", 0.7, 700, "Face not detected for 5 seconds"),
  makeEvent(11, "exam-past-001", "stu-004", "gaze_away", 0.5, 1100, "Looked away from screen"),
  // Student 005 – zero risk (no events)
];

/* ------------------------------------------------------------------ */
/*  Build buckets for past exam                                       */
/* ------------------------------------------------------------------ */
function buildBuckets(examId: string, studentId: string, events: ProctoringEvent[]): ProctoringBucket[] {
  const studentEvents = events.filter((e) => e.studentId === studentId && e.examId === examId);
  const WINDOW = 10; // 10-second windows
  const totalDuration = 1800; // 30 min exam
  const buckets: ProctoringBucket[] = [];

  for (let start = 0; start < totalDuration; start += WINDOW) {
    const windowStart = ts(start);
    const windowEnd = ts(start + WINDOW);
    const windowEvents = studentEvents.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= new Date(windowStart).getTime() && t < new Date(windowEnd).getTime();
    });

    const counts: Record<ProctoringEventType, number> = {
      gaze_away: 0,
      camera_blocked: 0,
      multiple_faces: 0,
      face_missing: 0,
      camera_unavailable: 0,
      tab_switch: 0,
      window_exit: 0,
      clipboard_paste: 0,
      clipboard_copy: 0,
      clipboard_cut: 0,
      select_all: 0,
      browser_shortcut: 0,
      devtools_open: 0,
    };
    for (const ev of windowEvents) {
      counts[ev.type]++;
    }

    buckets.push({
      examId,
      studentId,
      windowStartedAt: windowStart,
      windowEndedAt: windowEnd,
      suspiciousActivityAverage: windowEvents.length > 0 ? computeRiskScore(windowEvents) : 0,
      eventCounts: counts,
    });
  }

  return buckets;
}

/* ------------------------------------------------------------------ */
/*  Student risk summaries for past exam                              */
/* ------------------------------------------------------------------ */
export const PAST_EXAM_RISK_SUMMARIES: StudentRiskSummary[] = studentPool.map((stu) => {
  const events = PAST_EXAM_EVENTS.filter(
    (e) => e.studentId === stu.id && e.examId === "exam-past-001",
  );
  return {
    studentId: stu.id,
    studentName: stu.name,
    studentNumber: stu.number,
    avatarUrl: stu.avatar,
    currentRiskScore: computeRiskScore(events),
    lastUpdatedAt: events.length > 0 ? events[events.length - 1].timestamp : ts(0),
    highSeverityEventCount: countHighSeverityEvents(events),
    buckets: buildBuckets("exam-past-001", stu.id, PAST_EXAM_EVENTS),
    events,
  };
});
