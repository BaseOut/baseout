/**
 * Minimal Google Drive v3 + OAuth2 userinfo client wrappers.
 *
 * Two methods we need at OAuth-callback time:
 *  - getUserEmail() → for display ("Connected as alice@example.com")
 *  - createBackoutFolder(spaceId) → creates a "Baseout-<spaceId>" folder
 *    in the user's Drive and returns its file ID. We persist this ID as
 *    storage_destinations.provider_folder_id; future backups upload CSVs
 *    into this folder via `files.create` with `parents: [folderId]`.
 *
 * Drive scope is `drive.file` — Baseout can only see/touch files it
 * itself creates. No access to the rest of the user's Drive.
 */

import { GOOGLE_DRIVE_API_BASE, GOOGLE_USERINFO_URL } from './config'

export interface GoogleDriveClientOptions {
  accessToken: string
  /** Override for the userinfo endpoint (testing). */
  userinfoUrl?: string
  /** Override for the Drive API base (testing). */
  driveApiBase?: string
}

export interface GoogleUserinfo {
  /** Stable Google account ID. */
  sub: string
  /** User's email — used for `oauth_account_email` display. */
  email: string
  name?: string
  picture?: string
}

interface RawUserinfo {
  sub?: string
  email?: string
  name?: string
  picture?: string
}

interface RawDriveFile {
  id?: string
  name?: string
  mimeType?: string
}

export interface GoogleDriveClient {
  getUserInfo(): Promise<GoogleUserinfo>
  createBaseoutFolder(spaceId: string): Promise<{ id: string; name: string }>
}

export function createGoogleDriveClient(
  opts: GoogleDriveClientOptions,
): GoogleDriveClient {
  const userinfoUrl = opts.userinfoUrl ?? GOOGLE_USERINFO_URL
  const driveApiBase = opts.driveApiBase ?? GOOGLE_DRIVE_API_BASE

  const authHeader = `Bearer ${opts.accessToken}`

  return {
    async getUserInfo(): Promise<GoogleUserinfo> {
      const res = await fetch(userinfoUrl, {
        headers: { authorization: authHeader },
      })
      if (!res.ok) {
        throw new Error(`Google userinfo failed: http_${res.status}`)
      }
      const json = (await res.json().catch(() => ({}))) as RawUserinfo
      if (!json.sub || !json.email) {
        // Surface which fields ARE present so the operator can tell whether
        // the consent screen granted the right scopes. Email comes from the
        // `email` OAuth scope; sub comes from `openid` (or `profile`).
        const present = Object.keys(json).join(',') || 'empty'
        throw new Error(`Google userinfo missing sub or email (got: ${present})`)
      }
      return {
        sub: json.sub,
        email: json.email,
        name: json.name,
        picture: json.picture,
      }
    },

    async createBaseoutFolder(spaceId: string) {
      const res = await fetch(`${driveApiBase}/files`, {
        method: 'POST',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: `Baseout-${spaceId}`,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      if (!res.ok) {
        throw new Error(`Google Drive folder create failed: http_${res.status}`)
      }
      const json = (await res.json().catch(() => ({}))) as RawDriveFile
      if (!json.id) {
        throw new Error('Google Drive folder create returned no id')
      }
      return { id: json.id, name: json.name ?? `Baseout-${spaceId}` }
    },
  }
}
