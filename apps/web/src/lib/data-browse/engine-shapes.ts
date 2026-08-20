/**
 * Wire shapes for Data browse engine responses.
 * Kept here for Task 1 (pure mappers). Task 2 re-exports / moves these onto
 * `backup-engine.ts` when the client methods land — map imports stay stable
 * via this module until then.
 */

import type { SchemaDocsError } from '../backup-engine'

/** One record page row — `fields` is fieldId → captured cell value. */
export interface DataRecordRow {
  recordId: string
  createdTime: string | null
  modifiedTime: string | null
  status: string
  fields: Record<string, unknown>
}

export type GetDataRecordsResult =
  | {
      ok: true
      records: DataRecordRow[]
      nextCursor: string | null
      total: number
      approximate: boolean
      filterErrors: string[]
    }
  | SchemaDocsError

export interface DataRecordsQuery {
  filters?: string
  sort?: string
  cursor?: string
  limit?: number
  fields?: string
}

export interface DataChangelogRunRollup {
  runId: string
  startedAt: string | null
  completedAt: string | null
  createdCount: number
  updatedCount: number
  deletedCount: number
}

export interface DataChangelogChangeRow {
  recordId: string
  tableId: string | null
  baseId: string | null
  changeType: 'created' | 'updated' | 'deleted'
  createdTime: string | null
  modifiedTime: string | null
  status: string | null
  changedFieldIds?: string[]
}

export type GetDataChangelogResult =
  | { ok: true; mode: 'rollup'; runs: DataChangelogRunRollup[]; nextCursor: string | null }
  | {
      ok: true
      mode: 'rows'
      runId: string
      changeType: string
      rows: DataChangelogChangeRow[]
      nextCursor: string | null
    }
  | SchemaDocsError

export interface DataChangelogQuery {
  runId?: string
  changeType?: string
  baseId?: string
  tableId?: string
  fieldId?: string
  fromRun?: string
  toRun?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export interface DataCommentRow {
  commentId: string
  recordId: string
  tableId: string
  baseId: string
  author: unknown
  text: string | null
  createdTime: string | null
  lastUpdatedTime: string | null
  lastSeenAt: string | null
  status: string
  parentCommentId: string | null
  mentioned: Record<string, unknown> | null
}

export type GetDataCommentsResult =
  | {
      ok: true
      comments: DataCommentRow[]
      nextCursor: string | null
      total: number
      approximate: boolean
    }
  | SchemaDocsError

export interface DataCommentsQuery {
  baseId?: string
  tableId?: string
  status?: string
  cursor?: string
  limit?: number
}

export interface MediaAssetRef {
  attachmentId: string
  baseId: string
  tableId: string
  recordId: string
  fieldId: string
  filename: string | null
  status: string
}

export interface MediaAssetView {
  id: string
  checksum: string
  contentType: string | null
  contentClass: string
  sizeBytes: number | null
  storageKind: string | null
  storageProvider: string | null
  storageRef: string | null
  thumbnailStatus: string
  thumbnailKey: string | null
  firstSeenAt: string | null
  lastSeenAt: string | null
  refs: MediaAssetRef[]
}

export type GetMediaResult =
  | { ok: true; items: MediaAssetView[]; nextCursor: string | null }
  | SchemaDocsError

export type GetMediaTotalsResult =
  | { ok: true; count: number; sizeBytes: number }
  | SchemaDocsError

export type GetMediaAssetResult = { ok: true; asset: MediaAssetView } | SchemaDocsError

export interface MediaQuery {
  class?: string
  baseId?: string
  tableId?: string
  minSize?: number
  maxSize?: number
  after?: string
  cursor?: string
  limit?: number
}
