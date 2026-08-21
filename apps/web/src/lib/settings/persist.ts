import { authClient } from '../auth-client'

export interface PersistResult {
  ok: boolean
  error?: string
}

async function jsonFetch(
  url: string,
  init: RequestInit,
  fallbackError: string,
): Promise<PersistResult> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      credentials: 'same-origin',
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: fallbackError }
  } catch {
    return { ok: false, error: fallbackError }
  }
}

export async function persistAccountName(name: string): Promise<PersistResult> {
  try {
    const { error } = await authClient.updateUser({ name })
    if (error) {
      return { ok: false, error: 'Could not save your name. Try again.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not save your name. Try again.' }
  }
}

export function persistSpaceName(spaceId: string, name: string): Promise<PersistResult> {
  return jsonFetch(
    `/api/spaces/${encodeURIComponent(spaceId)}`,
    { method: 'PATCH', body: JSON.stringify({ name }) },
    'Could not save the Space name. Try again.',
  )
}

export function persistSpaceAutoAdd(spaceId: string, on: boolean): Promise<PersistResult> {
  return jsonFetch(
    `/api/spaces/${encodeURIComponent(spaceId)}/backup-config`,
    { method: 'PATCH', body: JSON.stringify({ autoAddFutureBases: on }) },
    'Could not save auto-add. Try again.',
  )
}
