"use client";

/* ------------------------------------------------------------------ */
/*  Login Page                                                        */
/* ------------------------------------------------------------------ */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticate, fetchDemoAccounts } from "@/features/auth/auth-service";
import { useSession, dashboardPath } from "@/features/auth/session-store";
import { LoginPayloadSchema } from "@/lib/validation";
import type { UserRole } from "@/types";

interface DemoAccount {
  role: UserRole;
  label: string;
  email: string;
  password: string;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, user } = useSession();
  const handledAutoLoginRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(dashboardPath(user.role));
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoAccounts().then((accounts) => {
      if (!cancelled) setDemoAccounts(accounts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-login for role-switch: ?auto=student or ?auto=teaching_staff
  useEffect(() => {
    const autoRole = searchParams.get("auto");
    if (!autoRole) return;
    if (handledAutoLoginRef.current) return;

    const account = demoAccounts.find((candidate) => candidate.role === autoRole);
    if (!account) return;

    handledAutoLoginRef.current = true;
    void authenticate(account.email, account.password).then((result) => {
      if (!result.success || !result.user) {
        setError(result.error ?? "Login failed.");
        return;
      }
      login(result.user, result.accessToken);
      router.replace(dashboardPath(result.user.role));
    });
  }, [demoAccounts, login, router, searchParams]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);

      // Validate with Zod
      const parsed = LoginPayloadSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        setSubmitting(false);
        return;
      }

      const result = await authenticate(parsed.data.email, parsed.data.password);
      if (!result.success || !result.user) {
        setError(result.error ?? "Login failed.");
        setSubmitting(false);
        return;
      }

      login(result.user, result.accessToken);
      router.push(dashboardPath(result.user.role));
    },
    [email, password, login, router],
  );

  return (
    <div className="auth-shell">
      <div className="card auth-card" style={{ padding: "var(--space-8)" }}>
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h1 className="auth-title">HKUST CSE</h1>
          <p className="auth-copy">Examination Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <div>
            <label htmlFor="email" style={{ display: "block", marginBottom: "var(--space-1)", fontWeight: 600 }}>
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@ust.hk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: "block", marginBottom: "var(--space-1)", fontWeight: 600 }}>
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="badge-danger"
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <button className="button" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Demo credential hints */}
        <div
          style={{
            marginTop: "var(--space-6)",
            padding: "var(--space-4)",
            background: "var(--info-bg)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--info-text)",
          }}
        >
          <strong>Demo Credentials</strong>
          <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2rem", lineHeight: 1.8 }}>
            {demoAccounts.map((account) => (
              <li key={account.role}>
                {account.label}: <code>{account.email}</code> / <code>{account.password}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
