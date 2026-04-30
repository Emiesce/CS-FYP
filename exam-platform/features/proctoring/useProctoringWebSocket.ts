"use client";

/**
 * useProctoringWebSocket
 * ──────────────────────
 * Opens a WebSocket connection to the FastAPI backend's real-time proctoring
 * alert stream for a given exam.  Intended for use on the STAFF monitoring
 * dashboard only.
 *
 * Protocol (server → client messages):
 *   { type: "auth_ok", exam_id }          – handshake accepted
 *   { type: "alert", exam_id, session_id, student_id, student_name,
 *       risk_score, rolling_average, events: [...] }
 *   { type: "ping" }                       – keep-alive heartbeat
 *
 * The hook returns:
 *   - connectionState  – "connecting" | "open" | "closed" | "error"
 *   - latestAlert      – most recent alert payload (or null)
 *   - alertHistory     – ordered list of all alerts received this session
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionToken } from "@/features/auth";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProctoringAlertEvent {
  id: string;
  type: string;
  severity: number;
  timestamp: string;
  message: string;
  duration_seconds?: number | null;
}

export interface ProctoringAlert {
  type: "alert";
  exam_id: string;
  session_id: string;
  student_id: string;
  student_name: string;
  risk_score: number;
  rolling_average: number;
  events: ProctoringAlertEvent[];
  received_at: string; // injected client-side
}

export type WsConnectionState = "connecting" | "open" | "closed" | "error";

interface UseProctoringWebSocketReturn {
  connectionState: WsConnectionState;
  latestAlert: ProctoringAlert | null;
  alertHistory: ProctoringAlert[];
  /** Manually disconnect and reconnect (e.g. after a token refresh). */
  reconnect: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Resolve the raw WebSocket URL, bypassing the Next.js HTTP proxy layer.
 *  WS connections cannot go through Next.js API routes, so we connect
 *  directly to the FastAPI backend. */
function buildWsUrl(examId: string): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000";
  return `${backend}/ws/proctoring/${encodeURIComponent(examId)}`;
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_HISTORY = 200;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProctoringWebSocket(
  examId: string,
  /** Set to false to disconnect (e.g. when the component unmounts or exam ends). */
  active: boolean,
): UseProctoringWebSocketReturn {
  const [connectionState, setConnectionState] = useState<WsConnectionState>("connecting");
  const [latestAlert, setLatestAlert] = useState<ProctoringAlert | null>(null);
  const [alertHistory, setAlertHistory] = useState<ProctoringAlert[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Increment this to force a reconnect from the effect.
  const reconnectCountRef = useRef(0);
  const [, setReconnectTick] = useState(0);

  const reconnect = useCallback(() => {
    wsRef.current?.close();
    reconnectCountRef.current += 1;
    setReconnectTick((t) => t + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!active || !examId) {
      setConnectionState("closed");
      return;
    }

    const url = buildWsUrl(examId);
    const token = getSessionToken();

    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
    } catch {
      setConnectionState("error");
      return;
    }

    wsRef.current = ws;
    setConnectionState("connecting");

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      // Send JWT auth handshake immediately after the connection opens.
      ws.send(JSON.stringify({ type: "auth", token: token ?? "" }));
    };

    ws.onmessage = (ev: MessageEvent<string>) => {
      if (!mountedRef.current) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data) as Record<string, unknown>;
      } catch {
        return;
      }

      switch (msg.type) {
        case "auth_ok":
          setConnectionState("open");
          break;

        case "alert": {
          const alert: ProctoringAlert = {
            ...(msg as unknown as Omit<ProctoringAlert, "received_at">),
            received_at: new Date().toISOString(),
          };
          setLatestAlert(alert);
          setAlertHistory((prev) => {
            const next = [alert, ...prev];
            return next.length > MAX_HISTORY ? next.slice(0, MAX_HISTORY) : next;
          });
          break;
        }

        case "ping":
          // Keep-alive — no action needed.
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnectionState("error");
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnectionState("closed");

      // Auto-reconnect if the hook is still active.
      if (active) {
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current && active) {
            reconnectCountRef.current += 1;
            setReconnectTick((t) => t + 1);
          }
        }, RECONNECT_DELAY_MS);
      }
    };

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    };
    // reconnectTick drives reconnects without needing to re-list all deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, active, reconnectCountRef.current]);

  return {
    connectionState,
    latestAlert,
    alertHistory,
    reconnect,
  };
}
