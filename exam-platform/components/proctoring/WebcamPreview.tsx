"use client";

/* ------------------------------------------------------------------ */
/*  WebcamPreview – captures frames from the user's camera            */
/*  Now also provides:                                                */
/*    • Downscaled ImageBitmaps for the proctoring worker             */
/*    • A MediaRecorder-backed rolling clip buffer                    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { ANALYSIS_FRAME_WIDTH, CLIP_CHUNK_DURATION_MS } from "@/lib/constants";

export interface WebcamPreviewProps {
  /** Whether the camera should be active. */
  active: boolean;
  /**
   * Called with each downscaled frame as an ImageBitmap for off-main-thread
   * analysis via the proctoring worker.
   */
  onFrame?: (bitmap: ImageBitmap) => void;
  /** Capture cadence in milliseconds. */
  captureIntervalMs?: number;
  /** Called when camera permission is denied. */
  onPermissionDenied?: () => void;
  /** Called when camera access is successfully granted. */
  onPermissionGranted?: () => void;
  /**
   * Called each time MediaRecorder produces a new ~3 s Blob chunk.
   * The parent hook stores these in the rolling pre-capture buffer.
   */
  onClipChunk?: (chunk: Blob) => void;
}

export function WebcamPreview({
  active,
  onFrame,
  captureIntervalMs = 500,
  onPermissionDenied,
  onPermissionGranted,
  onClipChunk,
}: WebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---- stop helpers ------------------------------------------------ */

  const stopRecorder = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    stopRecorder();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [stopRecorder]);

  /* ---- Start / stop camera ---------------------------------------- */
  useEffect(() => {
    if (!active) {
      stopStream();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setError(null);
        onPermissionGranted?.();

        /* Start MediaRecorder for the rolling clip buffer */
        if (onClipChunk && typeof MediaRecorder !== "undefined") {
          try {
            const supportedMimeType = [
              "video/mp4;codecs=h264",
              "video/webm;codecs=vp9",
              "video/webm;codecs=vp8",
              "video/webm",
            ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

            const recorder = supportedMimeType
              ? new MediaRecorder(stream, { mimeType: supportedMimeType })
              : new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) onClipChunk(e.data);
            };
            recorder.start(CLIP_CHUNK_DURATION_MS);
            recorderRef.current = recorder;
          } catch {
            /* MediaRecorder may not be supported in all environments */
          }
        }
      } catch {
        setError("Camera access denied or unavailable.");
        onPermissionDenied?.();
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onPermissionGranted]);

  /* ---- Frame capture loop ----------------------------------------- */
  useEffect(() => {
    if (!active || !onFrame) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      /* Downscale to ANALYSIS_FRAME_WIDTH for cheaper inference */
      const scale = ANALYSIS_FRAME_WIDTH / video.videoWidth;
      const w = ANALYSIS_FRAME_WIDTH;
      const h = Math.round(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      /* createImageBitmap is transferable to the worker with zero-copy */
      createImageBitmap(canvas).then((bmp) => onFrame(bmp)).catch(() => {});
    }, captureIntervalMs);

    return () => clearInterval(interval);
  }, [active, onFrame, captureIntervalMs]);

  /* ---- Render ----------------------------------------------------- */
  return (
    <div className="panel" style={{ position: "relative", overflow: "hidden" }}>
      <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "1rem" }}>Webcam Preview</h3>
      {error ? (
        <div className="empty-state">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              borderRadius: "var(--radius-md)",
              background: "var(--slate-900)",
            }}
            aria-label="Webcam preview showing your camera feed"
          />
          {active && (
            <span
              className="live-indicator"
              style={{ position: "absolute", top: "var(--space-4)", right: "var(--space-4)" }}
            >
              Recording
            </span>
          )}
        </>
      )}
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
    </div>
  );
}
