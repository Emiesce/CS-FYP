"use client";

/* ------------------------------------------------------------------ */
/*  Past Exam Layout – sidebar navigation for modules                 */
/*  Wraps proctoring, grading, analytics sub-pages                    */
/*  Skips sidebar for edit/view pages (upcoming exams)                */
/* ------------------------------------------------------------------ */

import { use, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { useEffect } from "react";
import { fetchExamDefinition } from "@/features/exams/exam-service";
import Link from "next/link";

/** Pages that should NOT get the sidebar (they have their own shells). */
const BYPASS_PATHS = ["/edit", "/view"];

const EXAM_MODULES = [
  { key: "proctoring", label: "Proctoring", enabled: true },
  { key: "grading", label: "Grading", enabled: true },
  { key: "analytics", label: "Analytics", enabled: true },
] as const;

/* ---- Inline SVG icons -------------------------------------------- */
const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconPenLine = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const IconBarChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function moduleIcon(key: string) {
  if (key === "proctoring") return <IconShield />;
  if (key === "grading")    return <IconPenLine />;
  return <IconBarChart />;
}

function ExamSidebar({ examId }: { examId: string }) {
  const pathname = usePathname();
  const [examLabel, setExamLabel] = useState<{ courseCode: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchExamDefinition(examId).then((definition) => {
      if (!cancelled && definition) {
        setExamLabel({ courseCode: definition.courseCode, title: definition.title });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const activeModule = EXAM_MODULES.find((mod) =>
    pathname.includes(`/exams/${examId}/${mod.key}`),
  )?.key ?? "proctoring";

  return (
    <aside
      style={{
        width: collapsed ? "64px" : "220px",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--surface-strong)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: "width 0.22s ease",
        /* hide scrollbar visually but keep it functional */
        scrollbarWidth: "none",
      }}
    >
      {/* Top: back + collapse */}
      <div
        style={{
          padding: collapsed ? "var(--space-4) var(--space-3)" : "var(--space-4) var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        {/* Back to dashboard */}
        <Link
          href="/staff"
          title="Back to Dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            textDecoration: "none",
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <IconChevronLeft />
          {!collapsed && "Dashboard"}
        </Link>

        {/* Exam label */}
        {!collapsed && examLabel && (
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--brand-primary)",
                marginBottom: "var(--space-1)",
              }}
            >
              {examLabel.courseCode}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {examLabel.title}
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: "var(--space-2)",
            width: "100%",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            background: "var(--slate-100)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 500,
            whiteSpace: "nowrap",
            transition: "background var(--transition-base)",
          }}
        >
          {collapsed ? <IconChevronRight /> : <><span>Collapse</span><IconChevronLeft /></>}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "var(--space-3) 0" }}>
        <div
          style={{
            padding: collapsed ? 0 : "0 var(--space-4)",
            marginBottom: "var(--space-2)",
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              Modules
            </span>
          )}
        </div>
        {EXAM_MODULES.map((mod) => {
          const isActive = activeModule === mod.key;
          const isEnabled = mod.enabled;
          return (
            <div key={mod.key} style={{ padding: collapsed ? "var(--space-1) var(--space-2)" : "var(--space-1) var(--space-3)" }}>
              {isEnabled ? (
                <Link
                  href={`/staff/exams/${examId}/${mod.key}`}
                  title={mod.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "var(--space-3)" : "var(--space-3) var(--space-3)",
                    fontSize: "0.88rem",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--hkust-blue-800)" : "var(--text-secondary)",
                    background: isActive ? "var(--hkust-blue-100)" : "transparent",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: isActive ? "3px solid var(--hkust-blue-700)" : "3px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {moduleIcon(mod.key)}
                  {!collapsed && mod.label}
                </Link>
              ) : (
                <div
                  title={`${mod.label} (coming soon)`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "var(--space-3)" : "var(--space-3) var(--space-3)",
                    fontSize: "0.88rem",
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    borderRadius: "var(--radius-sm)",
                    borderLeft: "3px solid transparent",
                    opacity: 0.5,
                    cursor: "not-allowed",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {moduleIcon(mod.key)}
                  {!collapsed && (
                    <>
                      {mod.label}
                      <span
                        className="badge badge-warning"
                        style={{ fontSize: "0.62rem", marginLeft: "auto" }}
                      >
                        Soon
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: exam ID pill */}
      {!collapsed && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              fontFamily: "monospace",
              background: "var(--slate-100)",
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-sm)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={examId}
          >
            {examId}
          </span>
        </div>
      )}
    </aside>
  );
}

export default function PastExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const pathname = usePathname();

  // Skip sidebar for edit/view pages (they have their own AuthenticatedShell)
  const shouldBypass = BYPASS_PATHS.some((p) => pathname.endsWith(p));
  if (shouldBypass) {
    return <>{children}</>;
  }

  return (
    <AuthenticatedShell requiredRole="staff">
      <div style={{ display: "flex", gap: 0, margin: "calc(-1 * var(--space-8)) calc(-1 * var(--space-6))", minHeight: "calc(100vh - 64px)", alignItems: "flex-start" }}>
        <ExamSidebar examId={examId} />
        <main style={{ flex: 1, padding: "var(--space-6) var(--space-6)", minWidth: 0, overflow: "auto" }}>
          {children}
        </main>
      </div>
    </AuthenticatedShell>
  );
}
