/**
 * Minimal Dropbox API v2 client.
 *
 * Two operations only: identify the connected user (for audit) and ensure
 * the per-Space `/Baseout-<spaceId>` folder exists at the user's root. Used
 * by the OAuth callback to seed `storage_destinations.provider_folder_id`.
 * The writer in apps/workflows (commit 3/3) does the heavy CSV-upload work.
 *
 * Dropbox folder model differs from Box and Drive:
 *   - Paths are first-class identifiers. `providerFolderId` ends up being
 *     the absolute path string (e.g. `/Baseout-<spaceId>`), not a numeric
 *     ID or a query string.
 *   - `create_folder_v2` creates a leaf folder under an existing parent.
 *     If the path already exists, Dropbox returns 409 with
 *     `error.path./.tag === 'conflict'`. We treat that as idempotent
 *     success because re-Connect needs to be a no-op.
 *   - User identity comes from POST /2/users/get_current_account; the
 *     `email` and `account_id` fields populate oauth_account_email and
 *     provider_account_id.
 */

import { DROPBOX_API_BASE } from './config'

export class DropboxAuthError extends Error {
  constructor(message = 'Dropbox access token is not valid') {
    super(message)
    this.name = 'DropboxAuthError'
  }
}

export class DropboxApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'DropboxApiError'
  }
}

export interface DropboxAccount {
  account_id: string
  email?: string
  name?: { display_name?: string }
}

export interface DropboxFolder {
  /** Absolute path under root, e.g. "/Baseout-spaceId". */
  path: string
}

export interface DropboxClientOptions {
  accessToken: string
  fetchImpl?: typeof fetch
  apiBase?: string
}

export interface DropboxClient {
  getCurrentAccount(): Promise<DropboxAccount>
  ensureBaseoutFolder(folderPath: string): Promise<DropboxFolder>
}

async function authedRpcRequest(
  url: string,
  body: unknown,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  // Dropbox RPC endpoints (on api.dropboxapi.com) accept either no body, a
  // literal "null", or a JSON object. We send JSON unconditionally — for
  // "no parameters" endpoints we pass `null` as the JSON value.
  const init: RequestInit = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  }
  const res = await fetchImpl(url, init)
  if (res.status === 401) throw new DropboxAuthError()
  return res
}

function isPathConflict(json: unknown): boolean {
  if (typeof json !== 'object' || json === null) return false
  const errSummary = (json as { error_summary?: unknown }).error_summary
  if (typeof errSummary === 'string' && errSummary.startsWith('path/conflict')) {
    return true
  }
  const err = (json as { error?: unknown }).error
  if (typeof err === 'object' && err !== null) {
    const tag = (err as { '.tag'?: unknown })['.tag']
    if (tag === 'path') {
      const pathBranch = (err as { path?: unknown }).path
      if (typeof pathBranch === 'object' && pathBranch !== null) {
        const pathTag = (pathBranch as { '.tag'?: unknown })['.tag']
        if (pathTag === 'conflict') return true
      }
    }
  }
  return false
}

export function createDropboxClient(
  opts: DropboxClientOptions,
): DropboxClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const apiBase = (opts.apiBase ?? DROPBOX_API_BASE).replace(/\/$/, '')

  async function getCurrentAccount(): Promise<DropboxAccount> {
    const res = await authedRpcRequest(
      `${apiBase}/users/get_current_account`,
      // Endpoint takes "null" parameters per Dropbox docs.
      null,
      opts.accessToken,
      fetchImpl,
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new DropboxApiError(
        res.status,
        `Dropbox users/get_current_account ${res.status}: ${body.slice(0, 200)}`,
      )
    }
    return (await res.json()) as DropboxAccount
  }

  async function ensureBaseoutFolder(
    folderPath: string,
  ): Promise<DropboxFolder> {
    // Dropbox path discipline:
    //   - must start with '/'
    //   - cannot end with '/' (except the root itself)
    //   - no '..' or '//'
    //   - max 1023 chars (we cap below well under that)
    if (!folderPath.startsWith('/')) {
      throw new Error('folder path must start with /')
    }
    if (folderPath === '/' || folderPath.endsWith('/')) {
      throw new Error('folder path cannot end with /')
    }
    if (folderPath.includes('//') || folderPath.includes('..')) {
      throw new Error('folder path contains illegal traversal segments')
    }
    if (folderPath.length > 511) {
      throw new Error('folder path too long')
    }

    const res = await authedRpcRequest(
      `${apiBase}/files/create_folder_v2`,
      { path: folderPath, autorename: false },
      opts.accessToken,
      fetchImpl,
    )

    if (res.ok) {
      // Success — Dropbox returns { metadata: { path_display, ... } }.
      const json = (await res.json()) as {
        metadata?: { path_display?: string }
      }
      return { path: json.metadata?.path_display ?? folderPath }
    }

    // Conflict (folder already exists) → idempotent success. Required because
    // Re-Connect must not create `/Baseout-<spaceId> (1)` / etc.
    if (res.status === 409) {
      const json = await res.json().catch(() => ({}))
      if (isPathConflict(json)) {
        return { path: folderPath }
      }
    }

    const body = await res.text().catch(() => '')
    throw new DropboxApiError(
      res.status,
      `Dropbox create_folder_v2 ${res.status}: ${body.slice(0, 200)}`,
    )
  }

  return { getCurrentAccount, ensureBaseoutFolder }
}
