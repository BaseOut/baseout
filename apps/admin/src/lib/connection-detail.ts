// Pure assembly for the /connections/[id] drill-in (admin-crm-ux Task 3.1).
// Classifies health, summarizes session locks (active vs. stale), orders the
// status-flip history, and sorts served spaces — all in memory (house style,
// testable without a DB). Metadata only: never token values or *_enc data.

import { classifyConnection, type ConnectionHealth, type ConnectionRow } from './connection-health'

export interface ConnStatusFlip {
  oldStatus: string | null
  newStatus: string
  changedAt: Date
  applicationName: string | null
  dbUser: string
}
export interface ConnSession {
  lockedBy: string
  startedAt: Date
  expiresAt: Date
}
export interface ServedSpace {
  id: string
  name: string
  status: string
}

export interface ConnectionDetailView {
  health: ConnectionHealth
  sessionSummary: { total: number; active: number; stale: number }
  statusHistory: ConnStatusFlip[] // newest first
  servedSpaces: ServedSpace[] // name-sorted
}

export function buildConnectionDetail(
  input: {
    connection: ConnectionRow
    sessions: ConnSession[]
    statusAudit: ConnStatusFlip[]
    servedSpaces: ServedSpace[]
  },
  now: Date,
): ConnectionDetailView {
  const stale = input.sessions.filter((s) => s.expiresAt.getTime() < now.getTime()).length
  return {
    health: classifyConnection(input.connection, now),
    sessionSummary: {
      total: input.sessions.length,
      active: input.sessions.length - stale,
      stale,
    },
    statusHistory: [...input.statusAudit].sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime()),
    servedSpaces: [...input.servedSpaces].sort((a, b) => a.name.localeCompare(b.name)),
  }
}
