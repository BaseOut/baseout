/**
 * Browser-side helper that POSTs /api/connections/storage/local-fs/connect to
 * connect the dev local-disk destination for the active Space (no OAuth). The
 * fetch impl is injected so the helper is testable without a real network.
 */

export type ConnectLocalFsError =
  | 'unauthenticated'
  | 'no_active_space'
  | 'network'
  | 'unknown'

export type ConnectLocalFsResult =
  | { ok: true }
  | { ok: false; error: ConnectLocalFsError; status: number }

export interface ConnectLocalFsDeps {
  /** Defaults to global `fetch` in the browser. Tests inject a vi.fn() stub. */
  fetchImpl?: typeof fetch
}

export async function connectLocalFs(
  deps: ConnectLocalFsDeps = {},
): Promise<ConnectLocalFsResult> {
  const fetchFn = deps.fetchImpl ?? fetch

  let res: Response
  try {
    res = await fetchFn('/api/connections/storage/local-fs/connect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
  } catch {
    return { ok: false, error: 'network', status: 0 }
  }

  if (res.ok) return { ok: true }
  if (res.status === 401) return { ok: false, error: 'unauthenticated', status: 401 }
  if (res.status === 403) return { ok: false, error: 'no_active_space', status: 403 }
  return { ok: false, error: 'unknown', status: res.status }
}
