"use client";

/* ------------------------------------------------------------------ */
/*  useCountdown – manages a seconds-based countdown timer            */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseCountdownReturn {
  secondsLeft: number;
  isRunning: boolean;
  isComplete: boolean;
  start: () => void;
}

export function useCountdown(durationSeconds: number): UseCountdownReturn {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          cleanup();
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return cleanup;
  }, [isRunning, cleanup]);

  return {
    secondsLeft,
    isRunning,
    isComplete: secondsLeft === 0,
    start,
  };
}
