"use client";

/* ------------------------------------------------------------------ */
/*  LiveStatusPanel – gaze, camera, face-count chips for the student  */
/* ------------------------------------------------------------------ */

import { StatusChip } from "@/components/ui";
import type { LiveProctoringStatus } from "@/types";

interface LiveStatusPanelProps {
  status: LiveProctoringStatus;
}

export function LiveStatusPanel({ status }: LiveStatusPanelProps) {
  return (
    <div className="panel" style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <StatusChip
        variant={status.gazeStatus === "normal" ? "safe" : "warning"}
        label={status.gazeStatus === "normal" ? "Gaze: Normal" : "Gaze: Away"}
      />
      <StatusChip
        variant={
          status.cameraStatus === "unavailable"
            ? "warning"
            : status.cameraStatus === "clear"
              ? "safe"
              : "danger"
        }
        label={
          status.cameraStatus === "unavailable"
            ? "Camera: Unavailable"
            : status.cameraStatus === "clear"
              ? "Camera: Clear"
              : "Camera: Blocked"
        }
      />
      <StatusChip
        variant={status.faceCount === 1 ? "safe" : status.faceCount === 0 ? "warning" : "danger"}
        label={`Faces: ${status.faceCount}`}
      />
      <StatusChip
        variant={status.screenStatus === "monitoring" ? "safe" : "warning"}
        label={
          status.screenStatus === "monitoring"
            ? "Screen: Monitoring"
            : "Screen: Inactive"
        }
      />
      <StatusChip
        variant={status.focusStatus === "focused" ? "safe" : "warning"}
        label={
          status.focusStatus === "focused"
            ? "Window: Focused"
            : "Window: Background"
        }
      />
    </div>
  );
}
