/**
 * Minimal Microsoft Graph client (OneDrive AppFolder).
 *
 * Two operations only: identify the connected user (for audit) and ensure
 * the per-Space `Baseout-<spaceId>` folder exists under the app folder.
 * Used by the OAuth callback to seed `storage_destinations.provider_folder_id`
 * + `oauth_account_email`. The workflows writer (commit 3/3) does the heavy
 * CSV-upload work via the upload-session protocol.
 *
 * Because the Azure App requests the `Files.ReadWrite.AppFolder` scope,
 * Microsoft Graph sandboxes us to a per-user `/Apps/<AppDisplayName>/`
 * folder. We address it via `/me/drive/special/approot`; from the API's
 * perspective the approot IS the visible root. A `Baseout-<spaceId>`
 * subfolder under approot appears at `/Apps/<AppDisplayName>/Baseout-<spaceId>`
 * in the user's view. Multi-Space layout still works: each Space gets its
 * own `Baseout-<spaceId>` directory.
 *
 * OneDrive folder model vs Dropbox / Drive:
 *   - DriveItem IDs are opaque alphanumeric strings (e.g. "01ABCDEF...").
 *     `providerFolderId` stores the DriveItem id of the per-Space folder,
 *     NOT a path string (unlike Dropbox).
 *   - Path-syntax lookups use `:/<encoded-name>:` segments to address an
 *     item by its name under a parent. ID-syntax lookups use
 *     `/drive/items/<id>`. We use path-syntax for the initial lookup and
 *     id-syntax for follow-up operations.
 *   - User identity comes from GET /me; `mail` is the work/school email
 *     and is null on personal MSA accounts, where `userPrincipalName`
 *     carries the email-like login string. Fall back accordingly.
 */

import { MICROSOFT_GRAPH_BASE } from './config'

export class OneDriveAuthError extends Error {
  constructor(message = 'OneDrive access token is not valid') {
    super(message)
    this.name = 'OneDriveAuthError'
  }
}

export class OneDriveApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'OneDriveApiError'
  }
}

export interface OneDriveAccount {
  id: string
  /** Work/school primary SMTP address. NULL on personal MSA accounts. */
  mail?: string | null
  /** Email-like login string. Populated on personal MSA accounts. */
  userPrincipalName?: string | null
}

export interface OneDriveFolder {
  /** DriveItem `id` — opaque, used for follow-up Graph calls. */
  id: string
  /** Human-readable name (e.g. "Baseout-<spaceId>"). */
  name: string
}

export interface OneDriveClientOptions {
  accessToken: string
  fetchImpl?: typeof fetch
  graphBase?: string
}

export interface OneDriveClient {
  me(): Promise<OneDriveAccount>
  ensureBaseoutFolder(folderName: string): Promise<OneDriveFolder>
}

interface DriveItemResponse {
  id: string
  name: string
  folder?: { childCount?: number }
}

function assertFolderNameSafe(name: string): void {
  if (!name || name.length === 0) {
    throw new Error('folder name must not be empty')
  }
  if (name.length > 200) {
    throw new Error('folder name too long')
  }
  if (
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..') ||
    name.startsWith('.') ||
    name.endsWith('.')
  ) {
    throw new Error('folder name contains illegal characters')
  }
}

async function authedFetch(
  url: string,
  init: RequestInit,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const merged: RequestInit = {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  }
  const res = await fetchImpl(url, merged)
  if (res.status === 401) throw new OneDriveAuthError()
  return res
}

export function createOneDriveClient(
  opts: OneDriveClientOptions,
): OneDriveClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const graphBase = (opts.graphBase ?? MICROSOFT_GRAPH_BASE).replace(/\/$/, '')

  async function me(): Promise<OneDriveAccount> {
    const res = await authedFetch(
      `${graphBase}/me?$select=id,mail,userPrincipalName`,
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new OneDriveApiError(
        res.status,
        `Microsoft Graph /me ${res.status}: ${body.slice(0, 200)}`,
      )
    }
    return (await res.json()) as OneDriveAccount
  }

  async function ensureBaseoutFolder(
    folderName: string,
  ): Promise<OneDriveFolder> {
    assertFolderNameSafe(folderName)
    const encoded = encodeURIComponent(folderName)

    // 1. Try path-syntax lookup under the approot. 200 = exists, 404 = create.
    const lookupUrl =
      `${graphBase}/me/drive/special/approot:/${encoded}` +
      `?$select=id,name,folder`
    const lookup = await authedFetch(
      lookupUrl,
      { method: 'GET' },
      opts.accessToken,
      fetchImpl,
    )
    if (lookup.ok) {
      const json = (await lookup.json()) as DriveItemResponse
      return { id: json.id, name: json.name }
    }
    if (lookup.status !== 404) {
      const body = await lookup.text().catch(() => '')
      throw new OneDriveApiError(
        lookup.status,
        `Microsoft Graph approot:/${folderName} lookup ${lookup.status}: ${body.slice(0, 200)}`,
      )
    }

    // 2. Missing — POST under approot/children with conflictBehavior=fail.
    //    A second writer that won the race surfaces as 409; we re-lookup.
    const createUrl = `${graphBase}/me/drive/special/approot/children`
    const create = await authedFetch(
      createUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      },
      opts.accessToken,
      fetchImpl,
    )
    if (create.ok) {
      const json = (await create.json()) as DriveItemResponse
      return { id: json.id, name: json.name }
    }
    if (create.status === 409) {
      // Race — another writer created it between our lookup and our create.
      // Re-lookup and reuse.
      const refetch = await authedFetch(
        lookupUrl,
        { method: 'GET' },
        opts.accessToken,
        fetchImpl,
      )
      if (refetch.ok) {
        const json = (await refetch.json()) as DriveItemResponse
        return { id: json.id, name: json.name }
      }
      const body = await refetch.text().catch(() => '')
      throw new OneDriveApiError(
        refetch.status,
        `Microsoft Graph approot:/${folderName} re-lookup ${refetch.status}: ${body.slice(0, 200)}`,
      )
    }
    const body = await create.text().catch(() => '')
    throw new OneDriveApiError(
      create.status,
      `Microsoft Graph approot/children ${create.status}: ${body.slice(0, 200)}`,
    )
  }

  return { me, ensureBaseoutFolder }
}
