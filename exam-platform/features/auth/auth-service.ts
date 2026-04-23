/* ------------------------------------------------------------------ */
/*  Authentication service – backend API                              */
/* ------------------------------------------------------------------ */

import { BACKEND_API_BASE } from "@/lib/constants";
import type { User, UserRole } from "@/types";

export interface AuthResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  error?: string;
}

interface BackendUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  student_number?: string | null;
  avatar_url?: string | null;
}

interface BackendLoginResponse {
  access_token: string;
  token_type: string;
  user: BackendUser;
}

interface DemoAccount {
  role: UserRole;
  label: string;
  email: string;
  password: string;
}

function normalizeUser(user: BackendUser): User {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    studentId: user.student_number ?? undefined,
    avatarUrl: user.avatar_url ?? undefined,
  };
}

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { detail?: string } | null;
      return {
        success: false,
        error: data?.detail ?? "Login failed.",
      };
    }

    const payload = (await response.json()) as BackendLoginResponse;
    return {
      success: true,
      user: normalizeUser(payload.user),
      accessToken: payload.access_token,
    };
  } catch {
    return {
      success: false,
      error: "Unable to reach the authentication service.",
    };
  }
}

export async function fetchCurrentUser(accessToken: string): Promise<User | null> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as BackendUser;
    return normalizeUser(payload);
  } catch {
    return null;
  }
}

export async function fetchDemoAccounts(): Promise<DemoAccount[]> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/api/auth/demo-accounts`, {
      cache: "no-store",
    });
    if (!response.ok) return [];
    return (await response.json()) as DemoAccount[];
  } catch {
    return [];
  }
}
