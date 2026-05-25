/**
 * Minimal Google Drive v3 client.
 *
 * Two operations only: lookup `Baseout-<spaceId>` under the user's root, and
 * create it if absent. Used by the OAuth callback to seed
 * `storage_destinations.provider_folder_id`. The writer in apps/workflows
 * does the heavy upload work via its own resumable-upload code path.
 */

import { GOOGLE_DRIVE_API_BASE } from './config'

export class GoogleDriveAuthError extends Error {
  constructor(message = 'Google Drive access token is not valid') {
    super(message)
    this.name = 'GoogleDriveAuthError'
  }
}

export class GoogleDriveApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GoogleDriveApiError'
  }
}

export interface DriveFolder {
  id: string
  name: string
}

export interface DriveAbout {
  user: { emailAddress?: string; permissionId?: string }
}

export interface GoogleDriveClientOptions {
  accessToken: string
  fetchImpl?: typeof fetch
  apiBase?: string
}

export interface GoogleDriveClient {
  about(): Promise<DriveAbout>
  ensureBaseoutFolder(folderName: string): Promise<DriveFolder>
}

async function authedRequest(
  url: string,
  init: RequestInit,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const res = await fetchImpl(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  })
  if (res.status === 401) throw new GoogleDriveAuthError()
  return res
}

export function createGoogleDriveClient(
  opts: GoogleDriveClientOptions,
): GoogleDriveClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const apiBase = (opts.apiBase ?? GOOGLE_DRIVE_API_BASE).replace(/\/$/, '')

  async function about(): Promise<DriveAbout> {
    const res = await authedRequest(
      `${apiBase}/drive/v3/about?fields=user(emailAddress,permissionId)`,
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new GoogleDriveApiError(
        res.status,
        `Drive about ${res.status}: ${body.slice(0, 200)}`,
      )
    }
    return (await res.json()) as DriveAbout
  }

  async function ensureBaseoutFolder(folderName: string): Promise<DriveFolder> {
    // 1. Look up by name under root + drive.file scope (not trashed).
    // `q` must be url-encoded carefully — folder names with apostrophes will
    // break the query if unsanitized. We refuse names that contain quotes.
    if (folderName.includes("'") || folderName.includes('"')) {
      throw new Error('folder name contains an illegal quote character')
    }
    const q = `name = '${folderName}' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const listUrl = new URL(`${apiBase}/drive/v3/files`)
    listUrl.searchParams.set('q', q)
    listUrl.searchParams.set('fields', 'files(id,name)')
    listUrl.searchParams.set('spaces', 'drive')
    const listRes = await authedRequest(
      listUrl.toString(),
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => '')
      throw new GoogleDriveApiError(
        listRes.status,
        `Drive files.list ${listRes.status}: ${body.slice(0, 200)}`,
      )
    }
    const listJson = (await listRes.json()) as {
      files?: Array<{ id: string; name: string }>
    }
    const found = listJson.files?.[0]
    if (found) return { id: found.id, name: found.name }

    // 2. Create at root.
    const createRes = await authedRequest(
      `${apiBase}/drive/v3/files?fields=id,name`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['root'],
        }),
      },
      opts.accessToken,
      fetchImpl,
    )
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '')
      throw new GoogleDriveApiError(
        createRes.status,
        `Drive files.create ${createRes.status}: ${body.slice(0, 200)}`,
      )
    }
    const createJson = (await createRes.json()) as { id: string; name: string }
    return { id: createJson.id, name: createJson.name }
  }

  return { about, ensureBaseoutFolder }
}
