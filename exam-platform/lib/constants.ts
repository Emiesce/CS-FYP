/* ------------------------------------------------------------------ */
/*  Application-wide constants                                        */
/* ------------------------------------------------------------------ */

/** Duration of the demo current-exam in seconds. */
export const DEMO_EXAM_DURATION_SECONDS = 60;

/** Interval (ms) at which the suspicious-activity graph updates. */
export const BUCKET_INTERVAL_MS = 10_000;

/**
 * Cadence (ms) at which frames are sampled and sent to the proctoring
 * worker for detection.  2-3 FPS is sufficient for gaze / face checks
 * without saturating the GPU or main thread.
 */
export const DETECTION_CADENCE_MS = 500; // ~2 FPS

/** Maximum raw score before clamping to 0-100. */
export const MAX_SUSPICIOUS_SCORE = 200;

/** Risk-score band thresholds. */
export const RISK_THRESHOLDS = {
  LOW_MAX: 34,
  MEDIUM_MAX: 69,
} as const;

/** Backend API base URL for the FastAPI exam service. */
export const BACKEND_API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Rolling pre-capture buffer settings                               */
/* ------------------------------------------------------------------ */

/** Length of individual Blob chunks captured by MediaRecorder (ms). */
export const CLIP_CHUNK_DURATION_MS = 3_000;

/**
 * How many seconds of pre-capture footage to keep in the rolling
 * buffer so we can look-back when a violation is detected.
 */
export const PRE_CAPTURE_BUFFER_SECONDS = 12;

/** Total desired duration of a violation evidence clip (seconds). */
export const EVIDENCE_CLIP_DURATION_SECONDS = 18;

/**
 * Number of consecutive "face missing" detections before we emit a
 * camera_blocked / face_missing event (debounce).
 */
export const FACE_MISSING_DEBOUNCE = 4;

/** Width to downscale captured frames to before sending to worker. */
export const ANALYSIS_FRAME_WIDTH = 320;

