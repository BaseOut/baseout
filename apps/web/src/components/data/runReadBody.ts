/**
 * runReadBody — the shared BACKUP-RUN detail BODY (the run's Created / Updated / Deleted record
 * list, paginated, with its honest sampling note), extracted from DataChangelog.astro
 * (2026-08-03, Stage 3).
 *
 * The last of the four panel bodies to become a module. `recordReadBody.ts`, `mediaReadBody.ts` and
 * `entityReadBody` (schemaReadBody.ts) are the same shape: `(entity, ctx, view) => string`, pure,
 * referencing no host's `createPanelStack` instance and owning no state. A host can only render a
 * KIND whose body is a module, which is why all four had to exist before one host could replace
 * four stacks.
 *
 * ── Chrome vs body ────────────────────────────────────────────────────────────────────────────
 * `runTabsHtml` is CHROME — it fills the panel header's tab strip, a header slot, not the body. It
 * is exported separately for exactly the reason the asset body's crumbs were pulled out of it: a
 * host that owns ONE chrome for many kinds cannot have a kind writing its own header through a body
 * string. `runIdentity` is the same idea for title/subtitle/id.
 *
 * ── What the host still owns ──────────────────────────────────────────────────────────────────
 * The toolbar (search, base/table/type facets, the date window) is the PAGE's, not the panel's, so
 * it reaches the body only as `ctx.entriesOf` + `ctx.filtered` + `ctx.visibleTypes` — resolved
 * values, never the filter machinery. Copy-to-clipboard, tab clicks and pager clicks are host
 * event wiring against the `data-*` hooks this module emits.
 */

import { fmtDateTime } from '../../lib/time';
import { pagerHtml } from '../ui/tablePager';
import { entityIconMarkup } from '../schema/entityIcon';
import { esc } from './recordReadBody';

export type EntryType = 'created' | 'updated' | 'deleted';
export interface RunEntry { recordId: string; primary: string; tableId: string; type: EntryType; fieldCount: number }
export interface Run { runId: string; at: string; counts: Record<string, number>; sample: Record<string, number>; entries: RunEntry[] }

/** Canonical order — created, then updated, then deleted. Never re-derived per call site. */
export const ORDER: EntryType[] = ['created', 'updated', 'deleted'];
export const TYPE_LABEL: Record<EntryType, string> = { created: 'Created', updated: 'Updated', deleted: 'Deleted' };

/** Everything a host must resolve so the body can render without touching its own stack. */
export interface RunBodyCtx {
  /** This run's entries with the PAGE toolbar's filters already applied (the host owns the toolbar). */
  entriesOf: (run: Run) => RunEntry[];
  /** table id → name, for a record row's location micro-label. */
  tableName: Record<string, string>;
  /** True when a base / table / search filter is active — counts then scale the sample rather
   *  than showing the run's true totals, and the sampling note is suppressed. */
  filtered: boolean;
  /** The change types the toolbar leaves visible, in `ORDER`. */
  visibleTypes: EntryType[];
  /** Rows-per-page options offered by the in-panel pager. */
  pageSizes: number[];
}

/** Per-panel view state for ONE run. The host owns the object; the builders below read it, and
 *  `normalizeRunView` / `runReadBody` clamp it in place — the same in-place clamp
 *  `recordReadBody`'s `renderLinked` makes on `view.linkTab` when a tab goes stale. */
export interface RunViewState { tab: EntryType; page: number; pageSize: number; search: string }


/** The table glyph on each record row's location micro-label — the shared entity mapping, matching
 *  the drawer breadcrumb that appears once a record is drilled into. */
const RECLOC_TABLE_IC = entityIconMarkup('table', { size: 'size-3', extraClass: 'dcp-recloc-ic' });

/**
 * Clamp the view to what the toolbar currently leaves visible. Call ONCE before the builders, so
 * both of them are pure reads of an already-consistent view (a hidden type must not stay selected).
 */
export function normalizeRunView(run: Run, ctx: RunBodyCtx, view: RunViewState): void {
  if (!ctx.visibleTypes.includes(view.tab)) { view.tab = ctx.visibleTypes[0] || 'created'; view.page = 1; }
}

// ── CHROME builders (header slots — NOT part of the body string) ──────────────────────────────

/**
 * Title / subtitle / copyable id for a run panel's header.
 *
 * D10 — ONE PANEL-TITLE SEMANTIC: **the panel is titled with the thing the row named.** On Schema
 * a row names an entity and the panel is titled with that entity; here a row names a backup RUN,
 * and the run's name is its id — so the id is the title and the date is the subtitle. It used to
 * be the other way round, which is how a person who clicked `run_2026_06_16_daily` landed on a
 * panel headed "Jun 16, 2026" and had to check the id chip to be sure it was the run they asked
 * for. Two panels opened side by side to COMPARE runs is the case that makes it hurt: two dates
 * are two headings that differ by a day, two ids are two names.
 */
export function runIdentity(run: Run): { title: string; meta: string; id: string } {
  return { title: run.runId, meta: fmtDateTime(run.at), id: run.runId };
}

/**
 * The header's TRUE TABS — one change type at a time, full-area (pattern-data-changelog). Counts
 * mirror the run-row cells: a filtered view scales the sample, an unfiltered one shows true totals.
 */
export function runTabsHtml(run: Run, ctx: RunBodyCtx, view: RunViewState): string {
  const ents = ctx.entriesOf(run);
  return ctx.visibleTypes.map((t) => {
    const n = ctx.filtered ? ents.filter((e) => e.type === t).length : run.counts[t];
    return `<button type="button" class="dcp-tab sb-seg${view.tab === t ? ' sb-seg-on' : ''}${n === 0 ? ' dcp-tab-zero' : ''}" data-dcp-tab="${t}" aria-pressed="${view.tab === t}"><span class="dc-dot dc-sdot-${t}" aria-hidden="true"></span>${TYPE_LABEL[t]}<span class="dcp-tabn">${n.toLocaleString()}</span></button>`;
  }).join('');
}

// ── The body ──────────────────────────────────────────────────────────────────────────────────

export function runReadBody(run: Run, ctx: RunBodyCtx, view: RunViewState): string {
  const ents = ctx.entriesOf(run);
  const list = ents.filter((e) => e.type === view.tab && (!view.search || `${e.primary} ${ctx.tableName[e.tableId] || ''}`.toLowerCase().includes(view.search)));
  const total = run.counts[view.tab];
  const pages = Math.max(1, Math.ceil(list.length / view.pageSize));
  if (view.page > pages) view.page = pages;
  if (view.page < 1) view.page = 1;
  const start = (view.page - 1) * view.pageSize;
  const pageRows = list.slice(start, start + view.pageSize).map((e) => `
    <div class="dcp-recwrap">
      <button type="button" class="dcp-recrow" data-dc-rec="${esc(e.recordId)}">
        <span class="dcp-recname">${esc(e.primary)}</span>
        ${view.tab === 'updated' && e.fieldCount ? `<span class="dcp-recnote">${e.fieldCount} field${e.fieldCount === 1 ? '' : 's'}</span>` : ''}
        <span class="dcp-recloc">${RECLOC_TABLE_IC}${esc(ctx.tableName[e.tableId] || '')}</span>
      </button>
      <button type="button" class="btn btn-sm btn-ghost btn-square ps-beside dcp-openbeside tooltip tooltip-left" data-dcp-openbeside="${esc(e.recordId)}" aria-label="Open beside" data-tip="Open beside · ⌘/Ctrl-click"><span class="iconify lucide--columns-2 size-4" aria-hidden="true"></span></button>
    </div>`).join('');
  // Pager — the SHARED construction, rendered as markup because each open panel owns its own page
  // position and this body is rebuilt on every render (see pagerHtml). `tpg-tight` is the one
  // per-surface metric: under a panel header the 12px lead-in is too much.
  const pager = list.length
    ? pagerHtml({ sizes: ctx.pageSizes, pageSize: view.pageSize, page: view.page, pages, total: list.length, className: 'tpg-tight' })
    : '';
  // A run's true total may exceed the sample we ship — say so honestly (not while searching).
  const note = !view.search && total > list.length ? `<div class="dcp-more">Showing the ${list.length.toLocaleString()} sampled of ${total.toLocaleString()} — open the backup for the full list.</div>` : '';
  return list.length
    ? `<div class="dcp-list">${pageRows}</div>${pager}${note}`
    : `<div class="dcp-none">${view.search ? 'No records match your search.' : `No records ${view.tab} in this run.`}</div>`;
}
