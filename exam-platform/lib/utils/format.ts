/**
 * Utility helpers shared across the application.
 *
 * IMPORTANT: formatDate / formatTime must produce **identical** output on
 * server and client so Next.js hydration never mismatches.  We therefore
 * avoid `toLocaleDateString` / `toLocaleTimeString` (locale data may differ
 * between Node and the browser) and manually build deterministic strings.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Format an ISO timestamp to "HH:MM:SS" (24-hour, UTC-based, deterministic).
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Format an ISO date string to "D Mon YYYY" (deterministic, no locale).
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Format seconds into MM:SS display.
 */
export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Clamp a number to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate a simple unique ID (good enough for the MVP).
 */
export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Readable label for a proctoring event type.
 */
export function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    gaze_away: "Gaze Away",
    camera_blocked: "Camera Blocked",
    multiple_faces: "Multiple Faces",
    face_missing: "Face Missing",
    camera_unavailable: "Camera Unavailable",
    tab_switch: "Tab Switch",
    window_exit: "Window Exit",
  };
  return labels[type] ?? type;
}
