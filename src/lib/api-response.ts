/**
 * Helpers for reading JSON API responses on the client.
 *
 * `fetch` only rejects on network failures — a server-side 500 still resolves —
 * and an HTML error page makes `res.json()` throw, which used to surface as a
 * misleading "Network error". These helpers return the real error message the
 * server sent (or an honest status-based fallback) instead.
 */

export type ApiSuccess<T> = { ok: true; status: number; data: T };
export type ApiFailure = { ok: false; status: number; error: string };
export type ApiReadResult<T> = ApiSuccess<T> | ApiFailure;

export async function readApiResponse<T = unknown>(
  res: Response,
): Promise<ApiReadResult<T>> {
  let data: unknown = null;
  let parsed = false;
  try {
    data = await res.json();
    parsed = true;
  } catch {
    // Non-JSON body (proxy error page, empty 500 response, …).
  }

  if (res.ok) {
    return { ok: true, status: res.status, data: (parsed ? data : null) as T };
  }

  const message =
    parsed &&
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string" &&
    (data as { error: string }).error.trim()
      ? (data as { error: string }).error
      : `The server returned an error (status ${res.status}). Please try again.`;

  return { ok: false, status: res.status, error: message };
}
