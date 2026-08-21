// Pure query layer for the Data ▸ Comments read route (server-comments-read,
// paired READ side of server-comments capture). No I/O — builds parameterized
// Drizzle SQL fragments (never string-concatenated values), parses the optional
// filters, and encodes/decodes the opaque keyset cursor. The -io side executes
// these against the per-Space `bo_at_comments` table. Unit-tested via
// PgDialect().sqlToQuery, mirroring record-read.ts.
//
// bo_at_comments is the capture-side table written by comments-sync.ts (schema:
// packages/db-schema/src/space/pg.ts `comments`). This module only READS it.

import { sql, type SQL } from 'drizzle-orm'

// ── Keyset cursor codec ──────────────────────────────────────────────────────
// Cursor = base64url(JSON({createdAt, commentId})). The feed orders newest-first
// (airtable_created_at desc nulls last) with airtable_comment_id as the total-
// order tiebreak (it carries a unique index). `createdAt === null` marks the
// NULLS-LAST tail. Keyset, never offset — mirrors record-read.ts.

export interface CommentsCursor {
  /** ISO of airtable_created_at, or null once paging reaches the null tail. */
  createdAt: string | null
  /** airtable_comment_id — unique tiebreak (bo_at_comments_comment_uq). */
  commentId: string
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function encodeCommentsCursor(c: CommentsCursor): string {
  return b64urlEncode(JSON.stringify({ c: c.createdAt, i: c.commentId }))
}

export function decodeCommentsCursor(token: string): CommentsCursor | null {
  if (!token) return null
  const json = b64urlDecode(token)
  if (json === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const o = parsed as Record<string, unknown>
  if (typeof o.i !== 'string') return null
  if (o.c !== null && typeof o.c !== 'string') return null
  return { createdAt: o.c as string | null, commentId: o.i }
}

// ── Filters ──────────────────────────────────────────────────────────────────
// Optional, all parameterized. Matches web DataCommentsQuery (baseId, tableId,
// status) plus cursor/limit handled at the route.

export type CommentStatusFilter = 'active' | 'deleted'

export interface CommentsFilters {
  baseId?: string
  tableId?: string
  status?: CommentStatusFilter
}

/** Parse baseId / tableId / status query params. Unknown status is an error
 *  (the value is dropped, never the query) — mirrors parseSort's leniency. */
export function parseCommentsFilters(sp: URLSearchParams): {
  filters: CommentsFilters
  errors: string[]
} {
  const filters: CommentsFilters = {}
  const errors: string[] = []
  const baseId = sp.get('baseId')
  const tableId = sp.get('tableId')
  const status = sp.get('status')
  if (baseId) filters.baseId = baseId
  if (tableId) filters.tableId = tableId
  if (status) {
    if (status === 'active' || status === 'deleted') filters.status = status
    else errors.push('status: expected active or deleted')
  }
  return { filters, errors }
}

/** WHERE predicate for the filters (parameterized), or null when unfiltered. */
export function buildCommentsWhere(f: CommentsFilters): SQL | null {
  const parts: SQL[] = []
  if (f.baseId) parts.push(sql`base_id = ${f.baseId}`)
  if (f.tableId) parts.push(sql`airtable_table_id = ${f.tableId}`)
  if (f.status) parts.push(sql`status = ${f.status}`)
  if (parts.length === 0) return null
  return parts.reduce((acc, p) => sql`${acc} and ${p}`)
}

/** ORDER BY for the page query — newest-first, NULLS LAST, unique tiebreak. */
export function commentsOrderBy(): SQL {
  return sql`airtable_created_at desc nulls last, airtable_comment_id desc`
}

/** "Row strictly after the cursor" for the desc-nulls-last keyset. `null` when
 *  there is no cursor. Once `createdAt` is null we are in the NULLS-LAST tail. */
export function commentsKeysetAfter(cursor: CommentsCursor | null): SQL | null {
  if (!cursor) return null
  const cid = cursor.commentId
  if (cursor.createdAt === null) {
    return sql`(airtable_created_at is null and airtable_comment_id < ${cid})`
  }
  const v = cursor.createdAt
  return sql`(airtable_created_at < ${v}::timestamptz or airtable_created_at is null or (airtable_created_at = ${v}::timestamptz and airtable_comment_id < ${cid}))`
}

// ── Row mapping ────────────────────────────────────────────────────────────────
// One raw bo_at_comments row → the wire shape the web engine-client consumes.
// parentCommentId + mentioned are pulled from the verbatim Airtable payload in
// `raw` (defensively; a malformed/absent field yields null, never a throw).
// Attachments + reactions are deliberately NOT surfaced in this first read slice
// (comment attachments live in the separate bo_at_comment_attachments table).

export interface CommentDbRow {
  airtable_comment_id: string
  airtable_record_id: string
  airtable_table_id: string
  base_id: string
  author: unknown
  text: string | null
  airtable_created_at: unknown
  airtable_last_updated_at: unknown
  last_seen_at: unknown
  status: string
  raw: unknown
}

export interface CommentWireRow {
  commentId: string
  recordId: string
  tableId: string
  baseId: string
  /** {id, email, name} as captured, or null. */
  author: unknown
  text: string | null
  createdTime: string | null
  lastUpdatedTime: string | null
  /** Timestamp of the most recent capture that still held this comment. */
  lastSeenAt: string | null
  status: string
  /** Airtable parentCommentId (threaded reply) — carried; thread view is later. */
  parentCommentId: string | null
  /** Airtable `mentioned` map (id → mention), verbatim; null when absent. */
  mentioned: Record<string, unknown> | null
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function tsIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

export function mapCommentRow(r: CommentDbRow): CommentWireRow {
  const raw = isRecord(r.raw) ? r.raw : null
  const parentCommentId =
    raw && typeof raw.parentCommentId === 'string' ? raw.parentCommentId : null
  const mentioned = raw && isRecord(raw.mentioned) ? raw.mentioned : null
  return {
    commentId: r.airtable_comment_id,
    recordId: r.airtable_record_id,
    tableId: r.airtable_table_id,
    baseId: r.base_id,
    author: r.author ?? null,
    text: r.text,
    createdTime: tsIso(r.airtable_created_at),
    lastUpdatedTime: tsIso(r.airtable_last_updated_at),
    lastSeenAt: tsIso(r.last_seen_at),
    status: r.status,
    parentCommentId,
    mentioned,
  }
}

/** The keyset cursor that points AT a given wire row (for nextCursor). */
export function commentCursorFor(row: CommentWireRow): CommentsCursor {
  return { createdAt: row.createdTime, commentId: row.commentId }
}
