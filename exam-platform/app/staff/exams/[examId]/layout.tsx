"use client";

/* ------------------------------------------------------------------ */
/*  Past Exam Layout – sidebar navigation for modules                 */
/*  Wraps proctoring, grading, analytics sub-pages                    */
/*  Skips sidebar for edit/view pages (upcoming exams)                */
/* ------------------------------------------------------------------ */

import { use, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ALL_EXAMS, EXAM_MODULES } from "@/lib/fixtures";
import Link from "next/link";

/** Pages that should NOT get the sidebar (they have their own shells). */
const BYPASS_PATHS = ["/edit", "/view"];

function ExamSidebar({ examId }: { examId: string }) {
  const pathname = usePathname();
  const exam = ALL_EXAMS.find((e) => e.id === examId);
  const [collapsed, setCollapsed] = useState(false);

  // Determine which module is active from the URL
  const activeModule = EXAM_MODULES.find((mod) =>
    pathname.includes(`/exams/${examId}/${mod.key}`),
  )?.key ?? "proctoring";

  return (
    <aside
      style={{
        width: collapsed ? "72px" : "200px",
        minHeight: "calc(100vh - 120px)",
        borderRight: "1px solid var(--border-default)",
        padding: "var(--space-4) 0",
        flexShrink: 0,
        transition: "width 0.25s ease",
      }}
    >
      {/* Exam header */}
      <div style={{ padding: collapsed ? "0 var(--space-2)" : "0 var(--space-4)", marginBottom: "var(--space-4)" }}>
        <button
          type="button"
          className="button-ghost"
          onClick={() => setCollapsed((prev) => !prev)}
          style={{
            width: "100%",
            justifyContent: collapsed ? "center" : "space-between",
            marginBottom: "var(--space-3)",
            textDecoration: "none",
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span>{collapsed ? "»" : "«"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
        <Link
          href="/staff"
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "block",
            marginBottom: "var(--space-2)",
            textAlign: collapsed ? "center" : "left",
          }}
        >
          {collapsed ? "←" : "← Back to Dashboard"}
        </Link>
        {!collapsed && (
          <>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
              {exam?.courseCode ?? "Exam"}
            </h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                margin: "var(--space-1) 0 0",
              }}
            >
              {exam?.title ?? examId}
            </p>
          </>
        )}
      </div>

      {/* Module nav */}
      <nav>
        {EXAM_MODULES.map((mod) => {
          const isActive = activeModule === mod.key;
          const isEnabled = mod.enabled;
          return (
            <div key={mod.key}>
              {isEnabled ? (
                <Link
                  href={`/staff/exams/${examId}/${mod.key}`}
                  title={mod.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "var(--space-3) var(--space-2)" : "var(--space-2) var(--space-4)",
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--hkust-gold)" : "var(--text-primary)",
                    background: isActive ? "var(--surface-hover)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--hkust-gold)" : "3px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>
                    {mod.key === "proctoring" ? "🛡" : mod.key === "grading" ? "📝" : "📊"}
                  </span>
                  {!collapsed && mod.label}
                </Link>
              ) : (
                <div
                  title={mod.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "var(--space-3) var(--space-2)" : "var(--space-2) var(--space-4)",
                    fontSize: "0.9rem",
                    color: "var(--text-muted)",
                    opacity: 0.5,
                    cursor: "not-allowed",
                    borderLeft: "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>📊</span>
                  {!collapsed && (
                    <>
                      {mod.label}
                      <span
                        className="badge badge-warning"
                        style={{ fontSize: "0.65rem", marginLeft: "auto" }}
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
      <div style={{ display: "flex", gap: 0, margin: "calc(-1 * var(--space-6))", minHeight: "calc(100vh - 120px)" }}>
        <ExamSidebar examId={examId} />
        <main style={{ flex: 1, padding: "var(--space-4)", minWidth: 0 }}>
          {children}
        </main>
      </div>
    </AuthenticatedShell>
  );
}
