"use client";

/* ------------------------------------------------------------------ */
/*  useKeyboardMonitor – detects suspicious keyboard shortcuts during  */
/*  an exam session (paste, copy, cut, etc.) and emits violations.    */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import type { ProctoringEvent } from "@/types";
import { uid } from "@/lib/utils/format";

interface UseKeyboardMonitorOptions {
  active: boolean;
  examId: string;
  studentId: string;
  onViolation: (event: ProctoringEvent) => void;
}

/** Cooldown (ms) to avoid flooding duplicate events for the same shortcut. */
const COOLDOWN_MS = 2000;

export function useKeyboardMonitor({
  active,
  examId,
  studentId,
  onViolation,
}: UseKeyboardMonitorOptions): void {
  const lastEmitRef = useRef<Record<string, number>>({});

  // Stable ref so the listener always sees the latest callback
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    if (!active) return;

    function emit(type: string, severity: number, message: string) {
      const now = Date.now();
      if (now - (lastEmitRef.current[type] ?? 0) < COOLDOWN_MS) return;
      lastEmitRef.current[type] = now;

      onViolationRef.current({
        id: uid(),
        examId,
        studentId,
        type: type as ProctoringEvent["type"],
        severity,
        timestamp: new Date().toISOString(),
        message,
      });
    }

    /* ---- clipboard events --------------------------------------- */
    const onPaste = () => emit("clipboard_paste", 0.8, "Student pasted content from clipboard.");
    const onCopy = () => emit("clipboard_copy", 0.5, "Student copied content during exam.");
    const onCut = () => emit("clipboard_cut", 0.5, "Student cut content during exam.");

    /* ---- keyboard shortcut detection ----------------------------- */
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Paste (Ctrl/Cmd+V)
      if (mod && e.key === "v") {
        emit("clipboard_paste", 0.8, "Student used Ctrl/Cmd+V (paste shortcut).");
      }
      // Copy (Ctrl/Cmd+C)
      if (mod && e.key === "c") {
        emit("clipboard_copy", 0.5, "Student used Ctrl/Cmd+C (copy shortcut).");
      }
      // Cut (Ctrl/Cmd+X)
      if (mod && e.key === "x") {
        emit("clipboard_cut", 0.5, "Student used Ctrl/Cmd+X (cut shortcut).");
      }
      // Select All (Ctrl/Cmd+A)
      if (mod && e.key === "a") {
        emit("select_all", 0.3, "Student used Ctrl/Cmd+A (select all).");
      }
      // Find (Ctrl/Cmd+F)
      if (mod && e.key === "f") {
        emit("browser_shortcut", 0.4, "Student used Ctrl/Cmd+F (browser find).");
      }
      // Open DevTools (F12 or Ctrl+Shift+I)
      if (e.key === "F12" || (mod && e.shiftKey && e.key === "I")) {
        emit("devtools_open", 0.9, "Student attempted to open browser developer tools.");
      }
      // Print (Ctrl/Cmd+P)
      if (mod && e.key === "p") {
        emit("browser_shortcut", 0.6, "Student used Ctrl/Cmd+P (print).");
      }
    };

    document.addEventListener("paste", onPaste, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active, examId, studentId]);
}
