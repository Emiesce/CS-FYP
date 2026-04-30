"use client";

/* ------------------------------------------------------------------ */
/*  useProctoringSession – browser-side MediaPipe proctoring via a    */
/*  Web Worker.  Falls back to random mock events when the worker     */
/*  cannot be initialised (e.g. missing GPU / WASM support).          */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LiveProctoringStatus,
  ProctoringEvent,
  ProctoringEventType,
} from "@/types";
import { uid } from "@/lib/utils/format";
import { computeRiskScore } from "@/lib/utils/risk-score";
import {
  BUCKET_INTERVAL_MS,
  PRE_CAPTURE_BUFFER_SECONDS,
  CLIP_CHUNK_DURATION_MS,
  FACE_MISSING_DEBOUNCE,
  DETECTION_CADENCE_MS,
} from "@/lib/constants";
import type {
  DetectionResult,
  WorkerInbound,
  WorkerOutbound,
} from "./proctoring-worker";

/* ------------------------------------------------------------------ */
/*  Public return type                                                */
/* ------------------------------------------------------------------ */

interface BucketDataPoint {
  label: string;
  score: number;
}

export interface CachedClip {
  id: string;
  blob: Blob;
  url: string;
  timestamp: string;
  eventType: ProctoringEventType;
}

interface UseProctoringSessionReturn {
  events: ProctoringEvent[];
  buckets: BucketDataPoint[];
  liveStatus: LiveProctoringStatus;
  rollingAverage: number;
  /** Feed each downscaled ImageBitmap from WebcamPreview here. */
  sendFrame: (bitmap: ImageBitmap) => void;
  /** Feed each MediaRecorder chunk from WebcamPreview here. */
  pushClipChunk: (chunk: Blob) => void;
  /** All evidence clips gathered during the session. */
  cachedClips: CachedClip[];
  /** Record browser-side violations such as tab switches. */
  recordViolation: (event: Omit<ProctoringEvent, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  }) => void;
  /** Update status fields that are managed outside camera inference. */
  updateLiveStatus: (status: Partial<LiveProctoringStatus>) => void;
}

const GAZE_AWAY_DEBOUNCE = 2;
const CAMERA_BLOCKED_DEBOUNCE = 3;

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useProctoringSession(
  examId: string,
  studentId: string,
  active: boolean,
): UseProctoringSessionReturn {
  const [events, setEvents] = useState<ProctoringEvent[]>([]);
  const [buckets, setBuckets] = useState<BucketDataPoint[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveProctoringStatus>({
    gazeStatus: "normal",
    cameraStatus: "clear",
    faceCount: 1,
    screenStatus: "inactive",
    focusStatus: "focused",
  });
  const [cachedClips, setCachedClips] = useState<CachedClip[]>([]);

  const bucketWindowRef = useRef<ProctoringEvent[]>([]);
  const bucketCountRef = useRef(0);

  /* ---- Worker lifecycle ------------------------------------------- */

  const workerRef = useRef<Worker | null>(null);
  const workerReady = useRef(false);
  const useMock = useRef(false);

  /* ---- Rolling clip buffer ---------------------------------------- */
  /** Keep the last N chunks (each ~CLIP_CHUNK_DURATION_MS long). */
  const maxChunks = Math.ceil(
    (PRE_CAPTURE_BUFFER_SECONDS * 1000) / CLIP_CHUNK_DURATION_MS,
  );
  const clipBufferRef = useRef<Blob[]>([]);

  const pushClipChunk = useCallback(
    (chunk: Blob) => {
      clipBufferRef.current.push(chunk);
      // Trim to rolling window
      if (clipBufferRef.current.length > maxChunks) {
        clipBufferRef.current = clipBufferRef.current.slice(-maxChunks);
      }
    },
    [maxChunks],
  );

  /* ---- Face-missing debounce ------------------------------------- */
  const faceMissingCountRef = useRef(0);
  const gazeAwayCountRef = useRef(0);
  const cameraBlockedCountRef = useRef(0);
  const gazeEpisodeStartedAtRef = useRef<string | null>(null);
  const mockStatusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitEvents = useCallback((newEvents: ProctoringEvent[]) => {
    if (newEvents.length === 0) return;

    const nextEvents = [...newEvents];

    if (clipBufferRef.current.length > 0) {
      const highSeverityIndex = nextEvents.findIndex((event) => event.severity >= 0.7);
      if (highSeverityIndex >= 0) {
        // Use the MIME type reported by the first chunk that has one.
        const rawMimeType =
          clipBufferRef.current.find((chunk) => chunk.type)?.type || "video/webm";

        // Strip codec parameters (e.g. "video/webm;codecs=vp9" → "video/webm").
        // The base container type is all that's needed for Blob construction
        // and for the <source type> hint; full codec strings cause some
        // browsers to reject the <source> element entirely.
        const clipMimeType = rawMimeType.split(";")[0].trim();

        const clipBlob = new Blob([...clipBufferRef.current], {
          type: clipMimeType,
        });
        const clipUrl = URL.createObjectURL(clipBlob);
        nextEvents[highSeverityIndex] = {
          ...nextEvents[highSeverityIndex],
          evidenceClipUrl: clipUrl,
          evidenceClipMimeType: clipMimeType,
        };

        setCachedClips((prev) => [
          ...prev,
          {
            id: uid(),
            blob: clipBlob,
            url: clipUrl,
            timestamp: nextEvents[highSeverityIndex].timestamp,
            eventType: nextEvents[highSeverityIndex].type,
          },
        ]);
      }
    }

    setEvents((prev) => [...prev, ...nextEvents]);
    bucketWindowRef.current.push(...nextEvents);
  }, []);

  const updateLiveStatus = useCallback((status: Partial<LiveProctoringStatus>) => {
    setLiveStatus((prev) => ({ ...prev, ...status }));
  }, []);

  const finalizeGazeEpisode = useCallback(() => {
    if (gazeAwayCountRef.current < GAZE_AWAY_DEBOUNCE) {
      gazeAwayCountRef.current = 0;
      gazeEpisodeStartedAtRef.current = null;
      return;
    }

    const durationSeconds = Math.max(
      1,
      Math.round((gazeAwayCountRef.current * DETECTION_CADENCE_MS) / 1000),
    );

    commitEvents([
      {
        id: uid(),
        examId,
        studentId,
        type: "gaze_away",
        severity: Math.min(0.9, 0.45 + durationSeconds * 0.06),
        startedAt: gazeEpisodeStartedAtRef.current ?? new Date().toISOString(),
        timestamp: new Date().toISOString(),
        durationSeconds,
        message: `Looked away from the screen for about ${durationSeconds} second${
          durationSeconds === 1 ? "" : "s"
        }`,
      },
    ]);

    gazeAwayCountRef.current = 0;
    gazeEpisodeStartedAtRef.current = null;
  }, [commitEvents, examId, studentId]);

  /* ---- Spawn / terminate worker ---------------------------------- */
  useEffect(() => {
    if (!active) return;

    try {
      const w = new Worker(
        new URL("./proctoring-worker.ts", import.meta.url),
        { type: "module" },
      );

      w.onmessage = (ev: MessageEvent<WorkerOutbound>) => {
        const msg = ev.data;
        if (msg.kind === "ready") {
          workerReady.current = true;
        } else if (msg.kind === "error") {
          console.warn("[proctoring] Worker error, falling back to mock:", msg.message);
          useMock.current = true;
        } else if (msg.kind === "result") {
          handleDetection(msg.result);
        }
      };

      w.onerror = () => {
        console.warn("[proctoring] Worker crashed, using mock mode");
        useMock.current = true;
      };

      // Kick off init
      w.postMessage({ kind: "init" } satisfies WorkerInbound);
      workerRef.current = w;
    } catch {
      console.warn("[proctoring] Cannot create worker, using mock mode");
      useMock.current = true;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      workerReady.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* ---- Convert DetectionResult → ProctoringEvents ---------------- */

  const handleDetection = useCallback(
    (det: DetectionResult) => {
      const newEvents: ProctoringEvent[] = [];
      const now = new Date().toISOString();

      // — Gaze away
      if (det.gazeAway) {
        if (!gazeEpisodeStartedAtRef.current) {
          gazeEpisodeStartedAtRef.current = now;
        }
        gazeAwayCountRef.current += 1;
      } else {
        finalizeGazeEpisode();
      }

      // — Multiple faces
      if (det.faceCount > 1) {
        newEvents.push({
          id: uid(),
          examId,
          studentId,
          type: "multiple_faces",
          severity: 0.85,
          timestamp: now,
          message: `${det.faceCount} faces detected in frame`,
        });
      }

      // — Camera blocked
      if (det.cameraBlocked) {
        cameraBlockedCountRef.current += 1;
        if (cameraBlockedCountRef.current >= CAMERA_BLOCKED_DEBOUNCE) {
          const durationSeconds = Math.max(
            1,
            Math.round((cameraBlockedCountRef.current * DETECTION_CADENCE_MS) / 1000),
          );
          newEvents.push({
            id: uid(),
            examId,
            studentId,
            type: "camera_blocked",
            severity: 0.82,
            startedAt: new Date(
              new Date(now).getTime() - durationSeconds * 1000,
            ).toISOString(),
            timestamp: now,
            durationSeconds,
            message: "Camera view appears obstructed or covered",
          });
          cameraBlockedCountRef.current = 0;
        }
      } else {
        cameraBlockedCountRef.current = 0;
      }

      // — Face missing (debounced)
      if (det.faceMissing) {
        faceMissingCountRef.current += 1;
        if (faceMissingCountRef.current >= FACE_MISSING_DEBOUNCE) {
          const durationSeconds = Math.max(
            1,
            Math.round((faceMissingCountRef.current * DETECTION_CADENCE_MS) / 1000),
          );
          newEvents.push({
            id: uid(),
            examId,
            studentId,
            type: "face_missing",
            severity: 0.4,
            startedAt: new Date(
              new Date(now).getTime() - durationSeconds * 1000,
            ).toISOString(),
            timestamp: now,
            durationSeconds,
            message: "Face not detected for extended interval",
          });
          faceMissingCountRef.current = 0; // reset after emitting
        }
      } else {
        faceMissingCountRef.current = 0;
      }

      // Update live status
      setLiveStatus((prev) => ({
        ...prev,
        gazeStatus: det.gazeAway ? "away" : "normal",
        cameraStatus: det.cameraBlocked ? "blocked" : "clear",
        faceCount: det.faceCount,
      }));

      commitEvents(newEvents);
    },
    [commitEvents, finalizeGazeEpisode, examId, studentId],
  );

  /* ---- sendFrame: route to worker or mock ------------------------ */

  const sendFrame = useCallback(
    (bitmap: ImageBitmap) => {
      if (!active) {
        bitmap.close();
        return;
      }

      if (!useMock.current && workerReady.current && workerRef.current) {
        const msg: WorkerInbound = {
          kind: "frame",
          bitmap,
          timestamp: performance.now(),
        };
        workerRef.current.postMessage(msg, [bitmap]); // transfer
        return;
      }

      // Mock fallback
      bitmap.close();
      generateMockEvent();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active],
  );

  /* ---- Mock event generator (unchanged from before) -------------- */
  const generateMockEvent = useCallback(() => {
    const random = Math.random();
    if (random > 0.3) return;

    const templates: {
      type: ProctoringEventType;
      severity: number;
      message: string;
      prob: number;
    }[] = [
      { type: "gaze_away", severity: 0.5, message: "Gaze deviation detected", prob: 0.15 },
      { type: "face_missing", severity: 0.4, message: "Face not detected momentarily", prob: 0.05 },
      { type: "camera_blocked", severity: 0.7, message: "Partial camera obstruction", prob: 0.05 },
      { type: "multiple_faces", severity: 0.85, message: "Additional face detected", prob: 0.05 },
    ];

    let cum = 0;
    for (const t of templates) {
      cum += t.prob;
      if (random < cum) {
        const ev: ProctoringEvent = {
          id: uid(),
          examId,
          studentId,
          type: t.type,
          severity: Math.max(0, Math.min(1, t.severity + (Math.random() - 0.5) * 0.2)),
          startedAt: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          durationSeconds: t.type === "gaze_away" ? 3 : 1,
          message: t.message,
        };

        commitEvents([ev]);

        setLiveStatus((prev) => ({
          ...prev,
          ...(t.type === "gaze_away" && { gazeStatus: "away" as const }),
          ...(t.type === "camera_blocked" && { cameraStatus: "blocked" as const }),
          ...(t.type === "multiple_faces" && { faceCount: 2 }),
        }));

        if (mockStatusResetTimeoutRef.current) {
          clearTimeout(mockStatusResetTimeoutRef.current);
        }

        mockStatusResetTimeoutRef.current = setTimeout(() => {
          setLiveStatus((prev) => ({
            ...prev,
            gazeStatus: "normal",
            cameraStatus: "clear",
            faceCount: 1,
          }));
        }, 2000);

        return;
      }
    }
  }, [commitEvents, examId, studentId]);

  const recordViolation = useCallback(
    (
      event: Omit<ProctoringEvent, "id" | "timestamp"> & {
        id?: string;
        timestamp?: string;
      },
    ) => {
      const nextEvent: ProctoringEvent = {
        ...event,
        id: event.id ?? uid(),
        startedAt: event.startedAt ?? event.timestamp ?? new Date().toISOString(),
        timestamp: event.timestamp ?? new Date().toISOString(),
        durationSeconds: event.durationSeconds ?? 1,
      };
      commitEvents([nextEvent]);
    },
    [commitEvents],
  );

  /* ---- Bucket aggregation ---------------------------------------- */
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      bucketCountRef.current += 1;
      const windowEvents = bucketWindowRef.current;
      const score = computeRiskScore(windowEvents);
      bucketWindowRef.current = [];

      setBuckets((prev) => [
        ...prev,
        { label: `${bucketCountRef.current * 10}s`, score },
      ]);
    }, BUCKET_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (active) return;
    finalizeGazeEpisode();
  }, [active, finalizeGazeEpisode]);

  useEffect(() => {
    return () => {
      if (mockStatusResetTimeoutRef.current) {
        clearTimeout(mockStatusResetTimeoutRef.current);
      }
    };
  }, []);

  /* ---- Rolling average: last 3 buckets --------------------------- */
  const rollingAverage =
    buckets.length === 0
      ? 0
      : Math.round(
          buckets.slice(-3).reduce((s, b) => s + b.score, 0) / Math.min(buckets.length, 3),
        );

  return {
    events,
    buckets,
    liveStatus,
    rollingAverage,
    sendFrame,
    pushClipChunk,
    cachedClips,
    recordViolation,
    updateLiveStatus,
  };
}
