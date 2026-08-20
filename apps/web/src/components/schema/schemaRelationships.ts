/**
 * Client wiring for SchemaRelationships.astro (the Schema Relationships tab).
 * Kept out of the .astro frontmatter so the build stays thin (see the
 * astro-frontmatter-thin lesson). Handles: tree/flat toggle, base collapse, the
 * consolidated scope picker (Base ▸ Table), Type facet, the inferred quick chip,
 * include-removed, search, clear, Confirm/Dismiss (row + bulk), and the detail
 * panel (entity chips click through to the shared EntityPanel).
 */
import { fmtDay } from '../../lib/time';
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';
import { wireTableSort } from './tableSort';
import { entityChip } from './entityChip';
import { locationCrumbs } from './locationCrumbs';
import { createPager } from '../ui/tablePager';
import { mountRefineCollapse } from '../../lib/refineCollapse';
import { relStatusPill, relTypePill } from './relStatusBadge';
import { pushEscape } from '../../lib/escapeStack';

type RelType = 'linkedRecords' | 'formulas' | 'rollups' | 'lookups' | 'lastModified' | 'syncedViews';
interface RelEndpoint { id: string; name: string; kind: 'table' | 'field'; fieldType?: string; tableName?: string }
interface RelLink { from: RelEndpoint; to: RelEndpoint; removed?: boolean; firstSeen?: string; removedAt?: string; note?: string }
interface SchemaRelationship {
  id: string; type: RelType; baseId: string; baseName: string;
  a: RelEndpoint; b: RelEndpoint; cardinality?: string; direction?: 'one' | 'two';
  inferred?: boolean; validity: 'valid' | 'invalid'; hasRemovedHistory?: boolean;
  provenance?: string; links?: RelLink[];
}

const TYPE_META: Record<RelType, { label: string; icon: string }> = {
  linkedRecords: { label: 'Linked records', icon: 'lucide--link' },
  formulas: { label: 'Formulas', icon: 'lucide--variable' },
  rollups: { label: 'Rollups', icon: 'lucide--sigma' },
  lookups: { label: 'Lookups', icon: 'lucide--search' },
  lastModified: { label: 'Last modified', icon: 'lucide--history' },
  syncedViews: { label: 'Synced views', icon: 'lucide--refresh-cw' },
};
const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
// Cardinality: readable label in the meta line, compact token kept as the tooltip. Falls back to
// the raw token for anything unmapped.
const CARD_WORD: Record<string, string> = { 'm:1': 'Many-to-one', '1:m': 'One-to-many', '1:1': 'One-to-one', 'm:m': 'Many-to-many' };
const cardWord = (c?: string) => (c && CARD_WORD[c]) || c || '';
const fieldIconSvg = (type?: string) => {
  const k = type ? airtableIconKey(type) : null;
  return k ? `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">${AIRTABLE_FIELD_ICONS[k]}</svg>` : '';
};
const endpointIcon = (e: RelEndpoint) =>
  e.kind === 'field' ? `<span class="concept-ic-field">${fieldIconSvg(e.fieldType) || '<span class="iconify lucide--tag"></span>'}</span>` : '<span class="iconify lucide--table-2 concept-ic-table"></span>';
const arrow = (r: SchemaRelationship) => (r.direction === 'two' ? '↔' : '→');
// Canonical section heading: concept icon + uppercase label + a catalog count badge pressed right
// after the name. Show the badge ONLY from 2 up — a lone "1" is self-evident from the row below.
const sectLabel = (icon: string, text: string, count = 0) =>
  `<div class="rl-dsect-label"><span class="iconify ${icon} size-3.5 rl-dsect-ic" aria-hidden="true"></span>${text}${count >= 2 ? `<span class="badge badge-sm badge-neutral rl-dsect-count">${count}</span>` : ''}</div>`;

export function wireRelationships() {
  const root = document.querySelector<HTMLElement>('[data-relationships]');
  if (!root || root.dataset.rlWired) return;
  root.dataset.rlWired = '1';

  // Folded refinements — the shared control (lib/refineCollapse.ts). `always: true` matches every
  // other toolbar in this section and on Data; see SchemaBrowse for the argument.
  const rlTb = root.querySelector<HTMLElement>('.sch-tb');
  if (rlTb) mountRefineCollapse({ toolbar: rlTb, selectors: ['[data-facet]'], always: true });

  const byId = new Map<string, SchemaRelationship>();
  try {
    // The JSON blob renders as a sibling of the section, so query the document, not root.
    const raw = document.querySelector<HTMLElement>('[data-rl-json]')?.textContent || '[]';
    for (const r of JSON.parse(raw) as SchemaRelationship[]) byId.set(r.id, r);
  } catch { /* no data */ }

  const allRows = () => Array.from(root.querySelectorAll<HTMLElement>('[data-rl-row]'));
  const countEl = root.querySelector<HTMLElement>('[data-rl-count]');
  const clearBtn = root.querySelector<HTMLElement>('[data-rl-clear]');

  // ---- filter state ----
  // Faceted filters (same model as Browse/Visualize): each facet keeps a set of HIDDEN values.
  const facetHidden: Record<string, Set<string>> = { rlbase: new Set(), rltype: new Set(), rlstatus: new Set(), rlvalidity: new Set() };
  // Removed-history tri-state (was an "Include removed" checkbox): active(default) | removed | all.
  let history: 'active' | 'removed' | 'all' = 'active';
  let query = '';

  const rowStatus = (row: HTMLElement) => (row.dataset.inferred === '1' ? 'inferred' : 'confirmed');
  const rowVisible = (row: HTMLElement) => {
    if (row.dataset.dismissed === '1') return false; // dismissed (reversible via the undo toast)
    if (query && !(row.dataset.search || '').includes(query)) return false;
    if (facetHidden.rlbase.has(row.dataset.base || '')) return false;
    if (facetHidden.rltype.has(row.dataset.type || '')) return false;
    if (facetHidden.rlstatus.has(rowStatus(row))) return false;
    if (facetHidden.rlvalidity.has(row.dataset.validity || '')) return false;
    const isRemoved = row.dataset.removedRow === '1';
    if (history === 'active' && isRemoved) return false;
    if (history === 'removed' && !isRemoved) return false;
    return true;
  };
  const anyFacetActive = () => Object.values(facetHidden).some((s) => s.size > 0);

  // Pager for the Flat view (pattern-table-toolbar) — 25/page: a relationship row carries two
  // entity chips and an arrow, so it is taller than a plain record row.
  const pager = createPager({
    root, name: 'rl', sizes: [10, 25, 50], defaultSize: 25,
    storageKey: 'sch-rl-pagesize', onChange: () => apply(),
  });

  const apply = () => {
    let shown = 0;
    allRows().forEach((row) => {
      const ok = rowVisible(row);
      row.hidden = !ok;
      if (ok) shown++;
    });
    // Pager — FLAT view only. The tree is Base ▸ type ▸ relationship: paging it would slice a base
    // away from its own relationships, so it stays whole and Flat is the bounded mode (same ruling
    // as Schema Browse). The window is taken after filtering, over the flat rows alone.
    const flatRows = Array.from(root.querySelectorAll<HTMLElement>('[data-rl-body] [data-rl-row]'));
    const flatMatched = flatRows.filter((r) => !r.hidden);
    flatRows.forEach((r) => { r.hidden = true; });
    pager.window(flatMatched).forEach((r) => { r.hidden = false; });
    // De-duplicate the count: rows render twice (tree + flat). Count one view.
    const treeShown = Array.from(root.querySelectorAll<HTMLElement>('.rl-tree [data-rl-row]')).filter((r) => !r.hidden).length;
    if (countEl) countEl.textContent = `${treeShown} ${treeShown === 1 ? 'relationship' : 'relationships'}`;
    // Collapse empty type-groups + base-nodes in the tree.
    root.querySelectorAll<HTMLElement>('.rl-typegroup').forEach((g) => {
      const any = Array.from(g.querySelectorAll<HTMLElement>('[data-rl-row]')).some((r) => !r.hidden);
      g.hidden = !any;
    });
    root.querySelectorAll<HTMLElement>('[data-rl-base-node]').forEach((b) => {
      const any = Array.from(b.querySelectorAll<HTMLElement>('[data-rl-row]')).some((r) => !r.hidden);
      b.hidden = !any;
    });
    root.querySelectorAll<HTMLElement>('[data-rl-nomatch], [data-rl-nomatch-flat]').forEach((n) => (n.hidden = treeShown > 0));
    // Clear button visible when any filter is active.
    const active = !!query || anyFacetActive() || history !== 'active';
    if (clearBtn) clearBtn.hidden = !active;
    syncBulk();
  };

  // ---- tree/flat view toggle ----
  const modes = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-rl-mode]'));
  const views = {
    tree: root.querySelector<HTMLElement>('[data-rl-view="tree"]'),
    flat: root.querySelector<HTMLElement>('[data-rl-view="flat"]'),
  };
  modes.forEach((m) =>
    m.addEventListener('click', () => {
      modes.forEach((x) => x.classList.toggle('sch-tb-mode-active', x === m));
      const v = m.dataset.rlMode as 'tree' | 'flat';
      if (views.tree) views.tree.hidden = v !== 'tree';
      if (views.flat) views.flat.hidden = v !== 'flat';
      pager.reset();
      apply();
    }),
  );

  // ---- base collapse ----
  root.querySelectorAll<HTMLElement>('[data-rl-twist]').forEach((t) =>
    t.addEventListener('click', () => {
      const node = t.closest<HTMLElement>('[data-rl-base-node]');
      if (!node) return;
      const collapsed = node.hasAttribute('data-collapsed');
      if (collapsed) node.removeAttribute('data-collapsed');
      else node.setAttribute('data-collapsed', '');
      t.setAttribute('aria-expanded', String(collapsed));
    }),
  );

  // ---- faceted filters (Bases · Type · Status · Validity) — same chrome as Browse/Visualize ----
  document.addEventListener('facetchange', (ev) => {
    const d = (ev as CustomEvent).detail || {};
    if (d.name in facetHidden) { facetHidden[d.name] = new Set<string>(d.hidden || []); pager.reset(); apply(); return; }
    if (d.name === 'rlhistory') { history = (d.value || 'active') as typeof history; pager.reset(); apply(); return; }
  });

  // ---- search ----
  const searchInput = root.querySelector<HTMLInputElement>('[data-rl-search]');
  searchInput?.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); pager.reset(); apply(); });

  // ---- clear ----
  clearBtn?.addEventListener('click', () => {
    Object.keys(facetHidden).forEach((k) => (facetHidden[k] = new Set()));
    history = 'active'; query = '';
    if (searchInput) searchInput.value = '';
    document.dispatchEvent(new CustomEvent('facetreset'));
    pager.reset();
    apply();
  });

  // ---- Confirm / Dismiss (inferred) — persist via live relationship-mutate proxy ----
  const spaceId =
    document.querySelector<HTMLElement>('[data-space-id]')?.dataset.spaceId ||
    document.querySelector<HTMLElement>('[data-schema]')?.dataset.spaceId ||
    '';
  const mutateRel = async (action: 'confirm' | 'dismiss', id: string): Promise<boolean> => {
    if (!spaceId) return false;
    try {
      const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/relationship-mutate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  const rowsById = (id: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-rl-id="${CSS.escape(id)}"]`));
  const paintConfirm = (id: string) => {
    const rel = byId.get(id);
    if (rel) { rel.inferred = false; }
    rowsById(id).forEach((row) => {
      row.dataset.inferred = '0';
      row.dataset.validity = 'valid';
      const statusCell = row.querySelector('.rl-c-status');
      if (statusCell) {
        statusCell.innerHTML = VALID_BADGE;
      } else {
        row.querySelector('.rl-status')?.classList.remove('rl-status-inferred');
        row.querySelector('.rl-status')?.classList.add('rl-status-valid');
        row.querySelector('.rl-b-inferred')?.remove();
      }
      const actions = row.querySelector('.rl-actions');
      if (actions) actions.innerHTML = '<button type="button" class="btn btn-sm btn-ghost btn-square rl-edit" data-rl-edit-synced aria-label="Edit this declared synced table"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button>';
    });
  };
  const confirmRel = (id: string) => {
    void mutateRel('confirm', id).then((ok) => {
      if (ok) { paintConfirm(id); apply(); }
    });
  };
  // Toast + detail overlay live in RelationshipPanel. Dismiss persists to the engine;
  // Undo is local-only when the mutate failed to round-trip (optimistic hide + undo).
  const toast = document.querySelector<HTMLElement>('[data-rl-toast]');
  const toastMsg = document.querySelector<HTMLElement>('[data-rl-toast-msg]');
  let lastDismissed: string[] = [];
  let toastTimer: number | undefined;
  const hideToast = () => { if (toast) toast.hidden = true; if (toastTimer) clearTimeout(toastTimer); };
  const dismissRel = (ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach((id) => rowsById(id).forEach((row) => (row.dataset.dismissed = '1')));
    lastDismissed = ids;
    if (toastMsg) toastMsg.textContent = ids.length === 1 ? 'Relationship dismissed. The engine won’t suggest it again.' : `${ids.length} relationships dismissed.`;
    if (toast) toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { hideToast(); lastDismissed = []; }, 7000);
    void Promise.all(ids.map((id) => mutateRel('dismiss', id))).then((results) => {
      if (results.some((ok) => !ok)) {
        lastDismissed.forEach((id) => rowsById(id).forEach((row) => delete row.dataset.dismissed));
        lastDismissed = [];
        hideToast();
        apply();
      }
    });
  };
  document.querySelector<HTMLElement>('[data-rl-toast-undo]')?.addEventListener('click', () => {
    // Optimistic dismiss already hit the engine — Undo only restores the DOM for this session.
    lastDismissed.forEach((id) => rowsById(id).forEach((row) => delete row.dataset.dismissed));
    lastDismissed = [];
    hideToast();
    apply();
  });
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const row = t.closest<HTMLElement>('[data-rl-row]');
    if (!row) return;
    const id = row.dataset.rlId!;
    if (t.closest('[data-rl-confirm]')) { ev.stopPropagation(); confirmRel(id); return; }
    if (t.closest('[data-rl-dismiss]')) { ev.stopPropagation(); dismissRel([id]); apply(); return; }
  });
  // "Clear filters" inside an empty-state message.
  root.querySelectorAll<HTMLElement>('[data-rl-clear-empty]').forEach((b) => b.addEventListener('click', () => clearBtn?.click()));

  // ---- inferred bulk bar ----
  const bulk = root.querySelector<HTMLElement>('[data-rl-bulk]');
  const bulkN = root.querySelector<HTMLElement>('[data-rl-bulk-n]');
  const syncBulk = () => {
    const inferredVisible = Array.from(root.querySelectorAll<HTMLElement>('.rl-tree [data-rl-row][data-inferred="1"]')).filter((r) => !r.hidden);
    if (bulk) bulk.hidden = inferredVisible.length === 0;
    if (bulkN) bulkN.textContent = String(inferredVisible.length);
  };
  root.querySelector<HTMLElement>('[data-rl-bulk-confirm]')?.addEventListener('click', () => {
    Array.from(root.querySelectorAll<HTMLElement>('.rl-tree [data-rl-row][data-inferred="1"]')).forEach((r) => confirmRel(r.dataset.rlId!));
    apply();
  });
  root.querySelector<HTMLElement>('[data-rl-bulk-dismiss]')?.addEventListener('click', () => {
    const ids = [...new Set(Array.from(root.querySelectorAll<HTMLElement>('.rl-tree [data-rl-row][data-inferred="1"]')).map((r) => r.dataset.rlId!))];
    dismissRel(ids);
    apply();
  });

  // ---- detail panel (shared, page-level RelationshipPanel — query on document) ----
  const detail = document.querySelector<HTMLElement>('[data-rl-detail]');
  const dType = document.querySelector<HTMLElement>('[data-d-type]');
  const dCrumbs = document.querySelector<HTMLElement>('[data-d-crumbs]');
  const dIc = document.querySelector<HTMLElement>('[data-d-ic]');
  const dBody = document.querySelector<HTMLElement>('[data-d-body]');
  const closeDetail = () => { if (detail) detail.hidden = true; };
  document.querySelectorAll<HTMLElement>('[data-rl-detail-close]').forEach((c) => c.addEventListener('click', closeDetail));
  // `hidden` on the shared detail panel is the honest answer: closed ⇒ not our press.
  pushEscape({
    label: 'schemaRelationships:detail',
    onEscape: () => {
      if (!detail || detail.hidden) return false;
      closeDetail();
      return true;
    },
  });

  const entChip = (e: RelEndpoint) =>
    entityChip({ name: e.name, icon: endpointIcon(e), context: e.kind === 'field' && e.tableName ? e.tableName : undefined, clickable: true, attrs: 'data-entity-open="' + esc(e.id) + '"' });

  const buildDetail = (rel: SchemaRelationship) => {
    const meta = TYPE_META[rel.type];
    if (dIc) dIc.innerHTML = `<span class="iconify ${meta.icon} size-4"></span>`;
    // Title = the relationship TYPE (don't repeat it in the meta line below).
    if (dType) dType.textContent = meta.label;
    // Location (base) → the header's Row 2 crumbs, via the shared builder. Base = the location
    // (no openAttrs → a plain muted segment).
    if (dCrumbs) {
      dCrumbs.innerHTML = rel.baseName
        ? locationCrumbs([{ name: rel.baseName, icon: '<span class="iconify lucide--database concept-ic-base size-3.5"></span>' }])
        : '';
      dCrumbs.hidden = !rel.baseName;
    }
    const parts: string[] = [];
    // FIRST body element = identity meta line: state (coloured dot + label) · readable cardinality
    // (compact token as tooltip). Inferred rels show the salient unconfirmed-guess state (primary
    // dot) instead of validity — the Confirm/Dismiss card below acts on exactly that state.
    {
      const valid = rel.validity !== 'invalid';
      const status = rel.inferred
        ? `<span class="rl-dstatus"><span class="rl-dot rl-dot-primary" aria-hidden="true"></span>Inferred</span>`
        : `<span class="rl-dstatus"><span class="rl-dot rl-dot-${valid ? 'green' : 'red'}" aria-hidden="true"></span>${valid ? 'Valid' : 'Invalid'}</span>`;
      const card = rel.cardinality
        ? ` <span class="rl-meta-sep" aria-hidden="true">·</span> <span class="rl-card tooltip tooltip-bottom" data-tip="${esc(rel.cardinality)}">${esc(cardWord(rel.cardinality))}</span>`
        : '';
      parts.push(`<div class="rl-dbody-meta">${status}${card}</div>`);
    }
    parts.push(`<div>${sectLabel('lucide--waypoints', 'Connects')}<div class="rl-dpair">${entChip(rel.a)}<span class="rl-darrow">${arrow(rel)}</span>${entChip(rel.b)}</div></div>`);
    if (rel.inferred) {
      // ONE grouped inference card (catalog Alert look): a labelled header, the provenance
      // explanation, and the Confirm/Dismiss actions as its footer — all inside one bordered
      // ancestor so it reads "here's the inference — confirm/dismiss it". Buttons keep their
      // exact data-rl-confirm / data-rl-dismiss + data-rl-id hooks (handlers unchanged).
      const header = `<div class="rl-dinf-head"><span class="iconify lucide--sparkles size-4" aria-hidden="true"></span>Inferred — best guess</div>`;
      const copy = rel.provenance ? `<p class="rl-dinf-copy">${esc(rel.provenance)}</p>` : '';
      const actions = `<div class="rl-dactions"><button type="button" class="btn btn-sm btn-primary gap-1.5" data-rl-confirm data-rl-id="${esc(rel.id)}"><span class="iconify lucide--check size-3.5"></span>Confirm</button><button type="button" class="btn btn-sm btn-ghost gap-1.5" data-rl-dismiss data-rl-id="${esc(rel.id)}"><span class="iconify lucide--x size-3.5"></span>Dismiss</button></div>`;
      parts.push(`<div class="alert alert-soft alert-info rl-dinf" role="group"><div class="rl-dinf-inner">${header}${copy}${actions}</div></div>`);
    } else if (rel.provenance) {
      parts.push(`<div class="alert alert-soft alert-info rl-dprov" role="status"><span class="iconify lucide--info size-4"></span><span>${esc(rel.provenance)}</span></div>`);
    }
    if (rel.validity === 'invalid') {
      parts.push(`<div class="alert alert-soft alert-warning rl-dinvalid" role="alert"><span class="iconify lucide--unlink size-4"></span><span>All links for this relationship were removed. It’s kept as history — restore the table or fields to make it valid again.</span></div>`);
    }
    // Linked Fields — formula/rollup only: the OTHER fields the formula/rollup references (same
    // table). We list the fields instead of repeating "source → field" for each (Dan 2026-07-01).
    if ((rel.type === 'formulas' || rel.type === 'rollups') && rel.links && rel.links.length) {
      const seen = new Set<string>();
      const fields = rel.links.map((l) => l.to).filter((e) => e.kind === 'field' && e.id !== rel.a.id && !seen.has(e.id) && seen.add(e.id));
      if (fields.length) parts.push(`<div>${sectLabel('lucide--link', 'Linked fields', fields.length)}<div class="rl-dfields">${fields.map(entChip).join('')}</div></div>`);
    }
    // Changelog — the relationship's history (links added / removed), derived from the per-link
    // firstSeen / removedAt. Replaces the old inline "Links" list; removed links live here now,
    // not shown by default in the summary (Dan 2026-07-01). Only rendered when there are events.
    const events: { at: string; kind: 'added' | 'removed'; label: string }[] = [];
    (rel.links || []).forEach((l) => {
      if (l.firstSeen) events.push({ at: l.firstSeen, kind: 'added', label: `${l.from.name} → ${l.to.name}` });
      if (l.removed && l.removedAt) events.push({ at: l.removedAt, kind: 'removed', label: l.note || `${l.from.name} → ${l.to.name}` });
    });
    events.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    if (events.length) {
      const items = events.map((e) => `<li class="rl-dlog-item rl-dlog-${e.kind}"><span class="iconify ${e.kind === 'removed' ? 'lucide--minus-circle' : 'lucide--plus-circle'} size-3.5 rl-dlog-ic" aria-hidden="true"></span><span class="rl-dlog-txt">${esc(e.label)}</span><span class="rl-dlog-when">${esc(fmtDay(e.at))}</span></li>`).join('');
      parts.push(`<div>${sectLabel('lucide--history', 'Changelog', events.length)}<ul class="rl-dlog">${items}</ul></div>`);
    }
    if (dBody) dBody.innerHTML = parts.join('');
  };

  const openDetail = (rel: SchemaRelationship) => { buildDetail(rel); if (detail) detail.hidden = false; };

  // ---- Synced-table create/edit (Dan 2026-07-01) ----
  // Airtable's API can't detect synced tables, so users declare/edit them by hand here.
  const tablesData: { id: string; name: string; baseId?: string }[] = (() => {
    try { return JSON.parse(document.querySelector('[data-rl-tables]')?.textContent || '[]'); } catch { return []; }
  })();
  const baseMap: Record<string, string> = (() => { try { return JSON.parse(document.querySelector('[data-rl-basemap]')?.textContent || '{}'); } catch { return {}; } })();
  const tableById = new Map(tablesData.map((t) => [t.id, t]));
  const baseIds = Object.keys(baseMap);
  const soleBaseId = baseIds[0];
  const syncedToggle = document.getElementById('rl-synced-modal') as HTMLInputElement | null;
  const syncedPanel = (syncedToggle?.closest('.sb-drawer')?.querySelector('.sb-drawer-panel') as HTMLElement | null) ?? null;
  const $s = <T extends HTMLElement>(sel: string) => syncedPanel?.querySelector<T>(sel) ?? null;
  const fNote = $s<HTMLTextAreaElement>('[data-rl-f-note]');
  const syncedTitle = syncedPanel?.closest('.sb-drawer')?.querySelector('.sb-drawer-title') as HTMLElement | null;
  const syncedSaveBtn = $s<HTMLButtonElement>('[data-rl-f-save]');
  let editingSyncedId: string | null = null;
  // The two table pickers are searchable dropdown comboboxes (the pe-scope pattern): the dropdown
  // lists all tables + a search to filter; picking sets the value. The base is DERIVED from the
  // synced table. We hold the chosen ids here.
  let syncedId = '';
  let sourceId = '';

  // Wire one combobox: search filters the list; picking an option sets the trigger + fires onPick.
  const wireCombobox = (which: 'synced' | 'source', onPick: (id: string) => void) => {
    const cb = $s<HTMLElement>(`[data-rl-cb="${which}"]`);
    const cur = cb?.querySelector<HTMLElement>('[data-rl-cb-cur]');
    const search = cb?.querySelector<HTMLInputElement>('[data-rl-cb-search]');
    const empty = cb?.querySelector<HTMLElement>('[data-rl-cb-empty]');
    const opts = () => Array.from(cb?.querySelectorAll<HTMLElement>('[data-rl-cb-opt]') ?? []);
    const label = (o?: HTMLElement) => o ? `${o.dataset.label || ''}${o.dataset.base ? ` · ${o.dataset.base}` : ''}` : 'Select a table…';
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      opts().forEach((o) => { const ok = !q || (o.dataset.search || '').includes(q); o.hidden = !ok; if (ok) shown++; });
      if (empty) empty.hidden = shown > 0;
    });
    cb?.querySelector('[data-rl-cb-list]')?.addEventListener('click', (ev) => {
      const o = (ev.target as HTMLElement).closest<HTMLElement>('[data-rl-cb-opt]');
      if (!o) return;
      if (cur) cur.textContent = label(o);
      cb?.classList.add('rl-cb-chosen');
      (document.activeElement as HTMLElement | null)?.blur(); // close the dropdown
      onPick(o.dataset.value || '');
    });
    const set = (id: string) => {
      const o = opts().find((x) => x.dataset.value === id);
      if (cur) cur.textContent = label(o);
      cb?.classList.toggle('rl-cb-chosen', !!o);
      if (search) { search.value = ''; opts().forEach((x) => (x.hidden = false)); if (empty) empty.hidden = true; }
    };
    return { set };
  };
  const syncedCb = wireCombobox('synced', (id) => { syncedId = id; });
  const sourceCb = wireCombobox('source', (id) => { sourceId = id; });

  const endpoint = (id: string): RelEndpoint => ({ id, name: tableById.get(id)?.name ?? id, kind: 'table' });
  const entRow = (e: RelEndpoint) => `<span class="rl-ent"><span class="rl-ent-ic">${endpointIcon(e)}</span><span class="rl-ent-name">${esc(e.name)}</span></span>`;
  const editAct = '<span class="rl-actions"><button type="button" class="btn btn-sm btn-ghost btn-square rl-edit" data-rl-edit-synced aria-label="Edit this declared synced table"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button></span>';
  const rAttrs = (r: SchemaRelationship) => `data-rl-row data-rl-id="${esc(r.id)}" data-base="${esc(r.baseId)}" data-tables="${esc([r.a, r.b].filter((e) => e.kind === 'table').map((e) => e.id).join(' '))}" data-type="syncedViews" data-inferred="0" data-validity="valid" data-removed-row="0" data-search="${esc([r.a.name, r.b.name, r.baseName, 'synced views'].join(' ').toLowerCase())}"`;
  // The Valid status badge (reused by the synced tree row + confirmRel when promoting an inferred row).
  // Batch T — this used to be its OWN spelling of the pill, carrying `badge-sm` and a `size-3` glyph
  // that the SSR half in SchemaRelationships.astro did not, so an injected row and a server-rendered
  // row painted the same status at two different sizes. Both halves now share `relStatusBadge.ts`.
  const VALID_BADGE = relStatusPill('valid');
  const treeRow = (r: SchemaRelationship) => `<tr class="rl-row" ${rAttrs(r)} role="button" tabindex="0"><td class="rl-c-rel"><span class="rl-pair">${entRow(r.a)}<span class="rl-arrow">${arrow(r)}</span>${entRow(r.b)}</span></td><td class="rl-c-type">${relTypePill('lucide--refresh-cw', 'Synced views')}</td><td class="rl-c-card"><span class="rl-dash">—</span></td><td class="rl-c-status">${VALID_BADGE}</td><td class="rl-c-act">${editAct}</td></tr>`;
  const flatRow = (r: SchemaRelationship) => `<tr class="rl-frow" ${rAttrs(r)} role="button" tabindex="0"><td><span class="rl-pair"><span class="rl-status rl-status-valid" aria-hidden="true"></span>${entRow(r.a)}<span class="rl-arrow">${arrow(r)}</span>${entRow(r.b)}</span></td><td><span class="rl-ftype"><span class="iconify lucide--refresh-cw size-3.5" aria-hidden="true"></span>Synced views</span></td><td class="rl-td-muted">${esc(r.baseName)}</td><td class="rl-ft-r"></td><td class="rl-ft-act">${editAct}</td></tr>`;

  // THE TREE HEADER IS STILL WRITTEN TWICE, AND THIS IS THE OTHER COPY. The flat table below
  // migrated onto `components/ui/Table.astro`; the tree tables could not, because the Status
  // column's `<th>` in SchemaRelationships.astro carries the whole status LEGEND (a rich
  // `tooltip-content` card), and `TableColumn.label` is a string — the vessel has no way for a
  // column header to hold an element. Reported to the vessel owner with the call site
  // (SchemaRelationships.astro, the `rl-th-status` cell).
  //
  // Until that lands, the two halves are kept identical BY HAND, and the drift this batch went
  // looking for was real and here: the trailing affordance column read `<th class="rl-th-act">`
  // with no accessible name at all, against the server's `aria-label="Actions"` — the same class of
  // silent divergence that `relStatusBadge.ts` was extracted for one batch earlier, when this file
  // was found repainting the status pill at `badge-sm` with a `size-3` glyph the SSR half did not
  // have. The `aria-label` is now on both. The legend is on neither injected group, which is a
  // second, smaller divergence and is recorded rather than papered over: a Base group created in
  // this session has no "How this works" card until the page is reloaded.
  const wireOneTwist = (t: Element) => t.addEventListener('click', () => { const n = t.closest<HTMLElement>('[data-rl-base-node]'); if (!n) return; const c = n.hasAttribute('data-collapsed'); c ? n.removeAttribute('data-collapsed') : n.setAttribute('data-collapsed', ''); t.setAttribute('aria-expanded', String(c)); });
  const insertNew = (r: SchemaRelationship) => {
    const tree = root.querySelector<HTMLElement>('[data-rl-view="tree"]');
    let baseNode = tree?.querySelector<HTMLElement>(`.rl-base[data-rl-base-node="${CSS.escape(r.baseId)}"]`);
    if (!baseNode && tree) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="rl-base" data-rl-base-node="${esc(r.baseId)}"><button type="button" class="rl-base-head" data-rl-twist aria-expanded="true"><span class="rl-twist" aria-hidden="true"><span class="iconify lucide--chevron-right size-4"></span></span><span class="iconify lucide--database size-4 rl-base-ic" aria-hidden="true"></span><span class="rl-base-name">${esc(r.baseName)}</span><span class="rl-base-meta">0 relationships</span></button><div class="rl-base-body"><table class="rl-tbl"><thead><tr><th class="rl-th-rel" data-sort-col="0">Relationship</th><th class="rl-th-type" data-sort-col="1">Type</th><th class="rl-th-card" data-sort-col="2">Cardinality</th><th class="rl-th-status" data-sort-col="3">Status</th><th class="rl-th-act" aria-label="Actions"></th></tr></thead><tbody></tbody></table></div></div>`;
      baseNode = wrap.firstElementChild as HTMLElement;
      tree.querySelector('[data-rl-nomatch]')?.before(baseNode);
      baseNode.querySelectorAll('[data-rl-twist]').forEach(wireOneTwist);
    }
    baseNode?.querySelector('.rl-tbl tbody')?.insertAdjacentHTML('beforeend', treeRow(r));
    root.querySelector('[data-rl-body]')?.insertAdjacentHTML('beforeend', flatRow(r));
    // refresh the base count
    if (baseNode) { const bn = baseNode.querySelectorAll('.rl-tbl [data-rl-row]').length; const bm = baseNode.querySelector('.rl-base-meta'); if (bm) bm.textContent = `${bn} ${bn === 1 ? 'relationship' : 'relationships'}`; }
  };

  const openSyncedForm = (id: string | null) => {
    editingSyncedId = id;
    const rel = id ? byId.get(id) : null;
    // DECLARE, never create: this form records what Baseout knows about a sync that already
    // exists in Airtable. Nothing here reaches Airtable.
    if (syncedTitle) syncedTitle.textContent = rel ? 'Edit a declared synced table' : 'Declare a synced table';
    if (syncedSaveBtn) syncedSaveBtn.textContent = rel ? 'Save changes' : 'Declare table';
    syncedId = rel?.a.id ?? '';
    sourceId = rel?.b.id ?? '';
    syncedCb.set(syncedId);
    sourceCb.set(sourceId);
    if (fNote) fNote.value = rel?.provenance ?? '';
    if (syncedToggle) syncedToggle.checked = true;
  };
  $s<HTMLElement>('[data-rl-f-cancel]')?.addEventListener('click', () => { if (syncedToggle) syncedToggle.checked = false; });
  root.querySelector<HTMLElement>('[data-rl-new-synced]')?.addEventListener('click', () => openSyncedForm(null));

  syncedPanel?.querySelector<HTMLFormElement>('[data-rl-form]')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!syncedId) { $s<HTMLElement>('[data-rl-cb="synced"] [data-rl-cb-trigger]')?.focus(); return; }
    if (!sourceId) { $s<HTMLElement>('[data-rl-cb="source"] [data-rl-cb-trigger]')?.focus(); return; }
    const baseId = tableById.get(syncedId)?.baseId || soleBaseId || '';
    if (!spaceId || !baseId) return;
    const saveBtn = syncedPanel.querySelector<HTMLButtonElement>('[data-rl-f-save]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.setAttribute('aria-busy', 'true'); }
    void fetch(`/api/spaces/${encodeURIComponent(spaceId)}/relationship-mutate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        baseId,
        sourceTableId: sourceId,
        destTableId: syncedId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json().catch(() => ({}))) as { id?: string };
        const id = body.id || editingSyncedId || `syn-${Date.now()}`;
        const a = endpoint(syncedId), b = endpoint(sourceId);
        const rel: SchemaRelationship = {
          id, type: 'syncedViews', baseId, baseName: baseMap[baseId] || '',
          a, b, direction: 'one', inferred: false, validity: 'valid',
          provenance: fNote?.value.trim() || `Declared synced table — “${a.name}” is kept in sync from “${b.name}”.`,
          links: [{ from: a, to: b }],
        };
        const isEdit = !!editingSyncedId && byId.has(editingSyncedId) && !!root.querySelector(`[data-rl-row][data-rl-id="${CSS.escape(editingSyncedId)}"]`);
        byId.set(id, rel);
        if (isEdit) root.querySelectorAll<HTMLElement>(`[data-rl-row][data-rl-id="${CSS.escape(id)}"]`).forEach((el) => { el.outerHTML = el.classList.contains('rl-frow') ? flatRow(rel) : treeRow(rel); });
        else insertNew(rel);
        if (syncedToggle) syncedToggle.checked = false;
        apply();
      })
      .finally(() => {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.removeAttribute('aria-busy'); }
      });
  });

  // Row click routing (Dan 2026-07-03): field-based relationships (linked / formula / rollup /
  // lookup / lastModified) open the PRIMARY FIELD's sidecart — it already shows the field, its
  // links, and the referenced (Linked) fields. Synced tables (no single primary field) and
  // removed/invalid ones keep the custom relationship detail (with its Changelog).
  const openRel = (rel: SchemaRelationship) => {
    if (rel.type !== 'syncedViews' && rel.a.kind === 'field' && rel.validity === 'valid') {
      document.dispatchEvent(new CustomEvent('schema:openEntity', { detail: { id: rel.a.id } }));
    } else {
      openDetail(rel);
    }
  };
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-rl-confirm]') || t.closest('[data-rl-dismiss]')) return; // handled above
    // B1: a referenced-field chip / "+N more" popover entry opens that field's EntityPanel via
    // the global [data-entity-open] delegate — don't also open the row's primary field.
    if (t.closest('[data-entity-open]') || t.closest('.rl-more')) return;
    const editBtn = t.closest<HTMLElement>('[data-rl-edit-synced]');
    if (editBtn) { ev.stopPropagation(); const row = editBtn.closest<HTMLElement>('[data-rl-row]'); if (row) openSyncedForm(row.dataset.rlId!); return; }
    const row = t.closest<HTMLElement>('[data-rl-row]');
    if (!row) return;
    const rel = byId.get(row.dataset.rlId!);
    if (rel) openRel(rel);
  });
  // Entity chip inside the (page-level) detail → close our panel; the global EntityPanel
  // delegate ([data-entity-open]) opens the shared sidebar on top.
  detail?.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('[data-entity-open]')) closeDetail();
  });
  // The Visualize "Relationships" graph opens the same detail by dispatching this event.
  document.addEventListener('schema:openRelationship', (ev) => {
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    const rel = id ? byId.get(id) : undefined;
    if (rel) openDetail(rel);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    // Let a focused reference chip / "+N more" trigger handle its own Enter/Space (opens the field).
    if ((ev.target as HTMLElement).closest('[data-entity-open]') || (ev.target as HTMLElement).closest('.rl-more')) return;
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-rl-row]');
    if (!row) return;
    const rel = byId.get(row.dataset.rlId!);
    if (!rel) return;
    ev.preventDefault();
    openRel(rel);
  });

  // Detail-panel Confirm/Dismiss (they carry their own data-rl-id). The detail is now
  // page-level, so delegate on the document.
  document.addEventListener('click', (ev) => {
    const c = (ev.target as HTMLElement).closest<HTMLElement>('[data-rl-detail] [data-rl-confirm], [data-rl-detail] [data-rl-dismiss]');
    if (!c) return;
    const id = c.dataset.rlId!;
    if (c.hasAttribute('data-rl-dismiss')) { dismissRel([id]); closeDetail(); }
    else { confirmRel(id); const rel = byId.get(id); if (rel) buildDetail(rel); }
    apply();
  });

  // ── click-to-sort the default-view tables (Relationship · Type · Cardinality · Status) ──
  wireTableSort(
    root,
    () => Array.from(root.querySelectorAll<HTMLElement>('.rl-tree .rl-base')).map((g) => ({
      headers: Array.from(g.querySelectorAll<HTMLElement>('.rl-tbl thead [data-sort-col]')),
      container: g.querySelector<HTMLElement>('.rl-tbl tbody')!,
      items: () => Array.from(g.querySelectorAll<HTMLElement>('.rl-tbl [data-rl-row]')),
    })),
    (row, col) => {
      if (col === 0) return (row.querySelector('.rl-c-rel')?.textContent || '').trim().toLowerCase();
      if (col === 1) return (row.querySelector('.rl-c-type')?.textContent || '').trim().toLowerCase();
      if (col === 2) return (row.querySelector('.rl-c-card')?.textContent || '').trim().toLowerCase();
      if (col === 3) return ({ Valid: 0, Inferred: 1, Invalid: 2 } as Record<string, number>)[(row.querySelector('.rl-c-status .rl-badge')?.textContent || '').trim()] ?? 3;
      return '';
    },
  );

  apply();
}
