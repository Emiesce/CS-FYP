"use client";

import { SessionProvider } from "@/features/auth";

export function LoginWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
