"use client";

/* ------------------------------------------------------------------ */
/*  COMP1023 Exam-taking Page – student takes the exam with proctoring */
/* ------------------------------------------------------------------ */

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import {
  ExamWorkspaceShell,
  type ExamWorkspaceState,
} from "@/components/exam-workspace/ExamWorkspaceShell";
import { useSession } from "@/features/auth/session-store";
import { refreshStudentAttempt } from "@/features/exams/exam-answer-store";
import {
  fetchAttempt,
  fetchExamDefinition,
  saveDraft,
  startAttempt,
  submitAttempt,
} from "@/features/exams/exam-service";
import {
  saveCompletedSession,
  saveLiveSession,
  uploadEventClips,
} from "@/features/proctoring/live-session-store";
import type { PersistedProctoringSession } from "@/features/proctoring/live-session-store";
import { useProctoringSession } from "@/features/proctoring/useProctoringSession";
import { useScreenMonitor } from "@/features/proctoring/useScreenMonitor";
import { useKeyboardMonitor } from "@/features/proctoring/useKeyboardMonitor";
import { useCountdown } from "@/features/exams/useCountdown";
import { DETECTION_CADENCE_MS } from "@/lib/constants";
import { computeRiskScore, countHighSeverityEvents } from "@/lib/utils/risk-score";
import { formatCountdown } from "@/lib/utils/format";
import {
  WebcamPreview,
  LiveStatusPanel,
  SuspiciousActivityChart,
  WarningFeed,
} from "@/components/proctoring";
import { Icon, MetricCard, StatusChip } from "@/components/ui";
import type { ExamDefinition } from "@/types";

const EMPTY_DEFINITION: ExamDefinition = {
  id: "",
  courseCode: "",
  courseName: "",
  title: "",
  date: "",
  startTime: "",
  durationSeconds: 60,
  location: "",
  instructions: "",
  questions: [],
  totalPoints: 0,
  createdAt: "",
  updatedAt: "",
};

function Comp1023ExamContent({ examId }: { examId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const studentId = user?.studentId ?? user?.id ?? "unknown";
  const [definition, setDefinition] = useState<ExamDefinition | null>(null);
  const [definitionLoading, setDefinitionLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchExamDefinition(examId).then((exam) => {
      if (!cancelled) {
        setDefinition(exam);
        setDefinitionLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [examId]);
  const activeDefinition = definition ?? EMPTY_DEFINITION;

  const exam = {
    id: activeDefinition.id,
    courseCode: activeDefinition.courseCode,
    courseName: activeDefinition.courseName,
    title: activeDefinition.title,
    durationSeconds: activeDefinition.durationSeconds,
  };

  const [started, setStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"exam" | "monitoring">("exam");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraPrecheckError, setCameraPrecheckError] = useState<string | null>(null);
  const [attemptLoading, setAttemptLoading] = useState(true);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<ExamWorkspaceState | null>(null);
  const cameraUnavailableLoggedRef = useRef(false);
  const completedSavedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTriggeredRef = useRef(false);
  const latestWorkspaceRef = useRef<ExamWorkspaceState | null>(null);

  const { secondsLeft, isRunning, isComplete, start } = useCountdown(exam.durationSeconds);

  const {
    events,
    buckets,
    liveStatus,
    rollingAverage,
    updateLiveStatus,
    sendFrame,
    recordViolation,
    pushClipChunk,
    cachedClips,
  } = useProctoringSession(examId, studentId, started);

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

  useKeyboardMonitor({
    active: started,
    examId,
    studentId,
    onViolation: recordViolation,
  });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    void (async () => {
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
    [examId, studentId],
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
    setCameraPrecheckError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
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

    const attempt =
      (await startAttempt(examId, studentId)) ?? (await fetchAttempt(examId, studentId));

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
    setSessionStartedAt(new Date().toISOString());
    setActiveTab("exam");
    completedSavedRef.current = false;
    submitTriggeredRef.current = false;
    setStarted(true);
    start();
  }, [
    cameraReady,
    examId,
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
    if (cameraUnavailableLoggedRef.current) return;
    cameraUnavailableLoggedRef.current = true;
    recordViolation({
      examId,
      studentId,
      type: "camera_unavailable",
      severity: 0.65,
      message: "Webcam access was denied or revoked during the exam.",
    });
  }, [examId, recordViolation, studentId, updateLiveStatus]);

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
      studentId,
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
      // Upload evidence video clips to the backend so they survive page navigation.
      if (cachedClips.length > 0) {
        void uploadEventClips(
          cachedClips.map((clip) => ({
            eventId: clip.id,
            blob: clip.blob,
            mimeType: clip.url.startsWith("blob:") ? (clip.blob.type || "video/webm") : "video/webm",
          })),
        );
      }
    }
  }, [
    buckets,
    cachedClips,
    events,
    examId,
    isComplete,
    liveStatus,
    rollingAverage,
    sessionStartedAt,
    started,
    studentId,
    user,
  ]);

  const submitAndExit = useCallback(async () => {
    const savedAttempt = await flushDraftSave();
    const submittedAttempt = (await submitAttempt(examId, studentId)) ?? savedAttempt;

    if (!submittedAttempt || submittedAttempt.status === "in_progress") {
      setAttemptError("We couldn't submit your attempt. Please try again.");
      submitTriggeredRef.current = false;
      return;
    }

    await refreshStudentAttempt(examId, studentId);
    router.push(`/student/exams/${examId}`);
  }, [examId, flushDraftSave, router, studentId]);

  useEffect(() => {
    if (!isComplete || !user || submitTriggeredRef.current) {
      return;
    }

    submitTriggeredRef.current = true;
    const timeout = setTimeout(() => {
      void submitAndExit();
    }, 400);

    return () => clearTimeout(timeout);
  }, [isComplete, submitAndExit, user]);

  const handleSubmit = useCallback(() => {
    submitTriggeredRef.current = true;
    void submitAndExit();
  }, [submitAndExit]);

  const totalRiskScore = computeRiskScore(events);
  const highSeverityCount = countHighSeverityEvents(events);

  if (definitionLoading || !definition) {
    return <div className="panel">Loading exam...</div>;
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
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

      {attemptError && (
        <div
          className="badge-danger"
          style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-sm)" }}
        >
          {attemptError}
        </div>
      )}

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
                <StatusChip
                  variant={cameraReady ? "safe" : "warning"}
                  label={cameraReady ? "Granted" : "Not Granted"}
                />
              </div>
              <p className="helper-text" style={{ margin: 0 }}>
                Required before proceeding.
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
                Used to detect tab switches.
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
              The {Math.round(exam.durationSeconds / 60)}-minute exam starts after the required
              checks pass.
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
          {formatCountdown(started ? secondsLeft : exam.durationSeconds)}
        </p>
        {isComplete && (
          <p className="helper-text" style={{ marginTop: "var(--space-2)" }}>
            Your exam has been submitted. Redirecting to your summary…
          </p>
        )}
      </div>

      {isComplete && (
        <>
          <div className="grid grid-3">
            <MetricCard label="Total Warnings" value={events.length} />
            <MetricCard label="Risk Score" value={totalRiskScore} />
            <MetricCard label="Session" value="Completed" />
          </div>
          <div className="grid grid-2">
            <MetricCard label="High Severity Alerts" value={highSeverityCount} />
            <MetricCard label="Screen Monitoring" value={screenReady ? "Enabled" : "Stopped"} />
          </div>
        </>
      )}

      {started && !isComplete && (
        <>
          {/*
           * WebcamPreview – rendered ONCE, always mounted so the frame-capture
           * interval and MediaRecorder never stop regardless of active tab.
           *
           * • Exam tab  → small floating card (position:fixed, bottom-right)
           *               videoWidth/Height remain non-zero, so capture works.
           * • Monitoring tab → full-width slot above the status panel.
           *
           * This avoids the display:none bug where some browsers return
           * videoWidth = 0 for hidden <video> elements, breaking frame capture.
           */}
          <div
            style={
              activeTab === "exam"
                ? {
                    position: "fixed",
                    bottom: "1.5rem",
                    right: "1.5rem",
                    width: "200px",
                    zIndex: 50,
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                    overflow: "hidden",
                  }
                : {}
            }
            aria-label="Live webcam monitoring – always active"
          >
            <WebcamPreview
              active={isRunning}
              onFrame={sendFrame}
              captureIntervalMs={DETECTION_CADENCE_MS}
              onPermissionDenied={handleCameraPermissionDenied}
              onPermissionGranted={handleCameraPermissionGranted}
              onClipChunk={pushClipChunk}
            />
          </div>

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

          <div style={{ display: activeTab === "exam" ? "block" : "none" }}>
            <ExamWorkspaceShell
              definition={activeDefinition}
              initialResponses={attemptState?.responses ?? []}
              initialCurrentQuestionIndex={attemptState?.currentQuestionIndex ?? 0}
              initialFlaggedQuestionIds={attemptState?.flaggedQuestionIds ?? []}
              onStateChange={queueDraftSave}
              onSubmit={handleSubmit}
            />
          </div>

          {activeTab === "monitoring" && (
            <div style={{ display: "grid", gap: "var(--space-6)" }}>
              {/* Status panel – WebcamPreview is rendered above in its own wrapper */}
              <div className="panel">
                <div className="title-with-icon" style={{ marginBottom: "var(--space-3)" }}>
                  <Icon name="shield" />
                  <h2 style={{ margin: 0, fontSize: "1rem" }}>Live Status</h2>
                </div>
                <LiveStatusPanel status={liveStatus} />
                {cameraError && (
                  <div
                    className="badge-danger"
                    style={{
                      marginTop: "var(--space-3)",
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Camera permission was denied. Proctoring data will be limited.
                  </div>
                )}
                {screenError && (
                  <div
                    className="badge-warning"
                    style={{
                      marginTop: "var(--space-3)",
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {screenError}
                  </div>
                )}
              </div>
              <SuspiciousActivityChart
                events={events}
                durationSeconds={exam.durationSeconds}
                startedAt={sessionStartedAt}
                title="Exam Alert Timeline"
              />
              <WarningFeed events={events} />
            </div>
          )}
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
