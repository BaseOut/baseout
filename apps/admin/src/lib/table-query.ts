// Shared, URL-driven table-query planner for every admin listing page.
//
// admin-crm-ux design D2: a *pure* planner — parse + validate + plan only,
// never touches the DB, so it is fully unit-testable (house style preserved).
// Each listing page declares a TableSpec (the whitelist of sort keys, filter
// keys + allowed values, and defaults), builds its own Drizzle query from the
// returned plan, and renders the shared table chrome from these href builders.
//
// Security (design D2 / admin-table-infra spec): user input never becomes a
// SQL identifier — `sort` is validated against the spec's key whitelist and the
// page maps the key to a known Drizzle column; unknown/invalid values fall back
// to defaults and never error.

export type SortDir = 'asc' | 'desc'

/** One filterable column. Omit `allowed` for a free-form id filter (e.g.
 *  `org=<uuid>`) whose value is used only as a parameterized SQL predicate. */
export interface TableFilterSpec {
  key: string
  allowed?: readonly string[]
}

export interface TableSpec {
  /** Whitelisted sort keys; the page maps these to Drizzle columns. */
  sortKeys: readonly string[]
  defaultSort: string
  /** Direction used on load and when a not-yet-active column is selected. */
  defaultDir?: SortDir
  /** Declared filter columns (enum or free-form id). */
  filters?: readonly TableFilterSpec[]
  /** Whether this listing honors `?q=` free-text search. */
  searchable?: boolean
  /** Allowed page sizes. */
  perOptions?: readonly number[]
  defaultPer?: number
}

export interface TableQuery {
  page: number // 1-based, lower-clamped to 1 (upper clamp needs total → pageInfo)
  per: number
  offset: number
  sort: string
  dir: SortDir
  q: string | null
  filters: Record<string, string>
}

export interface PageInfo {
  total: number
  totalPages: number
  clampedPage: number
  from: number
  to: number
  hasPrev: boolean
  hasNext: boolean
  offset: number
}

const DEFAULT_PER_OPTIONS = [25, 50, 100] as const
const Q_MAX = 200

function toPositiveInt(raw: string | null): number | null {
  if (raw === null) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isSafeInteger(n) ? n : null
}

/**
 * Parse a request URL into a whitelist-validated table-query plan. Every
 * invalid or unknown value falls back to a spec default — this never throws.
 */
export function parseTableQuery(url: URL, spec: TableSpec): TableQuery {
  const sp = url.searchParams
  const perOptions = spec.perOptions ?? DEFAULT_PER_OPTIONS
  const defaultPer = spec.defaultPer ?? 50
  const defaultDir: SortDir = spec.defaultDir ?? 'desc'

  const perRaw = toPositiveInt(sp.get('per'))
  const per = perRaw !== null && perOptions.includes(perRaw) ? perRaw : defaultPer

  const pageRaw = toPositiveInt(sp.get('page'))
  const page = pageRaw !== null && pageRaw >= 1 ? pageRaw : 1

  const sortRaw = sp.get('sort')
  const sort = sortRaw !== null && spec.sortKeys.includes(sortRaw) ? sortRaw : spec.defaultSort

  const dirRaw = sp.get('dir')
  const dir: SortDir = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : defaultDir

  let q: string | null = null
  if (spec.searchable) {
    const raw = sp.get('q')
    const trimmed = raw?.trim() ?? ''
    q = trimmed ? trimmed.slice(0, Q_MAX) : null
  }

  const filters: Record<string, string> = {}
  for (const f of spec.filters ?? []) {
    const raw = sp.get(f.key)
    if (raw === null) continue
    const value = raw.trim()
    if (!value) continue
    if (f.allowed) {
      if (f.allowed.includes(value)) filters[f.key] = value
    } else {
      filters[f.key] = value.slice(0, Q_MAX)
    }
  }

  return { page, per, offset: (page - 1) * per, sort, dir, q, filters }
}

/**
 * Given the total matching-row count, derive pager display state. `clampedPage`
 * (and `offset`) clamp a page past the end back to the last page.
 */
export function pageInfo(total: number, page: number, per: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / per))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  const offset = (clampedPage - 1) * per
  return {
    total,
    totalPages,
    clampedPage,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(clampedPage * per, total),
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
    offset,
  }
}

// ── href builders ──────────────────────────────────────────────────────────
// All take the *current* URLSearchParams so generated links preserve every
// sibling parameter the spec doesn't know about.

/** Clone `current`, apply `changes` (null deletes), return a `?…` query string
 *  (empty string when no params remain). */
export function withParams(
  current: URLSearchParams,
  changes: Record<string, string | number | null>,
): string {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) next.delete(key)
    else next.set(key, String(value))
  }
  const s = next.toString()
  return s ? `?${s}` : ''
}

/** Next direction when a column header is clicked: flip if it is the active
 *  sort column, otherwise start ascending. */
export function nextSortDir(current: URLSearchParams, key: string): SortDir {
  return current.get('sort') === key && current.get('dir') === 'asc' ? 'desc' : 'asc'
}

/** Href for a sortable column header — sets sort/dir and resets page to 1. */
export function sortHref(current: URLSearchParams, key: string, _spec: TableSpec): string {
  return withParams(current, { sort: key, dir: nextSortDir(current, key), page: 1 })
}

/** Href for a pager link — changes only the page. */
export function pageHref(current: URLSearchParams, page: number): string {
  return withParams(current, { page })
}

/** Href for a page-size selector — changes `per` and resets page to 1. */
export function perHref(current: URLSearchParams, per: number): string {
  return withParams(current, { per, page: 1 })
}

/**
 * Validate a `ret` back-navigation param (admin-crm-ux D8 / admin-org-command-
 * center spec). Returns `ret` only when it is a same-app relative path — starts
 * with a single `/`, no `//` (protocol-relative), no backslash, no scheme/host,
 * no control chars. Otherwise returns `fallback`. Never an open redirect.
 */
export function validateReturnPath(ret: string | null, fallback: string): string {
  if (!ret) return fallback
  if (ret[0] !== '/') return fallback // must be root-relative
  if (ret[1] === '/' || ret[1] === '\\') return fallback // protocol-relative / backslash trick
  if (/[\x00-\x1f]/.test(ret)) return fallback // control chars
  if (ret.includes('://')) return fallback // embedded scheme
  return ret
}

/** Build a `?ret=<encoded current path+query>` fragment to hang off a row link,
 *  so the detail page can offer a state-preserving back link. */
export function retParam(pathname: string, current: URLSearchParams): string {
  const qs = current.toString()
  return encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)
}
