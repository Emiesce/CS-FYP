/* ------------------------------------------------------------------ */
/*  proctoring-worker.ts                                              */
/*  Web Worker – runs MediaPipe FaceLandmarker inference off the       */
/*  main thread so the UI never stutters.                             */
/* ------------------------------------------------------------------ */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

/* ---------- Types shared with the main thread --------------------- */

export interface WorkerInitMsg {
  kind: "init";
}

export interface WorkerFrameMsg {
  kind: "frame";
  bitmap: ImageBitmap;
  timestamp: number; // performance.now()
}

export type WorkerInbound = WorkerInitMsg | WorkerFrameMsg;

export interface DetectionResult {
  gazeAway: boolean;
  cameraBlocked: boolean;
  faceCount: number;
  faceMissing: boolean;
}

export interface WorkerReadyMsg {
  kind: "ready";
}

export interface WorkerResultMsg {
  kind: "result";
  result: DetectionResult;
}

export interface WorkerErrorMsg {
  kind: "error";
  message: string;
}

export type WorkerOutbound = WorkerReadyMsg | WorkerResultMsg | WorkerErrorMsg;

/* ---------- Constants --------------------------------------------- */

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

/** Gaze-away threshold: if the iris-centre is this far from the eye
 *  centre (normalised 0-1 across the eye width), we flag "gaze away". */
const GAZE_HORIZONTAL_THRESHOLD = 0.18;
const GAZE_VERTICAL_THRESHOLD = 0.2;
const HEAD_TURN_THRESHOLD = 0.16;
const DARK_FRAME_LUMA_THRESHOLD = 36;
const FLAT_FRAME_VARIANCE_THRESHOLD = 180;

/* ---------- Worker state ------------------------------------------ */

let landmarker: FaceLandmarker | null = null;
let analysisCanvas: OffscreenCanvas | null = null;
let analysisContext: OffscreenCanvasRenderingContext2D | null = null;

/* ---------- Helpers ----------------------------------------------- */

/**
 * Compute a simple gaze-away signal from the 468+ face landmarks.
 *
 * We use the iris landmarks (468-472 for left, 473-477 for right) relative
 * to the eye corner landmarks to decide if the user is looking away.
 *
 * Left eye corners:  33 (outer), 133 (inner)
 * Right eye corners: 362 (outer), 263 (inner)
 * Left iris centre:  468
 * Right iris centre: 473
 */
function isGazeAway(landmarks: { x: number; y: number; z: number }[]): boolean {
  // Need iris landmarks (indices >= 468)
  if (landmarks.length < 474) return false;

  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftUpper = landmarks[159];
  const leftLower = landmarks[145];
  const leftIris = landmarks[468];

  const rightOuter = landmarks[362];
  const rightInner = landmarks[263];
  const rightUpper = landmarks[386];
  const rightLower = landmarks[374];
  const rightIris = landmarks[473];
  const noseTip = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x) || 1e-6;
  const leftHorizontalOffset =
    Math.abs(leftIris.x - (leftOuter.x + leftInner.x) / 2) / leftEyeWidth;
  const leftEyeHeight = Math.abs(leftLower.y - leftUpper.y) || 1e-6;
  const leftVerticalOffset =
    Math.abs(leftIris.y - (leftUpper.y + leftLower.y) / 2) / leftEyeHeight;

  const rightEyeWidth = Math.abs(rightInner.x - rightOuter.x) || 1e-6;
  const rightHorizontalOffset =
    Math.abs(rightIris.x - (rightOuter.x + rightInner.x) / 2) / rightEyeWidth;
  const rightEyeHeight = Math.abs(rightLower.y - rightUpper.y) || 1e-6;
  const rightVerticalOffset =
    Math.abs(rightIris.y - (rightUpper.y + rightLower.y) / 2) / rightEyeHeight;

  const avgHorizontalOffset = (leftHorizontalOffset + rightHorizontalOffset) / 2;
  const avgVerticalOffset = (leftVerticalOffset + rightVerticalOffset) / 2;
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 1e-6;
  const headTurnOffset =
    Math.abs(noseTip.x - (leftCheek.x + rightCheek.x) / 2) / faceWidth;

  return (
    avgHorizontalOffset > GAZE_HORIZONTAL_THRESHOLD ||
    avgVerticalOffset > GAZE_VERTICAL_THRESHOLD ||
    headTurnOffset > HEAD_TURN_THRESHOLD
  );
}

function isFrameObscured(bitmap: ImageBitmap): boolean {
  if (!analysisCanvas || analysisCanvas.width !== bitmap.width || analysisCanvas.height !== bitmap.height) {
    analysisCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    analysisContext = analysisCanvas.getContext("2d", { willReadFrequently: true });
  }

  if (!analysisContext || !analysisCanvas) return false;

  analysisContext.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
  const { data } = analysisContext.getImageData(0, 0, bitmap.width, bitmap.height);

  let totalLuma = 0;
  let totalLumaSquared = 0;
  const sampleCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    totalLuma += luma;
    totalLumaSquared += luma * luma;
  }

  if (sampleCount === 0) return false;

  const averageLuma = totalLuma / sampleCount;
  const variance = totalLumaSquared / sampleCount - averageLuma * averageLuma;

  return (
    averageLuma < DARK_FRAME_LUMA_THRESHOLD ||
    variance < FLAT_FRAME_VARIANCE_THRESHOLD
  );
}

/**
 * Analyse FaceLandmarker output into our simplified detection result.
 */
function analyse(res: FaceLandmarkerResult, bitmap: ImageBitmap): DetectionResult {
  const faceCount = res.faceLandmarks.length;
  const frameObscured = isFrameObscured(bitmap);

  if (faceCount === 0) {
    return {
      gazeAway: false,
      cameraBlocked: frameObscured,
      faceCount: 0,
      faceMissing: true,
    };
  }

  const gazeAway = isGazeAway(res.faceLandmarks[0]);

  return {
    gazeAway,
    cameraBlocked: frameObscured,
    faceCount,
    faceMissing: false,
  };
}

/* ---------- Message handler --------------------------------------- */

self.onmessage = async (ev: MessageEvent<WorkerInbound>) => {
  const msg = ev.data;

  if (msg.kind === "init") {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 3, // detect up to 3 to catch "multiple faces"
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      (self as unknown as Worker).postMessage({ kind: "ready" } satisfies WorkerOutbound);
    } catch (err) {
      (self as unknown as Worker).postMessage({
        kind: "error",
        message: `Failed to initialise MediaPipe: ${err}`,
      } satisfies WorkerOutbound);
    }
    return;
  }

  if (msg.kind === "frame") {
    if (!landmarker) return;

    try {
      const result = landmarker.detectForVideo(msg.bitmap, msg.timestamp);
      const detection = analyse(result, msg.bitmap);
      msg.bitmap.close(); // release GPU memory
      (self as unknown as Worker).postMessage({ kind: "result", result: detection } satisfies WorkerOutbound);
    } catch {
      msg.bitmap.close();
    }
  }
};
