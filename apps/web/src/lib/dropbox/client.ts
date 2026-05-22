/**
 * Minimal Dropbox API client used by the OAuth callback.
 *
 * Two methods needed at OAuth-callback time:
 *  - getCurrentAccount() — returns the connected account's email + id for
 *    display ("Connected as alice@example.com").
 *  - ensureBaseoutFolder(spaceId) — idempotently creates `/Apps/Baseout/<spaceId>`
 *    via `files/create_folder_v2`. 409 path/conflict/folder is swallowed
 *    (folder already exists from a prior connect of this Space).
 *
 * The file-upload methods live workflows-side in
 * apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts — they
 * run from the Node Trigger.dev runner, never from the Worker.
 */

import { DROPBOX_API_BASE, buildBaseoutFolderPath } from './config'

export interface DropboxClientOptions {
  accessToken: string
  /** Override for the API base URL (testing). */
  apiBase?: string
  /** Override fetch (testing). */
  fetchImpl?: typeof fetch
}

export interface DropboxAccount {
  /** Stable Dropbox account ID (account_id). */
  accountId: string
  /** Connected user's email — used for `oauth_account_email` display. */
  email: string
  /** Display name (best-effort, optional). */
  displayName?: string
}

interface RawAccount {
  account_id?: string
  email?: string
  name?: { display_name?: string }
}

export interface DropboxFolderResult {
  /** Literal path (`/Apps/Baseout/<spaceId>`) — Dropbox doesn't use IDs. */
  path: string
  /** True if Dropbox returned 409 path/conflict/folder (folder already
   *  existed from a prior connect of this Space). */
  preExisting: boolean
}

interface RawCreateFolderError {
  error?: { '.tag'?: string; path?: { '.tag'?: string } }
  error_summary?: string
}

export interface DropboxClient {
  getCurrentAccount(): Promise<DropboxAccount>
  ensureBaseoutFolder(spaceId: string): Promise<DropboxFolderResult>
}

export function createDropboxClient(opts: DropboxClientOptions): DropboxClient {
  const apiBase = opts.apiBase ?? DROPBOX_API_BASE
  const fetchImpl = opts.fetchImpl ?? fetch
  const authHeader = `Bearer ${opts.accessToken}`

  return {
    async getCurrentAccount(): Promise<DropboxAccount> {
      // Dropbox quirk: `users/get_current_account` takes no body but still
      // requires POST with `Content-Type` UNSET (sending application/json
      // returns 400 "Bad HTTP message"). Per the docs, "Endpoint behavior
      // is to send nothing in the body" — fetch must not set content-type.
      const res = await fetchImpl(`${apiBase}/users/get_current_account`, {
        method: 'POST',
        headers: { authorization: authHeader },
      })
      if (!res.ok) {
        throw new Error(`Dropbox users/get_current_account failed: http_${res.status}`)
      }
      const json = (await res.json().catch(() => ({}))) as RawAccount
      if (!json.account_id || !json.email) {
        const present = Object.keys(json).join(',') || 'empty'
        throw new Error(
          `Dropbox users/get_current_account missing account_id or email (got: ${present})`,
        )
      }
      return {
        accountId: json.account_id,
        email: json.email,
        displayName: json.name?.display_name,
      }
    },

    async ensureBaseoutFolder(spaceId: string): Promise<DropboxFolderResult> {
      const path = buildBaseoutFolderPath(spaceId)
      const res = await fetchImpl(`${apiBase}/files/create_folder_v2`, {
        method: 'POST',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path, autorename: false }),
      })
      if (res.ok) {
        return { path, preExisting: false }
      }
      if (res.status === 409) {
        // Swallow path/conflict/folder — the folder already exists. Any
        // other 409 (path/conflict/file, etc.) is a real error.
        const body = (await res.json().catch(() => ({}))) as RawCreateFolderError
        const pathConflict = body.error?.path?.['.tag']
        if (pathConflict === 'conflict' || pathConflict === 'folder') {
          return { path, preExisting: true }
        }
        throw new Error(
          `Dropbox files/create_folder_v2 conflict: ${body.error_summary ?? pathConflict ?? 'unknown'}`,
        )
      }
      throw new Error(`Dropbox files/create_folder_v2 failed: http_${res.status}`)
    },
  }
}
