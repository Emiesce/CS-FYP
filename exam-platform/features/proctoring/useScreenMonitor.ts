"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveProctoringStatus, ProctoringEvent } from "@/types";
import { uid } from "@/lib/utils/format";

interface UseScreenMonitorOptions {
  active: boolean;
  examId: string;
  studentId: string;
  onViolation: (event: ProctoringEvent) => void;
  onStatusChange: (status: Partial<LiveProctoringStatus>) => void;
}

interface UseScreenMonitorReturn {
  screenReady: boolean;
  screenError: string | null;
  requestScreenAccess: () => Promise<boolean>;
  stopScreenAccess: () => void;
}

export function useScreenMonitor({
  active,
  examId,
  studentId,
  onViolation,
  onStatusChange,
}: UseScreenMonitorOptions): UseScreenMonitorReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pageHidePendingRef = useRef(false);
  const lastViolationKeyRef = useRef<string | null>(null);
  const [screenReady, setScreenReady] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const stopScreenAccess = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current = null;
    setScreenReady(false);
    onStatusChange({ screenStatus: "inactive" });
  }, [onStatusChange]);

  const captureScreenshot = useCallback((): string | undefined => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return undefined;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }, []);

  const emitScreenViolation = useCallback(
    (type: "tab_switch" | "window_exit", severity: number, message: string) => {
      const key = `${type}:${message}`;
      if (lastViolationKeyRef.current === key) {
        window.setTimeout(() => {
          if (lastViolationKeyRef.current === key) {
            lastViolationKeyRef.current = null;
          }
        }, 400);
        return;
      }

      lastViolationKeyRef.current = key;
      onViolation({
        id: uid(),
        examId,
        studentId,
        type,
        severity,
        timestamp: new Date().toISOString(),
        message,
        evidenceImageUrl: captureScreenshot(),
      });
    },
    [captureScreenshot, examId, onViolation, studentId],
  );

  const requestScreenAccess = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setScreenError("Screen monitoring is not supported in this browser.");
      onStatusChange({ screenStatus: "inactive" });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      setScreenReady(true);
      setScreenError(null);
      onStatusChange({ screenStatus: "monitoring" });

      const [track] = stream.getVideoTracks();
      if (track) {
        track.onended = () => {
          setScreenReady(false);
          setScreenError("Screen monitoring stopped. Re-enable it before continuing.");
          onStatusChange({ screenStatus: "inactive" });
        };
      }

      return true;
    } catch {
      setScreenReady(false);
      setScreenError("Screen sharing permission is required for screen-activity monitoring.");
      onStatusChange({ screenStatus: "inactive" });
      return false;
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (!active || !screenReady) {
      return;
    }

    const onVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      onStatusChange({ focusStatus: hidden ? "background" : "focused" });

      if (!hidden) {
        pageHidePendingRef.current = false;
        return;
      }

      window.setTimeout(() => {
        if (!pageHidePendingRef.current) {
          emitScreenViolation(
            "tab_switch",
            0.72,
            "Exam page moved to the background or another tab became active.",
          );
        }
      }, 120);
    };

    const onPageHide = () => {
      pageHidePendingRef.current = true;
      onStatusChange({ focusStatus: "background" });
      emitScreenViolation(
        "window_exit",
        0.92,
        "Exam window was closed, refreshed, or navigated away from.",
      );
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      pageHidePendingRef.current = false;
    };
  }, [active, emitScreenViolation, onStatusChange, screenReady]);

  useEffect(() => {
    if (active) return;
    onStatusChange({ focusStatus: "focused" });
  }, [active, onStatusChange]);

  useEffect(() => stopScreenAccess, [stopScreenAccess]);

  return {
    screenReady,
    screenError,
    requestScreenAccess,
    stopScreenAccess,
  };
}
