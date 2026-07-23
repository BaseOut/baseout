// Peek-sidebar summarizers (admin-entity-linking D4). Each maps a queried row to
// the closed { title, subtitle, href, badges, stats } shape so the client
// renderer never branches per type. Pure + metadata-only (no secrets — asserted
// in the test). The endpoint switches over these; the island fetches + renders.

import { entityHref } from './entity-link'

export type PeekType = 'org' | 'space' | 'user' | 'connection' | 'backup_run'

export interface PeekSummary {
  type: PeekType
  title: string
  subtitle: string | null
  href: string
  badges: { label: string; tone: 'success' | 'warning' | 'error' | 'default' }[]
  stats: { label: string; value: string }[]
}

const fmt = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '—')

export function summarizeOrg(r: { id: string; name: string; slug: string; createdAt: Date; spaceCount: number; memberCount: number }): PeekSummary {
  return {
    type: 'org',
    title: r.name,
    subtitle: r.slug,
    href: entityHref('org', r.id),
    badges: [],
    stats: [
      { label: 'Spaces', value: String(r.spaceCount) },
      { label: 'Members', value: String(r.memberCount) },
      { label: 'Created', value: fmt(r.createdAt) },
    ],
  }
}

export function summarizeSpace(r: { id: string; name: string; status: string; orgName: string | null; baseCount: number }): PeekSummary {
  return {
    type: 'space',
    title: r.name,
    subtitle: r.orgName,
    href: entityHref('space', r.id),
    badges: [{ label: r.status, tone: r.status === 'active' ? 'success' : r.status === 'error' ? 'error' : 'default' }],
    stats: [{ label: 'Bases', value: String(r.baseCount) }],
  }
}

export function summarizeUser(r: { id: string; email: string; name: string | null; role: string; lastSeenAt: Date | null }): PeekSummary {
  return {
    type: 'user',
    title: r.name ?? r.email,
    subtitle: r.email,
    href: entityHref('user', r.id),
    badges: r.role === 'super' ? [{ label: 'super', tone: 'default' }] : [],
    stats: [{ label: 'Last seen', value: r.lastSeenAt ? fmt(r.lastSeenAt) : 'never' }],
  }
}

export function summarizeConnection(r: { id: string; displayName: string | null; status: string; orgName: string | null }): PeekSummary {
  return {
    type: 'connection',
    title: r.displayName ?? 'Connection',
    subtitle: r.orgName,
    href: entityHref('connection', r.id),
    badges: [{ label: r.status, tone: r.status === 'active' ? 'success' : r.status === 'invalid' ? 'error' : 'warning' }],
    stats: [],
  }
}

export function summarizeBackupRun(r: { id: string; status: string; kind: string; recordCount: number | null; completedAt: Date | null; spaceName: string | null }): PeekSummary {
  return {
    type: 'backup_run',
    title: `${r.kind} backup`,
    subtitle: r.spaceName,
    href: entityHref('backup_run', r.id),
    badges: [{ label: r.status, tone: r.status === 'succeeded' ? 'success' : r.status === 'failed' ? 'error' : 'default' }],
    stats: [
      { label: 'Records', value: r.recordCount != null ? String(r.recordCount) : '—' },
      { label: 'Completed', value: fmt(r.completedAt) },
    ],
  }
}
