/**
 * Minimal Box Content API client.
 *
 * Two operations only: identify the connected user (for audit) and look up /
 * create the per-Space `Baseout-<spaceId>` folder at the account root. Used by
 * the OAuth callback to seed `storage_destinations.provider_folder_id`. The
 * writer in apps/workflows (commit 3/3) does the heavy CSV-upload work.
 *
 * Box folder model differs from Drive:
 *   - Folders are identified by numeric IDs (as strings). The root folder is
 *     the literal string '0'.
 *   - Folder listing is via GET /folders/:id/items, not a query like Drive's
 *     /drive/v3/files?q=...
 *   - Folder creation: POST /folders { name, parent: { id } }.
 */

import { BOX_API_BASE, BOX_ROOT_FOLDER_ID } from './config'

export class BoxAuthError extends Error {
  constructor(message = 'Box access token is not valid') {
    super(message)
    this.name = 'BoxAuthError'
  }
}

export class BoxApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'BoxApiError'
  }
}

export interface BoxFolder {
  id: string
  name: string
}

export interface BoxCurrentUser {
  id: string
  /** Box's `login` field — the user's email address. */
  login?: string
  name?: string
}

export interface BoxClientOptions {
  accessToken: string
  fetchImpl?: typeof fetch
  apiBase?: string
}

export interface BoxClient {
  getCurrentUser(): Promise<BoxCurrentUser>
  ensureBaseoutFolder(folderName: string): Promise<BoxFolder>
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
  if (res.status === 401) throw new BoxAuthError()
  return res
}

export function createBoxClient(opts: BoxClientOptions): BoxClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const apiBase = (opts.apiBase ?? BOX_API_BASE).replace(/\/$/, '')

  async function getCurrentUser(): Promise<BoxCurrentUser> {
    const res = await authedRequest(
      `${apiBase}/users/me?fields=id,login,name`,
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new BoxApiError(
        res.status,
        `Box users/me ${res.status}: ${body.slice(0, 200)}`,
      )
    }
    return (await res.json()) as BoxCurrentUser
  }

  async function ensureBaseoutFolder(folderName: string): Promise<BoxFolder> {
    // Box folder names cannot contain `/` or `\`. Refuse early — the create
    // call would 400, but a clear local error helps debugging.
    if (folderName.includes('/') || folderName.includes('\\')) {
      throw new Error('folder name contains an illegal path separator')
    }
    if (folderName.length === 0 || folderName.length > 255) {
      throw new Error('folder name must be 1..255 chars')
    }

    // 1. List root items and look for a matching folder. `fields` keeps the
    //    response small; `limit=1000` is Box's max page size — sufficient for
    //    any reasonable root (Baseout-<uuid> folders are unique by Space).
    const listUrl = new URL(
      `${apiBase}/folders/${BOX_ROOT_FOLDER_ID}/items`,
    )
    listUrl.searchParams.set('fields', 'type,id,name')
    listUrl.searchParams.set('limit', '1000')
    const listRes = await authedRequest(
      listUrl.toString(),
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => '')
      throw new BoxApiError(
        listRes.status,
        `Box folders/0/items ${listRes.status}: ${body.slice(0, 200)}`,
      )
    }
    const listJson = (await listRes.json()) as {
      entries?: Array<{ type?: string; id?: string; name?: string }>
    }
    const existing = (listJson.entries ?? []).find(
      (e) => e.type === 'folder' && e.name === folderName,
    )
    if (existing && existing.id) {
      return { id: existing.id, name: existing.name ?? folderName }
    }

    // 2. Create the folder at the root.
    const createRes = await authedRequest(
      `${apiBase}/folders`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          parent: { id: BOX_ROOT_FOLDER_ID },
        }),
      },
      opts.accessToken,
      fetchImpl,
    )
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '')
      throw new BoxApiError(
        createRes.status,
        `Box POST /folders ${createRes.status}: ${body.slice(0, 200)}`,
      )
    }
    const createJson = (await createRes.json()) as { id: string; name: string }
    return { id: createJson.id, name: createJson.name }
  }

  return { getCurrentUser, ensureBaseoutFolder }
}
