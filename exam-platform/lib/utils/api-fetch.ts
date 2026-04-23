/* ------------------------------------------------------------------ */
/*  Centralized fetch wrapper                                         */
/*  Dispatches a global "unauthorized" event on HTTP 401 so the      */
/*  SessionProvider can automatically log the user out.              */
/* ------------------------------------------------------------------ */

export const UNAUTHORIZED_EVENT = "hkust_exam_unauthorized";

/**
 * Drop-in replacement for `fetch` that fires a custom DOM event when
 * the server returns 401 Unauthorized.  The SessionProvider listens for
 * this event and clears the session automatically.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return res;
}
