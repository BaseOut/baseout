import { atom } from 'nanostores'
import type { DashboardModel } from '../lib/dashboard'
import { $spaces } from './spaces'

export interface DashboardState {
  model: DashboardModel
  hasAirtableConnection: boolean
}

export const $dashboard = atom<DashboardState | null>(null)

export async function refreshDashboard(): Promise<void> {
  const res = await fetch('/api/dashboard', {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return
  const body = (await res.json()) as DashboardState
  $dashboard.set(body)
}

let initialized = false
let lastSpaceId: string | null = null
$spaces.subscribe((state) => {
  const id = state?.activeSpaceId ?? null
  if (!initialized) {
    initialized = true
    lastSpaceId = id
    return
  }
  if (id === lastSpaceId) return
  lastSpaceId = id
  if (id) void refreshDashboard()
})
