"use client";

/* ------------------------------------------------------------------ */
/*  DashboardHeader – greeting + navigation hint                      */
/* ------------------------------------------------------------------ */

import { useSession } from "@/features/auth";

export function DashboardHeader() {
  const { user, logout } = useSession();
  if (!user) return null;

  const roleLabel = user.role === "student" ? "Student" : "Teaching Staff";

  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">Welcome, {user.firstName}</h1>
        <p className="page-subtitle">
          You are logged in as <strong>{roleLabel}</strong>. Use the sections below to manage your
          examinations.
        </p>
      </div>
      <button className="button-ghost" onClick={logout} type="button" aria-label="Log out">
        Log Out
      </button>
    </header>
  );
}
