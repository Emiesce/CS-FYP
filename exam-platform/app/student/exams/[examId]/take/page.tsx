"use client";

/* ------------------------------------------------------------------ */
/*  COMP1023 Exam-taking Page – student takes the exam with proctoring */
/* ------------------------------------------------------------------ */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ExamWorkspaceShell } from "@/components/exam-workspace";
import { useSession } from "@/features/auth/session-store";
import { COMP1023_EXAM, COMP1023_EXAM_DEFINITION, COMP1023_EXAM_ID } from "@/lib/fixtures/comp1023";
import { ALL_EXAMS } from "@/lib/fixtures";
import {
  saveDraftAnswers,
  loadDraftAnswers,
  submitExamAnswers,
  isExamSubmitted,
} from "@/features/exams/exam-answer-store";
import {
  saveCompletedSession,
  saveLiveSession,
} from "@/features/proctoring/live-session-store";
import type { PersistedProctoringSession } from "@/features/proctoring/live-session-store";
import { useProctoringSession } from "@/features/proctoring/useProctoringSession";
import { useScreenMonitor } from "@/features/proctoring/useScreenMonitor";
import { useKeyboardMonitor } from "@/features/proctoring/useKeyboardMonitor";
import { useCountdown } from "@/features/exams/useCountdown";
import { DETECTION_CADENCE_MS } from "@/lib/constants";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { formatCountdown } from "@/lib/utils/format";
import { WebcamPreview, LiveStatusPanel, SuspiciousActivityChart, WarningFeed } from "@/components/proctoring";
import { Icon, MetricCard, StatusChip } from "@/components/ui";
import type { QuestionResponse } from "@/types";

function Comp1023ExamContent({ examId }: { examId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const studentId = user?.studentId ?? user?.id ?? "unknown";

  const exam = ALL_EXAMS.find((e) => e.id === examId) ?? COMP1023_EXAM;
  const definition = COMP1023_EXAM_DEFINITION;

  // If already submitted, redirect to the past exam view
  useEffect(() => {
    if (user && isExamSubmitted(examId, studentId)) {
      router.replace(`/student/exams/${examId}`);
    }
  }, [examId, studentId, user, router]);

  const [started, setStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"exam" | "monitoring">("exam");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraPrecheckError, setCameraPrecheckError] = useState<string | null>(null);
  const cameraUnavailableLoggedRef = useRef(false);

  // Countdown
  const { secondsLeft, isRunning, isComplete, start } = useCountdown(exam.durationSeconds);
  const completedSavedRef = useRef(false);

  // Proctoring
  const {
    events,
    liveStatus,
    updateLiveStatus,
    sendFrame,
    recordViolation,
    pushClipChunk,
  } = useProctoringSession(examId, studentId, started);

  // Screen monitoring
  const {
    screenReady,
    screenError,
    requestScreenAccess,
  } = useScreenMonitor({
    active: started,
    examId,
    studentId,
    onViolation: recordViolation,
    onStatusChange: updateLiveStatus,
  });

  // Keyboard shortcut monitoring (paste, copy, devtools, etc.)
  useKeyboardMonitor({
    active: started,
    examId,
    studentId,
    onViolation: recordViolation,
  });

  // Load persisted draft answers so they survive tab switches
  const initialResponses = useMemo(
    () => loadDraftAnswers(examId, studentId),
    [examId, studentId],
  );

  const requestCameraAccess = useCallback(async () => {
    setCameraPrecheckError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraReady(true);
      setCameraError(false);
      updateLiveStatus({ cameraStatus: "clear" });
      return true;
    } catch {
      setCameraReady(false);
      setCameraPrecheckError("Camera access is required before the exam can begin.");
      updateLiveStatus({ cameraStatus: "unavailable" });
      return false;
    }
  }, [updateLiveStatus]);

  const handleStartExam = useCallback(async () => {
    const hasCamera = cameraReady || (await requestCameraAccess());
    const hasScreen = screenReady || (await requestScreenAccess());
    if (!hasCamera || !hasScreen || started) return;

    setSessionStartedAt(new Date().toISOString());
    setActiveTab("exam");
    completedSavedRef.current = false;
    setStarted(true);
    start();
  }, [cameraReady, requestCameraAccess, requestScreenAccess, screenReady, start, started]);

  const handleCameraPermissionDenied = useCallback(() => {
    setCameraReady(false);
    setCameraError(true);
    updateLiveStatus({ cameraStatus: "unavailable" });
    if (cameraUnavailableLoggedRef.current) return;
    cameraUnavailableLoggedRef.current = true;
    recordViolation({
      examId, studentId, type: "camera_unavailable", severity: 0.65,
      message: "Webcam access was denied or revoked during the exam.",
    });
  }, [examId, studentId, recordViolation, updateLiveStatus]);

  const handleCameraPermissionGranted = useCallback(() => {
    setCameraReady(true);
    setCameraError(false);
    cameraUnavailableLoggedRef.current = false;
    updateLiveStatus({ cameraStatus: "clear" });
  }, [updateLiveStatus]);

  // Persist proctoring session
  useEffect(() => {
    if (!started || !user) return;
    const startedAt = sessionStartedAt ?? new Date().toISOString();
    const sessionStatus = isComplete ? "completed" : events.length > 0 ? "warning" : "active";
    const sessionSnapshot: PersistedProctoringSession = {
      examId, studentId,
      studentName: `${user.firstName} ${user.lastName}`,
      studentNumber: user.studentId ?? user.id,
      avatarUrl: user.avatarUrl,
      startedAt,
      updatedAt: new Date().toISOString(),
      endedAt: isComplete ? new Date().toISOString() : undefined,
      sessionStatus,
      liveStatus,
      rollingAverage: 0,
      buckets: [],
      events,
    };
    saveLiveSession(sessionSnapshot);
    if (isComplete && !completedSavedRef.current) {
      saveCompletedSession(sessionSnapshot);
      completedSavedRef.current = true;
    }
  }, [events, isComplete, liveStatus, sessionStartedAt, started, user, examId, studentId]);

  // On exam complete (timer runs out), auto-submit
  const latestResponsesRef = useRef<QuestionResponse[]>([]);
  useEffect(() => {
    if (isComplete && user) {
      submitExamAnswers(examId, studentId, latestResponsesRef.current);
      const t = setTimeout(() => router.push(`/student/exams/${examId}`), 2200);
      return () => clearTimeout(t);
    }
  }, [isComplete, examId, studentId, user, router]);

  const handleResponsesChange = useCallback(
    (responses: QuestionResponse[]) => {
      latestResponsesRef.current = responses;
      saveDraftAnswers(examId, studentId, responses);
    },
    [examId, studentId],
  );

  const handleSubmit = useCallback(
    (responses: QuestionResponse[]) => {
      submitExamAnswers(examId, studentId, responses);
      router.push(`/student/exams/${examId}`);
    },
    [examId, studentId, router],
  );

  const totalRiskScore = computeRiskScore(events);
  const highSeverityCount = countHighSeverityEvents(events);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">
            {exam.courseCode} – {exam.title}
          </h1>
          <p className="page-subtitle">{exam.courseName}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          {isComplete ? (
            <StatusChip variant="info" label="Exam Complete" />
          ) : !started ? (
            <StatusChip variant="warning" label="Pre-check Required" />
          ) : (
            <StatusChip variant="safe" label="In Progress" />
          )}
        </div>
      </div>

      {/* Pre-check */}
      {!started && (
        <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
          <div>
            <h2 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem" }}>Before You Begin</h2>
            <p className="helper-text" style={{ margin: 0 }}>
              You must grant webcam and screen access before the exam can start.
            </p>
          </div>
          <div className="grid grid-2 precheck-grid">
            <div className="card precheck-card">
              <div className="precheck-card__header">
                <div className="title-with-icon">
                  <Icon name="camera" />
                  <strong>Webcam Access</strong>
                </div>
                <StatusChip variant={cameraReady ? "safe" : "warning"} label={cameraReady ? "Granted" : "Not Granted"} />
              </div>
              <p className="helper-text" style={{ margin: 0 }}>Required before proceeding.</p>
              <div className="precheck-card__actions">
                <button type="button" className="button" onClick={requestCameraAccess}>Allow Webcam</button>
              </div>
              {cameraPrecheckError && (
                <p className="helper-text" style={{ margin: 0, color: "var(--danger-text)" }}>{cameraPrecheckError}</p>
              )}
            </div>
            <div className="card precheck-card">
              <div className="precheck-card__header">
                <div className="title-with-icon">
                  <Icon name="monitor" />
                  <strong>Screen Monitoring</strong>
                </div>
                <StatusChip variant={screenReady ? "safe" : "warning"} label={screenReady ? "Granted" : "Not Granted"} />
              </div>
              <p className="helper-text" style={{ margin: 0 }}>Used to detect tab switches.</p>
              <div className="precheck-card__actions">
                <button type="button" className="button-secondary" onClick={requestScreenAccess}>Allow Screen Access</button>
              </div>
              {screenError && (
                <p className="helper-text" style={{ margin: 0, color: "var(--danger-text)" }}>{screenError}</p>
              )}
            </div>
          </div>
          <div className="precheck-footer">
            <p className="helper-text" style={{ margin: 0 }}>
              The {Math.round(exam.durationSeconds / 60)}-minute exam starts after the required checks pass.
            </p>
            <button
              type="button" className="button"
              onClick={handleStartExam}
              disabled={!cameraReady || !screenReady}
              style={{ opacity: !cameraReady || !screenReady ? 0.7 : 1 }}
            >
              Start Exam
            </button>
          </div>
        </div>
      )}

      {/* Timer */}
      <div
        className={`exam-timer ${
          isComplete ? "exam-timer--complete" : started ? (secondsLeft <= 10 ? "exam-timer--running exam-timer--danger" : "exam-timer--running") : "exam-timer--idle"
        }`}
        role="timer" aria-live="polite"
      >
        <p className="helper-text exam-timer__label">
          {isComplete ? "Time\u2019s Up!" : started ? "Time Remaining" : "Exam Timer"}
        </p>
        <p className="exam-timer__value" style={{
          color: isComplete ? "var(--success-text)" : secondsLeft <= 10 ? "var(--danger-text)" : "var(--brand-primary)",
        }}>
          {formatCountdown(started ? secondsLeft : exam.durationSeconds)}
        </p>
        {isComplete && (
          <p className="helper-text" style={{ marginTop: "var(--space-2)" }}>
            Your exam has been submitted. Redirecting to your summary…
          </p>
        )}
      </div>

      {/* Session metrics */}
      <div className="grid grid-3">
        <MetricCard label="Total Warnings" value={events.length} />
        <MetricCard label="Risk Score" value={totalRiskScore} />
        <MetricCard label="Session" value={isComplete ? "Completed" : started ? "Active" : "Ready Check"} />
      </div>

      {started && (
        <div className="grid grid-2">
          <MetricCard label="High Severity Alerts" value={highSeverityCount} />
          <MetricCard label="Screen Monitoring" value={screenReady ? "Enabled" : "Stopped"} />
        </div>
      )}

      {/* Exam workspace / monitoring tabs */}
      {started && !isComplete && (
        <>
          {/* Webcam always active in background during exam */}
          <div style={{ display: activeTab === "monitoring" ? "block" : "none" }}>
            {/* Only visually hidden; WebcamPreview stays mounted below */}
          </div>

          <div className="tab-list" role="tablist" aria-label="Exam workspace tabs">
            <button type="button" role="tab" aria-selected={activeTab === "exam"}
              className={`tab-button ${activeTab === "exam" ? "is-active" : ""}`}
              onClick={() => setActiveTab("exam")}>
              <Icon name="document" /><span>Exam</span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "monitoring"}
              className={`tab-button ${activeTab === "monitoring" ? "is-active" : ""}`}
              onClick={() => setActiveTab("monitoring")}>
              <Icon name="timeline" /><span>Monitoring</span>
            </button>
          </div>

          {/* Exam tab – always mounted, hidden via CSS to preserve answers */}
          <div style={{ display: activeTab === "exam" ? "block" : "none" }}>
            <ExamWorkspaceShell
              definition={definition}
              initialResponses={initialResponses}
              onResponsesChange={handleResponsesChange}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Monitoring tab */}
          <div style={{ display: activeTab === "monitoring" ? "grid" : "none", gap: "var(--space-6)" }}>
            <div className="grid grid-2">
              <WebcamPreview
                active={isRunning}
                onFrame={sendFrame}
                captureIntervalMs={DETECTION_CADENCE_MS}
                onPermissionDenied={handleCameraPermissionDenied}
                onPermissionGranted={handleCameraPermissionGranted}
                onClipChunk={pushClipChunk}
              />
              <div style={{ display: "grid", gap: "var(--space-4)", alignContent: "start" }}>
                <div className="panel">
                  <div className="title-with-icon" style={{ marginBottom: "var(--space-3)" }}>
                    <Icon name="shield" />
                    <h2 style={{ margin: 0, fontSize: "1rem" }}>Live Status</h2>
                  </div>
                  <LiveStatusPanel status={liveStatus} />
                </div>
                {cameraError && (
                  <div className="badge-danger" style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)" }}>
                    Camera permission was denied. Proctoring data will be limited.
                  </div>
                )}
                {screenError && (
                  <div className="badge-warning" style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)" }}>
                    {screenError}
                  </div>
                )}
              </div>
            </div>
            <SuspiciousActivityChart events={events} durationSeconds={exam.durationSeconds} startedAt={sessionStartedAt} title="Exam Alert Timeline" />
            <WarningFeed events={events} />
          </div>
        </>
      )}
    </div>
  );
}

export default function Comp1023ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return (
    <AuthenticatedShell requiredRole="student">
      <Comp1023ExamContent examId={examId} />
    </AuthenticatedShell>
  );
}
