import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * POST /api/proctoring/sync
 * Proxy to the FastAPI backend so the browser avoids cross-origin issues.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const authorization = req.headers.get("authorization");
    const res = await fetch(`${BACKEND}/api/proctoring/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proctoring-sync proxy] error:", err);
    return NextResponse.json({ error: "backend_unavailable" }, { status: 503 });
  }
}
