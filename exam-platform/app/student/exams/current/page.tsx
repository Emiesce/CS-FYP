"use client";

/* ------------------------------------------------------------------ */
/*  Student Current Exam Page                                         */
/*  60-second placeholder exam with live proctoring UI                */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { getCurrentExam } from "@/features/catalog/catalog-service";
import { useSession } from "@/features/auth/session-store";
import { useCountdown } from "@/features/exams/useCountdown";
import { refreshStudentAttempt } from "@/features/exams/exam-answer-store";
import {
  fetchAttempt,
  fetchExamDefinition,
  saveDraft,
  startAttempt,
  submitAttempt,
} from "@/features/exams/exam-service";
import { useProctoringSession } from "@/features/proctoring/useProctoringSession";
import { useScreenMonitor } from "@/features/proctoring/useScreenMonitor";
import { useKeyboardMonitor } from "@/features/proctoring/useKeyboardMonitor";
import {
  type PersistedProctoringSession,
  saveCompletedSession,
  saveLiveSession,
} from "@/features/proctoring/live-session-store";
import { DEMO_EXAM_DURATION_SECONDS, DETECTION_CADENCE_MS } from "@/lib/constants";
import { formatCountdown } from "@/lib/utils/format";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { WebcamPreview, LiveStatusPanel, SuspiciousActivityChart, WarningFeed } from "@/components/proctoring";
import {
  ExamWorkspaceShell,
  type ExamWorkspaceState,
} from "@/components/exam-workspace/ExamWorkspaceShell";
import { Icon, MetricCard, StatusChip } from "@/components/ui";
import type { Exam, ExamDefinition } from "@/types";

type StudentExamTab = "exam" | "monitoring";

function CurrentExamContent() {
  const { user } = useSession();
  const router = useRouter();
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [examDefinition, setExamDefinition] = useState<ExamDefinition | null>(null);
  const [examLoading, setExamLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudentExamTab>("exam");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPrecheckError, setCameraPrecheckError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const completedSavedRef = useRef(false);
  const cameraUnavailableLoggedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTriggeredRef = useRef(false);
  const latestWorkspaceRef = useRef<ExamWorkspaceState | null>(null);
  const [attemptLoading, setAttemptLoading] = useState(true);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<{
    responses: import("@/types").QuestionResponse[];
    currentQuestionIndex: number;
    flaggedQuestionIds: string[];
  } | null>(null);

  const examId = currentExam?.id ?? "";
  const examDurationSeconds = currentExam?.durationSeconds ?? DEMO_EXAM_DURATION_SECONDS;

  useEffect(() => {
    let cancelled = false;
    void getCurrentExam()
      .then(async (exam) => {
        if (cancelled) return;
        setCurrentExam(exam);
        if (!exam) return;
        const definition = await fetchExamDefinition(exam.id);
        if (!cancelled) {
          setExamDefinition(definition);
        }
      })
      .finally(() => {
        if (!cancelled) setExamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { secondsLeft, isRunning, isComplete, start } = useCountdown(examDurationSeconds);

  const {
    events,
    buckets,
    liveStatus,
    rollingAverage,
    sendFrame,
    pushClipChunk,
    recordViolation,
    updateLiveStatus,
  } = useProctoringSession(
    examId,
    user?.studentId ?? user?.id ?? "unknown",
    isRunning,
  );

  const {
    screenReady,
    screenError,
    requestScreenAccess,
  } = useScreenMonitor({
    active: isRunning,
    examId,
    studentId: user?.studentId ?? user?.id ?? "unknown",
    onViolation: recordViolation,
    onStatusChange: updateLiveStatus,
  });

  const studentId = user?.studentId ?? user?.id ?? "unknown";

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    void (async () => {
      if (!examId) {
        setAttemptLoading(false);
        return;
      }

      const attempt = await fetchAttempt(examId, studentId);
      if (cancelled) return;

      if (attempt?.status === "submitted" || attempt?.status === "timed_out") {
        await refreshStudentAttempt(examId, studentId);
        router.replace(`/student/exams/${examId}`);
        return;
      }

      if (attempt) {
        const nextState = {
          responses: attempt.responses,
          currentQuestionIndex: attempt.currentQuestionIndex,
          flaggedQuestionIds: attempt.flaggedQuestionIds,
        };
        setAttemptState(nextState);
        latestWorkspaceRef.current = nextState;
      }

      setAttemptLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [examId, router, studentId, user]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcut monitoring (paste, copy, devtools, etc.)
  useKeyboardMonitor({
    active: isRunning,
    examId,
    studentId,
    onViolation: recordViolation,
  });

  const persistDraft = useCallback(
    async (state: ExamWorkspaceState) => {
      const savedAttempt = await saveDraft(examId, studentId, state);
      if (!savedAttempt) {
        setAttemptError("We couldn't save your latest draft to the backend.");
        return null;
      }

      const nextState = {
        responses: savedAttempt.responses,
        currentQuestionIndex: savedAttempt.currentQuestionIndex,
        flaggedQuestionIds: savedAttempt.flaggedQuestionIds,
      };
      setAttemptState(nextState);
      latestWorkspaceRef.current = nextState;
      setAttemptError(null);
      return savedAttempt;
    },
    [studentId],
  );

  const queueDraftSave = useCallback(
    (state: ExamWorkspaceState) => {
      latestWorkspaceRef.current = state;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        void persistDraft(state);
      }, 600);
    },
    [persistDraft],
  );

  const flushDraftSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (!latestWorkspaceRef.current) {
      return null;
    }

    return persistDraft(latestWorkspaceRef.current);
  }, [persistDraft]);

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

    const attempt =
      (await startAttempt(examId, studentId)) ??
      (await fetchAttempt(examId, studentId));

    if (!attempt) {
      setAttemptError("We couldn't start your exam attempt. Please try again.");
      return;
    }

    const nextState = {
      responses: attempt.responses,
      currentQuestionIndex: attempt.currentQuestionIndex,
      flaggedQuestionIds: attempt.flaggedQuestionIds,
    };
    setAttemptState(nextState);
    latestWorkspaceRef.current = nextState;
    setAttemptError(null);

    const startedAt = new Date().toISOString();
    setSessionStartedAt(startedAt);
    setActiveTab("exam");
    completedSavedRef.current = false;
    submitTriggeredRef.current = false;
    setStarted(true);
    start();
  }, [
    cameraReady,
    requestCameraAccess,
    requestScreenAccess,
    screenReady,
    start,
    started,
    studentId,
    setActiveTab,
  ]);

  const handleCameraPermissionDenied = useCallback(() => {
    setCameraReady(false);
    setCameraError(true);
    updateLiveStatus({ cameraStatus: "unavailable" });

    if (cameraUnavailableLoggedRef.current) {
      return;
    }

    cameraUnavailableLoggedRef.current = true;
    recordViolation({
      examId,
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
      examId,
      studentId: user.studentId ?? user.id,
      studentName: `${user.firstName} ${user.lastName}`,
      studentNumber: user.studentId ?? user.id,
      avatarUrl: user.avatarUrl,
      startedAt,
      updatedAt: new Date().toISOString(),
      endedAt: isComplete ? new Date().toISOString() : undefined,
      sessionStatus,
      liveStatus,
      riskScore: computeRiskScore(events),
      rollingAverage,
      buckets,
      events,
    };

    saveLiveSession(sessionSnapshot);

    if (isComplete && !completedSavedRef.current) {
      saveCompletedSession(sessionSnapshot);
      completedSavedRef.current = true;
    }
  }, [buckets, events, isComplete, liveStatus, rollingAverage, sessionStartedAt, started, user]);

  const submitAndExit = useCallback(async () => {
    const savedAttempt = await flushDraftSave();
    const submittedAttempt =
      (await submitAttempt(examId, studentId)) ?? savedAttempt;

    if (!submittedAttempt || submittedAttempt.status === "in_progress") {
      setAttemptError("We couldn't submit your attempt. Please try again.");
      submitTriggeredRef.current = false;
      return;
    }

    await refreshStudentAttempt(examId, studentId);
    router.push(`/student/exams/${examId}`);
  }, [examId, flushDraftSave, router, studentId]);

  // Redirect on completion
  useEffect(() => {
    if (!isComplete || submitTriggeredRef.current) {
      return;
    }

    submitTriggeredRef.current = true;
    const timeout = setTimeout(() => {
      void submitAndExit();
    }, 400);

    return () => clearTimeout(timeout);
  }, [isComplete, submitAndExit]);

  const totalRiskScore = computeRiskScore(events);
  const highSeverityCount = countHighSeverityEvents(events);

  if (examLoading) {
    return <div className="panel">Loading current exam...</div>;
  }

  if (!currentExam || !examDefinition) {
    return (
      <div className="panel">
        <p className="helper-text" style={{ margin: 0 }}>
          No current exam is available for your account.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">
            {currentExam.courseCode} – {currentExam.title}
          </h1>
          <p className="page-subtitle">{currentExam.courseName}</p>
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

      {attemptError && (
        <div className="badge-danger" style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)" }}>
          {attemptError}
        </div>
      )}

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
              disabled={!cameraReady || !screenReady || attemptLoading}
              style={{ opacity: !cameraReady || !screenReady || attemptLoading ? 0.7 : 1 }}
            >
              {attemptLoading ? "Loading Attempt..." : attemptState ? "Resume Exam" : "Start Exam"}
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
          {formatCountdown(started ? secondsLeft : examDurationSeconds)}
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
              definition={examDefinition}
              initialResponses={attemptState?.responses ?? []}
              initialCurrentQuestionIndex={attemptState?.currentQuestionIndex ?? 0}
              initialFlaggedQuestionIds={attemptState?.flaggedQuestionIds ?? []}
              onStateChange={queueDraftSave}
              onSubmit={() => {
                submitTriggeredRef.current = true;
                void submitAndExit();
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
              durationSeconds={examDurationSeconds}
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
