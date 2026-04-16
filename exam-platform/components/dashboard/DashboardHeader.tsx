"use client";

/* ------------------------------------------------------------------ */
/*  DashboardHeader – greeting + navigation hint                      */
/* ------------------------------------------------------------------ */

import { useSession } from "@/features/auth";
import type { UserRole } from "@/types";

const ROLE_DISPLAY: Record<UserRole, string> = {
  student: "Student",
  instructor: "Instructor",
  teaching_assistant: "Teaching Assistant",
  administrator: "Administrator",
};

export function DashboardHeader() {
  const { user, logout } = useSession();
  if (!user) return null;

  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">Welcome, {user.firstName}</h1>
        <p className="page-subtitle">
          You are logged in as <strong>{ROLE_DISPLAY[user.role]}</strong>. Use the sections below to manage your
          examinations.
        </p>
      </div>
      <button className="button-ghost" onClick={logout} type="button" aria-label="Log out">
        Log Out
      </button>
    </header>
  );
}
