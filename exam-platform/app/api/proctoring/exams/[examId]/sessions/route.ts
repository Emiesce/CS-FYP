import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * GET /api/proctoring/exams/[examId]/sessions
 * Proxy to FastAPI backend.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  try {
    const { examId } = await params;
    const authorization = req.headers.get("authorization");
    const res = await fetch(
      `${BACKEND}/api/proctoring/exams/${examId}/sessions`,
      {
        cache: "no-store",
        headers: authorization ? { Authorization: authorization } : undefined,
      },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "backend_unavailable" }, { status: 503 });
  }
}
