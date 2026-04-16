/* ------------------------------------------------------------------ */
/*  Authentication service – demo-only                                */
/* ------------------------------------------------------------------ */

import type { User } from "@/types";
import { DEMO_CREDENTIALS } from "@/lib/fixtures/users";

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Attempt to authenticate with demo credentials.
 * Returns the matched user or an error message.
 */
export function authenticate(email: string, password: string): AuthResult {
  const trimmedEmail = email.trim().toLowerCase();
  const match = DEMO_CREDENTIALS.find(
    (c) => c.email.toLowerCase() === trimmedEmail && c.password === password,
  );

  if (!match) {
    return {
      success: false,
      error: "Invalid email or password. Please check your credentials and try again.",
    };
  }

  return { success: true, user: match.user };
}
