"use client";

import type { CSSProperties, ReactNode } from "react";

type IconName =
  | "camera"
  | "monitor"
  | "document"
  | "timeline"
  | "warning"
  | "shield"
  | "list"
  | "clock";

interface IconProps {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

const iconPaths: Record<IconName, ReactNode> = {
  camera: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h4.1a2 2 0 0 0 1.4-.57l.6-.6A2 2 0 0 1 14.01 4H17.5A2.5 2.5 0 0 1 20 6.5v9A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5z" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  monitor: (
    <>
      <rect x="3.5" y="5" width="17" height="11.5" rx="2" />
      <path d="M9.5 19h5" />
      <path d="M12 16.5V19" />
    </>
  ),
  document: (
    <>
      <path d="M8 3.5h6l4 4V20a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 12h6" />
      <path d="M9 15.5h6" />
    </>
  ),
  timeline: (
    <>
      <path d="M6 6h12" />
      <path d="M6 12h12" />
      <path d="M6 18h12" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.5 20 19H4z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-2.95 7.5-7 8.9-4.05-1.4-7-4.6-7-8.9V6z" />
      <path d="m9.2 11.7 1.8 1.8 3.8-4" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h9" />
      <path d="M9 12h9" />
      <path d="M9 17h9" />
      <circle cx="6" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3.5 2" />
    </>
  ),
};

export function Icon({ name, size = 18, style, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto", ...style }}
      className={className}
    >
      {iconPaths[name]}
    </svg>
  );
}
