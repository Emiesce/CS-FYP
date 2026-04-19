"use client";

/* ------------------------------------------------------------------ */
/*  Student Current Exam Page                                         */
/*  60-second placeholder exam with live proctoring UI                */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { useSession } from "@/features/auth/session-store";
import { useCountdown } from "@/features/exams/useCountdown";
import { loadDraftAnswers, saveDraftAnswers } from "@/features/exams/exam-answer-store";
import { useProctoringSession } from "@/features/proctoring/useProctoringSession";
import { useScreenMonitor } from "@/features/proctoring/useScreenMonitor";
import { useKeyboardMonitor } from "@/features/proctoring/useKeyboardMonitor";
import {
  type PersistedProctoringSession,
  saveCompletedSession,
  saveLiveSession,
} from "@/features/proctoring/live-session-store";
import { DEMO_CURRENT_EXAM, DEMO_EXAM_DEFINITION } from "@/lib/fixtures";
import { DEMO_EXAM_DURATION_SECONDS, DETECTION_CADENCE_MS } from "@/lib/constants";
import { formatCountdown } from "@/lib/utils/format";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { WebcamPreview, LiveStatusPanel, SuspiciousActivityChart, WarningFeed } from "@/components/proctoring";
import { ExamWorkspaceShell } from "@/components/exam-workspace";
import { Icon, MetricCard, StatusChip } from "@/components/ui";

type StudentExamTab = "exam" | "monitoring";

function CurrentExamContent() {
  const { user } = useSession();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentExamTab>("exam");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPrecheckError, setCameraPrecheckError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const completedSavedRef = useRef(false);
  const cameraUnavailableLoggedRef = useRef(false);

  const { secondsLeft, isRunning, isComplete, start } = useCountdown(DEMO_EXAM_DURATION_SECONDS);

  const {
    events,
    liveStatus,
    sendFrame,
    pushClipChunk,
    recordViolation,
    updateLiveStatus,
  } = useProctoringSession(
    DEMO_CURRENT_EXAM.id,
    user?.studentId ?? user?.id ?? "unknown",
    isRunning,
  );

  const {
    screenReady,
    screenError,
    requestScreenAccess,
  } = useScreenMonitor({
    active: isRunning,
    examId: DEMO_CURRENT_EXAM.id,
    studentId: user?.studentId ?? user?.id ?? "unknown",
    onViolation: recordViolation,
    onStatusChange: updateLiveStatus,
  });

  const studentId = user?.studentId ?? user?.id ?? "unknown";

  // Keyboard shortcut monitoring (paste, copy, devtools, etc.)
  useKeyboardMonitor({
    active: isRunning,
    examId: DEMO_CURRENT_EXAM.id,
    studentId,
    onViolation: recordViolation,
  });

  // Load persisted draft answers so they survive tab switches
  const initialResponses = useMemo(
    () => loadDraftAnswers(DEMO_CURRENT_EXAM.id, studentId),
    [studentId],
  );

  const handleResponsesChange = useCallback(
    (responses: import("@/types").QuestionResponse[]) => {
      saveDraftAnswers(DEMO_CURRENT_EXAM.id, studentId, responses);
    },
    [studentId],
  );

  const requestCameraAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraReady(true);
      setCameraPrecheckError(null);
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

    if (!hasCamera || !hasScreen || started) {
      return;
    }

    const startedAt = new Date().toISOString();
    setSessionStartedAt(startedAt);
    setActiveTab("exam");
    completedSavedRef.current = false;
    setStarted(true);
    start();
  }, [cameraReady, requestCameraAccess, requestScreenAccess, screenReady, start, started]);

  const handleCameraPermissionDenied = useCallback(() => {
    setCameraReady(false);
    setCameraError(true);
    updateLiveStatus({ cameraStatus: "unavailable" });

    if (cameraUnavailableLoggedRef.current) {
      return;
    }

    cameraUnavailableLoggedRef.current = true;
    recordViolation({
      examId: DEMO_CURRENT_EXAM.id,
      studentId: user?.studentId ?? user?.id ?? "unknown",
      type: "camera_unavailable",
      severity: 0.65,
      message: "Webcam access was denied or revoked during the exam.",
    });
  }, [recordViolation, updateLiveStatus, user?.id, user?.studentId]);

  const handleCameraPermissionGranted = useCallback(() => {
    setCameraReady(true);
    setCameraError(false);
    cameraUnavailableLoggedRef.current = false;
    updateLiveStatus({ cameraStatus: "clear" });
  }, [updateLiveStatus]);

  useEffect(() => {
    if (!started || !user) return;

    const startedAt = sessionStartedAt ?? new Date().toISOString();

    const sessionStatus = isComplete ? "completed" : events.length > 0 ? "warning" : "active";
    const sessionSnapshot: PersistedProctoringSession = {
      examId: DEMO_CURRENT_EXAM.id,
      studentId: user.studentId ?? user.id,
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
  }, [events, isComplete, liveStatus, sessionStartedAt, started, user]);

  // Redirect on completion
  useEffect(() => {
    if (isComplete) {
      const t = setTimeout(() => {
        router.push(`/student/exams/${DEMO_CURRENT_EXAM.id}`);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [isComplete, router]);

  const totalRiskScore = computeRiskScore(events);
  const highSeverityCount = countHighSeverityEvents(events);

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">
            {DEMO_CURRENT_EXAM.courseCode} – {DEMO_CURRENT_EXAM.title}
          </h1>
          <p className="page-subtitle">{DEMO_CURRENT_EXAM.courseName}</p>
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

      {!started && (
        <div className="panel" style={{ display: "grid", gap: "var(--space-4)" }}>
          <div>
            <h2 style={{ margin: "0 0 var(--space-2)", fontSize: "1.1rem" }}>
              Before You Begin
            </h2>
            <p className="helper-text" style={{ margin: 0 }}>
              You must grant webcam access before the exam can start. Screen access is also
              requested so the platform can detect tab switches and capture evidence when the
              exam window is left.
            </p>
          </div>

          <div className="grid grid-2 precheck-grid">
            <div className="card precheck-card">
              <div className="precheck-card__header">
                <div className="title-with-icon">
                  <Icon name="camera" />
                  <strong>Webcam Access</strong>
                </div>
                <StatusChip
                  variant={cameraReady ? "safe" : "warning"}
                  label={cameraReady ? "Granted" : "Not Granted"}
                />
              </div>
              <p className="helper-text" style={{ margin: 0 }}>
                Required before proceeding to the exam page.
              </p>
              <div className="precheck-card__actions">
                <button type="button" className="button" onClick={requestCameraAccess}>
                  Allow Webcam
                </button>
              </div>
              {cameraPrecheckError && (
                <p className="helper-text" style={{ margin: 0, color: "var(--danger-text)" }}>
                  {cameraPrecheckError}
                </p>
              )}
            </div>

            <div className="card precheck-card">
              <div className="precheck-card__header">
                <div className="title-with-icon">
                  <Icon name="monitor" />
                  <strong>Screen Monitoring</strong>
                </div>
                <StatusChip
                  variant={screenReady ? "safe" : "warning"}
                  label={screenReady ? "Granted" : "Not Granted"}
                />
              </div>
              <p className="helper-text" style={{ margin: 0 }}>
                Used to detect tab switches or leaving the exam window.
              </p>
              <div className="precheck-card__actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={requestScreenAccess}
                >
                  Allow Screen Access
                </button>
              </div>
              {screenError && (
                <p className="helper-text" style={{ margin: 0, color: "var(--danger-text)" }}>
                  {screenError}
                </p>
              )}
            </div>
          </div>

          <div className="precheck-footer">
            <p className="helper-text" style={{ margin: 0 }}>
              The 1-minute placeholder exam starts only after the required checks pass.
            </p>
            <button
              type="button"
              className="button"
              onClick={handleStartExam}
              disabled={!cameraReady || !screenReady}
              style={{ opacity: !cameraReady || !screenReady ? 0.7 : 1 }}
            >
              Start Exam
            </button>
          </div>
        </div>
      )}

      {/* Countdown timer */}
      <div
        className={`exam-timer ${
          isComplete
            ? "exam-timer--complete"
            : started
              ? secondsLeft <= 10
                ? "exam-timer--running exam-timer--danger"
                : "exam-timer--running"
              : "exam-timer--idle"
        }`}
        role="timer"
        aria-live="polite"
        aria-label={`${secondsLeft} seconds remaining`}
      >
        <p className="helper-text exam-timer__label">
          {isComplete ? "Time\u2019s Up!" : started ? "Time Remaining" : "Exam Timer"}
        </p>
        <p
          className="exam-timer__value"
          style={{
            color: isComplete
              ? "var(--success-text)"
              : secondsLeft <= 10
                ? "var(--danger-text)"
                : "var(--brand-primary)",
          }}
        >
          {formatCountdown(started ? secondsLeft : DEMO_EXAM_DURATION_SECONDS)}
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
        <MetricCard
          label="Session"
          value={isComplete ? "Completed" : started ? "Active" : "Ready Check"}
        />
      </div>

      {started && (
        <div className="grid grid-2">
          <MetricCard label="High Severity Alerts" value={highSeverityCount} />
          <MetricCard label="Screen Monitoring" value={screenReady ? "Enabled" : "Stopped"} />
        </div>
      )}

      {started && !isComplete && (
        <>
          <div className="tab-list" role="tablist" aria-label="Exam workspace tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "exam"}
              className={`tab-button ${activeTab === "exam" ? "is-active" : ""}`}
              onClick={() => setActiveTab("exam")}
            >
              <Icon name="document" />
              <span>Exam</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "monitoring"}
              className={`tab-button ${activeTab === "monitoring" ? "is-active" : ""}`}
              onClick={() => setActiveTab("monitoring")}
            >
              <Icon name="timeline" />
              <span>Monitoring</span>
            </button>
          </div>

          {/* Exam tab – always mounted, hidden via CSS to preserve answers */}
          <div style={{ display: activeTab === "exam" ? "block" : "none" }}>
            <ExamWorkspaceShell
              definition={DEMO_EXAM_DEFINITION}
              initialResponses={initialResponses}
              onResponsesChange={handleResponsesChange}
              onSubmit={() => {
                router.push(`/student/exams/${DEMO_CURRENT_EXAM.id}`);
              }}
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

            <SuspiciousActivityChart
              events={events}
              durationSeconds={DEMO_EXAM_DURATION_SECONDS}
              startedAt={sessionStartedAt}
              title="Exam Alert Timeline"
            />
            <WarningFeed events={events} />
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentCurrentExamPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <CurrentExamContent />
    </AuthenticatedShell>
  );
}
