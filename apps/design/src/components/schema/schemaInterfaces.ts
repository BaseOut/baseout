/**
 * Client wiring for SchemaInterfaces.astro (the Interfaces tab). Frontmatter-thin, all
 * server behavior FAKED. Handles: per-interface page collapse, base filter, include-removed,
 * the create/edit modal (type interface|page, parent-interface required when page), the
 * Table/Field tag-picker (schema:ifTagAdd → auto/manual chips), definition JSON format/
 * validate, and save/soft-delete (append/update rows in place).
 */
import { setButtonLoading } from '../../lib/ui';
import { wireTableSort } from './tableSort';
import { entityChip } from './entityChip';
import { createPager } from '../ui/tablePager';
import { entityIconClass } from './entityIcon';

interface IfTag { entityId: string; source: 'auto' | 'manual' }
interface Iface { id: string; name: string; type: 'interface' | 'page'; baseId: string; parentId?: string; status: 'active' | 'removed'; published?: boolean; internalDescription?: string; definition?: string; tags?: IfTag[]; removedAt?: string }
type Ent = { name: string; kind: 'base' | 'table' | 'field' | 'view'; tableName: string | null };

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Status badge (mirror of the Astro ifStatusBadge): Published / Not published / Removed,
// our Storybook badge-soft + semantic + bg-current dot. Shown for interfaces AND pages.
const ifStatusBadge = (i: Iface) => {
  if (i.status === 'removed') return `<span class="badge badge-soft badge-warning if-badge tooltip tooltip-right" data-tip="No longer exists in Airtable"><span class="size-1.5 rounded-full bg-current"></span>Removed</span>`;
  return i.published === false
    ? `<span class="badge badge-ghost if-badge tooltip tooltip-right" data-tip="Not published in Airtable — not live for users yet"><span class="size-1.5 rounded-full bg-current"></span>Not published</span>`
    : `<span class="badge badge-soft badge-success if-badge tooltip tooltip-right" data-tip="Published in Airtable — live for users"><span class="size-1.5 rounded-full bg-current"></span>Published</span>`;
};

export function wireInterfaces() {
  const root = document.querySelector<HTMLElement>('[data-interfaces]');
  if (!root || root.dataset.ifWired) return;
  root.dataset.ifWired = '1';
  if (root.dataset.canUse !== '1') return;

  const byId = new Map<string, Iface>();
  const ents: Record<string, Ent> = {};
  try { for (const i of JSON.parse(document.querySelector('[data-if-json]')?.textContent || '[]') as Iface[]) byId.set(i.id, i); } catch { /* none */ }
  try { Object.assign(ents, JSON.parse(document.querySelector('[data-if-entindex]')?.textContent || '{}')); } catch { /* none */ }
  const basesMap: Record<string, string> = {};
  try { Object.assign(basesMap, JSON.parse(document.querySelector('[data-if-bases]')?.textContent || '{}')); } catch { /* none */ }
  const baseLabel = (id?: string) => (id && basesMap[id]) || 'No base';

  // ── filters (search · Base/Table/Field facets · include-removed) — node-based so the tree stays intact ──
  const searchInput = root.querySelector<HTMLInputElement>('[data-if-search]');
  const clearBtn = root.querySelector<HTMLElement>('[data-if-clear]');
  const facetHidden: Record<string, Set<string>> = { ifbase: new Set(), iftable: new Set(), iffield: new Set() };
  // Removed-status tri-state (was an "Include removed" checkbox): active(default) | removed | all.
  let status: 'active' | 'removed' | 'all' = 'active';
  let query = '';
  const someShown = (ids: string, hidden: Set<string>) => ids.split(' ').filter(Boolean).some((v) => !hidden.has(v));
  const rowMatch = (r: HTMLElement) => {
    if (r.dataset.dismissed === '1') return false;
    if (query && !(r.dataset.search || '').includes(query)) return false;
    if (facetHidden.ifbase.has(r.dataset.base || '')) return false;
    if (facetHidden.iftable.size && !someShown(r.dataset.tables || '', facetHidden.iftable)) return false;
    if (facetHidden.iffield.size && !someShown(r.dataset.fields || '', facetHidden.iffield)) return false;
    return true;
  };
  const anyFilter = () => !!query || status !== 'active' || Object.values(facetHidden).some((s) => s.size > 0);
  const pager = createPager({
    root, name: 'if', sizes: [10, 25, 50], defaultSize: 25,
    storageKey: 'sch-if-pagesize', onChange: () => apply(),
  });
  const apply = () => {
    const matched: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>('[data-if-node]').forEach((node) => {
      const rows = Array.from(node.querySelectorAll<HTMLElement>('[data-if-row]'));
      // per-row removed visibility, then keep the whole node if any visible row matches the filters
      rows.forEach((r) => {
        const isRemoved = r.dataset.removedRow === '1';
        const statusHide = status === 'active' ? isRemoved : status === 'removed' ? !isRemoved : false;
        r.hidden = statusHide || r.dataset.dismissed === '1';
      });
      const nodeMatch = rows.some((r) => !r.hidden && rowMatch(r));
      node.hidden = true;
      if (nodeMatch) matched.push(node);
    });
    // Pager — the unit is the INTERFACE NODE, not the row: an interface owns its pages, so paging
    // rows would orphan a page from its parent. Paging whole nodes keeps every page with the
    // interface it belongs to. 25/page.
    const shown = matched.length;
    pager.window(matched).forEach((node) => { node.hidden = false; });
    // Hide a Base group when all its interface nodes are hidden.
    root.querySelectorAll<HTMLElement>('[data-if-basegroup]').forEach((bg) => {
      bg.hidden = !Array.from(bg.querySelectorAll<HTMLElement>('[data-if-node]')).some((n) => !n.hidden);
    });
    const nomatch = root.querySelector<HTMLElement>('[data-if-nomatch]');
    if (nomatch) nomatch.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !anyFilter();
  };
  document.addEventListener('facetchange', (ev) => {
    const d = (ev as CustomEvent).detail || {};
    if (d.name in facetHidden) { facetHidden[d.name] = new Set<string>(d.hidden || []); pager.reset(); apply(); return; }
    if (d.name === 'ifstatus') { status = (d.value || 'active') as typeof status; pager.reset(); apply(); return; }
  });
  searchInput?.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); pager.reset(); apply(); });
  clearBtn?.addEventListener('click', () => {
    Object.keys(facetHidden).forEach((k) => (facetHidden[k] = new Set()));
    query = ''; status = 'active';
    if (searchInput) searchInput.value = '';
    document.dispatchEvent(new CustomEvent('facetreset'));
    pager.reset();
    apply();
  });

  // ── page collapse (per interface node) ──
  const wireTwist = (t: Element) => t.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const node = t.closest<HTMLElement>('[data-if-node]');
    if (!node) return;
    const c = node.hasAttribute('data-collapsed');
    c ? node.removeAttribute('data-collapsed') : node.setAttribute('data-collapsed', '');
    t.setAttribute('aria-expanded', String(c));
  });
  root.querySelectorAll('[data-if-twist]').forEach(wireTwist);

  // ── Base group collapse ──
  root.querySelectorAll<HTMLElement>('[data-if-basetwist]').forEach((t) =>
    t.addEventListener('click', () => {
      const g = t.closest<HTMLElement>('[data-if-basegroup]');
      if (!g) return;
      const c = g.hasAttribute('data-collapsed');
      c ? g.removeAttribute('data-collapsed') : g.setAttribute('data-collapsed', '');
      t.setAttribute('aria-expanded', String(c));
    }),
  );

  // ── modal ──
  // Create/edit form lives in a right Drawer (checkbox-driven). #if-modal = the toggle.
  const toggle = document.getElementById('if-modal') as HTMLInputElement | null;
  const panel = (toggle?.closest('.sb-drawer')?.querySelector('.sb-drawer-panel') as HTMLElement | null) ?? null;
  const openDrawer = (v: boolean) => { if (toggle) toggle.checked = v; };
  const $m = <T extends HTMLElement>(sel: string) => panel?.querySelector<T>(sel) ?? null;
  const fName = $m<HTMLInputElement>('[data-if-f-name]');
  const fId = $m<HTMLInputElement>('[data-if-f-id]');
  const fBase = $m<HTMLSelectElement>('[data-if-f-base]');
  const fPublished = $m<HTMLInputElement>('[data-if-f-published]');
  const fType = $m<HTMLSelectElement>('[data-if-f-type]');
  const fParent = $m<HTMLSelectElement>('[data-if-f-parent]');
  const parentField = $m<HTMLElement>('[data-if-parent-field]');
  const fDesc = $m<HTMLTextAreaElement>('[data-if-f-desc]');
  const chipsWrap = $m<HTMLElement>('[data-if-chips]');
  const title = panel?.querySelector<HTMLElement>('.sb-drawer-title');
  const titleIc = panel?.querySelector<HTMLElement>('[data-sb-drawer-titleic]');
  const crumbsEl = panel?.querySelector<HTMLElement>('[data-sb-drawer-crumbs]');
  const saveBtn = $m<HTMLButtonElement>('[data-if-save]');
  let editingId: string | null = null;
  let tags: IfTag[] = [];

  // Editing an EXISTING interface/page does NOT happen here. A row opens the stacking EntityPanel
  // and that panel edits itself in place — one layout, a read mode and an edit mode
  // (pattern-panel-edit-mode). It reports the committed record back through this event; the only
  // thing left for the tab to do is re-render its listing row.
  document.addEventListener('schema:interfaceSaved', (ev) => {
    const rec = (ev as CustomEvent).detail?.rec as Iface | undefined;
    if (!rec?.id) return;
    byId.set(rec.id, { ...(byId.get(rec.id) as Iface), ...rec });
    upsertRow(byId.get(rec.id)!, rec.id);
    apply();
  });

  const chipHtml = (t: IfTag) => {
    const e = ents[t.entityId];
    const name = e ? e.name : t.entityId;
    const context = e && e.kind === 'field' && e.tableName ? e.tableName : undefined;
    const icon = `<span class="iconify ${entityIconClass(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>`;
    return entityChip({ name, icon, context, attrs: 'data-if-chip="' + esc(t.entityId) + '"', remove: t.source === 'manual' ? 'data-if-chip-x="' + esc(t.entityId) + '"' : undefined, derived: t.source === 'auto' });
  };
  const renderChips = () => { if (chipsWrap) chipsWrap.innerHTML = tags.map(chipHtml).join(''); };

  // Populate the parent-interface options (exclude self + pages) — scoped to the chosen Base
  // (a page belongs to the same base as its parent interface). Preserves the current pick if still valid.
  const fillParents = (excludeId: string | null) => {
    if (!fParent) return;
    const prev = fParent.value;
    const base = fBase?.value || '';
    const opts = ['<option value="">Select an interface…</option>'];
    byId.forEach((i) => { if (i.type === 'interface' && i.id !== excludeId && (!base || i.baseId === base)) opts.push(`<option value="${esc(i.id)}">${esc(i.name)}</option>`); });
    fParent.innerHTML = opts.join('');
    if (prev && Array.from(fParent.options).some((o) => o.value === prev)) fParent.value = prev; else fParent.value = '';
  };
  const syncType = () => {
    const isPage = fType?.value === 'page';
    if (parentField) parentField.hidden = !isPage;
    if (titleIc) { titleIc.innerHTML = ''; titleIc.hidden = true; }
    if (crumbsEl) { crumbsEl.innerHTML = ''; crumbsEl.hidden = true; }
    if (title) title.textContent = isPage ? 'Register page' : 'Register interface';
    if (saveBtn) saveBtn.textContent = isPage ? 'Register page' : 'Register interface';
  };
  fType?.addEventListener('change', syncType);
  // Changing the Base re-scopes the parent-interface options.
  fBase?.addEventListener('change', () => fillParents(editingId));

  /** REGISTER only (`id` is always null now — editing lives in the panel). */
  const openEdit = (id: string | null, presetType?: 'interface' | 'page') => {
    editingId = id;
    const i = id ? byId.get(id) : null;
    if (fBase) fBase.value = i?.baseId ?? '';
    fillParents(id); // after fBase so parent options are scoped to the right base
    if (fName) fName.value = i?.name ?? '';
    if (fId) { fId.value = i?.id ?? ''; fId.readOnly = !!i; }
    if (fType) fType.value = i?.type ?? presetType ?? 'interface';
    if (fParent) fParent.value = i?.parentId ?? '';
    if (fPublished) fPublished.checked = i ? i.published !== false : true;
    if (fDesc) fDesc.value = i?.internalDescription ?? '';
    tags = (i?.tags ?? []).map((t) => ({ ...t }));
    renderChips();
    syncType();
    openDrawer(true);
    setTimeout(() => fName?.focus(), 0);
  };
  root.querySelectorAll<HTMLElement>('[data-if-new]').forEach((b) => b.addEventListener('click', () => openEdit(null, (b.dataset.ifNew as 'interface' | 'page') || 'interface')));
  $m<HTMLElement>('[data-if-cancel]')?.addEventListener('click', () => openDrawer(false));
  // Q4 — a row opens the interface/page as a stacking EntityPanel (like Browse/Relationships), not a
  // one-off drawer. The panel footer routes Edit/Delete back here via the events below.
  const openInPanel = (id: string) => { if (byId.has(id)) document.dispatchEvent(new CustomEvent('schema:openEntity', { detail: { id } })); };
  document.addEventListener('schema:openInterface', (ev) => { const id = (ev as CustomEvent).detail?.id as string | undefined; if (id) openInPanel(id); });
  document.addEventListener('schema:deleteInterface', (ev) => { const id = (ev as CustomEvent).detail?.id as string | undefined; if (id && byId.has(id)) softDelete(id); });

  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-if-twist]')) return; // collapse handled separately
    // The row's pencil is a SHORTCUT to the panel's edit mode — not a second edit surface.
    const edit = t.closest<HTMLElement>('[data-if-edit]');
    if (edit) {
      ev.stopPropagation();
      const id = edit.dataset.ifEdit!;
      openInPanel(id);
      document.dispatchEvent(new CustomEvent('schema:panelEditMode', { detail: { id } }));
      return;
    }
    const del = t.closest<HTMLElement>('[data-if-delete]');
    if (del) { ev.stopPropagation(); softDelete(del.dataset.ifDelete!); return; }
    const row = t.closest<HTMLElement>('[data-if-row]');
    if (row && !row.classList.contains('if-orphan-head')) openInPanel(row.dataset.ifId!);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-if-row]');
    if (!row || row.classList.contains('if-orphan-head')) return;
    ev.preventDefault();
    openInPanel(row.dataset.ifId!);
  });

  // ── tag-picker ──
  document.addEventListener('schema:ifTagAdd', (ev) => {
    if (!toggle?.checked) return; // active either in the drawer or the in-panel edit
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (!id || tags.some((t) => t.entityId === id)) return;
    tags.push({ entityId: id, source: 'manual' });
    renderChips();
  });
  chipsWrap?.addEventListener('click', (ev) => {
    const x = (ev.target as HTMLElement).closest<HTMLElement>('[data-if-chip-x]');
    if (!x) return;
    tags = tags.filter((t) => t.entityId !== x.dataset.ifChipX);
    renderChips();
  });

  // Raw `definition` JSON is API-only — no form input to validate; preserved untouched on edit
  // and shown read-only in the read view only when present.

  // ── save ──
  $m<HTMLFormElement>('[data-if-reg]')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = fName?.value.trim();
    const id = fId?.value.trim();
    const baseId = fBase?.value || '';
    const type = (fType?.value as 'interface' | 'page') || 'interface';
    if (!name || !id) return;
    if (!baseId) { fBase?.focus(); return; } // Base is required
    if (type === 'page' && !fParent?.value) { fParent?.focus(); return; } // parent required
    if (!saveBtn) return;
    setButtonLoading(saveBtn, true);
    setTimeout(() => {
      const rec: Iface = { id, name, baseId, type, parentId: type === 'page' ? fParent!.value : undefined, status: (editingId ? byId.get(editingId)?.status : 'active') || 'active', published: fPublished ? fPublished.checked : true, internalDescription: fDesc?.value.trim() || undefined, definition: editingId ? byId.get(editingId)?.definition : undefined, tags: tags.slice() };
      byId.set(id, rec);
      upsertRow(rec, editingId);
      setButtonLoading(saveBtn, false);
      openDrawer(false);
      apply();
    }, 550);
  });

  // ── row rendering ──
  const tagCell = (i: Iface) => { const n = (i.tags || []).length; return n ? `<span class="if-row-tags tooltip tooltip-left" data-tip="${n} tagged table${n === 1 ? '' : 's'} / field${n === 1 ? '' : 's'}"><span class="iconify lucide--tags size-3.5" aria-hidden="true"></span><span class="mono-data">${n}</span> tagged</span>` : '<span class="if-dash">—</span>'; };
  const actions = (i: Iface) => `<span class="row-end"><span class="row-actions"><button type="button" class="btn btn-sm btn-ghost btn-square tooltip tooltip-left" data-tip="Edit" data-if-edit="${esc(i.id)}" aria-label="Edit"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button>${i.status === 'removed' ? '' : `<button type="button" class="btn btn-sm btn-ghost btn-square text-error tooltip tooltip-left" data-tip="Delete" data-if-delete="${esc(i.id)}" aria-label="Delete"><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span></button>`}</span><span class="row-go" aria-hidden="true"><span class="iconify lucide--chevron-right size-4"></span></span></span>`;
  const baseOf = (i: Iface) => i.baseId;
  const ifTagIds = (i: Iface, kind: 'table' | 'field') => (i.tags || []).filter((t) => ents[t.entityId]?.kind === kind).map((t) => t.entityId);
  const ifSearch = (i: Iface) => [i.name, i.type, ...(i.tags || []).map((t) => ents[t.entityId]?.name)].filter(Boolean).join(' ').toLowerCase();
  const ifAttrs = (i: Iface) => `data-tables="${esc(ifTagIds(i, 'table').join(' '))}" data-fields="${esc(ifTagIds(i, 'field').join(' '))}" data-search="${esc(ifSearch(i))}"`;
  const pageRowHtml = (p: Iface) => `<div class="if-row if-page row-clickable" data-if-row data-if-kind="page" data-if-id="${esc(p.id)}" data-base="${esc(baseOf(p))}" ${ifAttrs(p)} data-removed-row="${p.status === 'removed' ? '1' : '0'}" role="button" tabindex="0"><span class="if-nm"><span class="iconify lucide--file concept-ic-page size-3.5 if-page-ic" aria-hidden="true"></span><span class="if-row-name">${esc(p.name)}</span></span><span class="if-c-type">Page</span><span class="if-c-status">${ifStatusBadge(p)}</span><span class="if-c-tags">${tagCell(p)}</span><span class="if-c-act">${actions(p)}</span></div>`;
  const parentRowHtml = (i: Iface, pageCount: number) => `<div class="if-parent if-row row-clickable" data-if-row data-if-kind="interface" data-if-id="${esc(i.id)}" data-base="${esc(baseOf(i))}" ${ifAttrs(i)} data-removed-row="${i.status === 'removed' ? '1' : '0'}" role="button" tabindex="0"><span class="if-nm">${pageCount > 0 ? `<button type="button" class="if-twist" data-if-twist aria-expanded="true" aria-label="Toggle pages"><span class="iconify lucide--chevron-down size-4 if-caret" aria-hidden="true"></span></button>` : `<span class="if-twist-spacer" aria-hidden="true"></span>`}<span class="iconify lucide--layout-panel-left concept-ic-interface size-4 if-parent-ic" aria-hidden="true"></span><span class="if-row-name if-parent-name">${esc(i.name)}</span>${pageCount > 0 ? `<span class="if-pagecount mono-data">${pageCount} page${pageCount === 1 ? '' : 's'}</span>` : ''}</span><span class="if-c-type">Interface</span><span class="if-c-status">${ifStatusBadge(i)}</span><span class="if-c-tags">${tagCell(i)}</span><span class="if-c-act">${actions(i)}</span></div>`;

  const list = () => root.querySelector<HTMLElement>('[data-if-list]');
  const nodeOf = (id: string) => root.querySelector<HTMLElement>(`[data-if-node]:has([data-if-id="${CSS.escape(id)}"][data-if-kind="interface"])`);
  // Find (or create) the Base group body a new interface node belongs in.
  const baseGroupBody = (baseId: string): HTMLElement | null => {
    const key = baseId || '__nobase__';
    let bg = root.querySelector<HTMLElement>(`[data-if-basegroup][data-group-key="${CSS.escape(key)}"]`);
    if (!bg) {
      bg = document.createElement('div');
      bg.className = 'if-basegroup'; bg.dataset.ifBasegroup = ''; bg.dataset.groupKey = key;
      bg.innerHTML = `<button type="button" class="if-basegroup-head" data-if-basetwist aria-expanded="true"><span class="iconify lucide--chevron-down size-4 if-caret" aria-hidden="true"></span><span class="iconify lucide--database concept-ic-base size-4 if-basegroup-ic" aria-hidden="true"></span><span class="if-basegroup-name">${esc(baseLabel(baseId))}</span><span class="if-basegroup-count mono-data">0</span></button><div class="if-basegroup-body"><div class="if-thead"><span class="if-th-name" data-sort-col="0">Name</span><span class="if-c-type">Type</span><span class="if-c-status" data-sort-col="2">Status</span><span class="if-c-tags" data-sort-col="3">Tagged</span><span class="if-c-act"></span></div></div>`;
      list()?.querySelector('[data-if-nomatch]')?.before(bg);
      const g = bg;
      bg.querySelector('[data-if-basetwist]')?.addEventListener('click', () => {
        const c = g.hasAttribute('data-collapsed'); c ? g.removeAttribute('data-collapsed') : g.setAttribute('data-collapsed', '');
      });
    }
    return bg.querySelector<HTMLElement>('.if-basegroup-body');
  };
  const bumpBaseCount = (baseId: string) => {
    const key = baseId || '__nobase__';
    const bg = root.querySelector<HTMLElement>(`[data-if-basegroup][data-group-key="${CSS.escape(key)}"]`);
    const c = bg?.querySelector('.if-basegroup-count');
    if (bg && c) c.textContent = String(bg.querySelectorAll('.if-parent[data-if-row]:not([data-removed-row="1"])').length);
  };
  const activePages = (parentId: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-if-row][data-if-kind="page"]`)).filter((r) => byId.get(r.dataset.ifId!)?.parentId === parentId && byId.get(r.dataset.ifId!)?.status !== 'removed').length;

  function upsertRow(i: Iface, prevId: string | null) {
    if (!root) return;
    const existing = prevId ? root.querySelector<HTMLElement>(`[data-if-row][data-if-id="${CSS.escape(prevId)}"]`) : null;
    if (existing) {
      if (i.type === 'page') existing.outerHTML = pageRowHtml(i);
      else { const pc = activePages(i.id); existing.outerHTML = parentRowHtml(i, pc); }
      root.querySelectorAll('[data-if-twist]').forEach((t) => { if (!(t as any)._w) { (t as any)._w = 1; wireTwist(t); } });
      return;
    }
    if (i.type === 'interface') {
      const node = document.createElement('div');
      node.className = 'if-node'; node.dataset.ifNode = '';
      node.innerHTML = parentRowHtml(i, 0) + '<div class="if-children"></div>';
      baseGroupBody(i.baseId)?.appendChild(node);
      node.querySelectorAll('[data-if-twist]').forEach(wireTwist);
      bumpBaseCount(i.baseId);
    } else if (i.parentId) {
      const pnode = nodeOf(i.parentId);
      pnode?.querySelector('.if-children')?.insertAdjacentHTML('beforeend', pageRowHtml(i));
      // ensure the parent has a caret + refreshed page count
      const prow = pnode?.querySelector<HTMLElement>('.if-parent[data-if-row]');
      if (prow) {
        const parent = byId.get(i.parentId);
        if (parent) { prow.outerHTML = parentRowHtml(parent, activePages(i.parentId)); pnode?.querySelectorAll('[data-if-twist]').forEach(wireTwist); }
      }
    }
  }

  function softDelete(id: string) {
    if (!root) return;
    const rec = byId.get(id);
    if (rec) rec.status = 'removed';
    const row = root.querySelector<HTMLElement>(`[data-if-row][data-if-id="${CSS.escape(id)}"]`);
    if (row && rec) {
      row.outerHTML = rec.type === 'page' ? pageRowHtml(rec) : parentRowHtml(rec, activePages(rec.id));
      root.querySelectorAll('[data-if-twist]').forEach((t) => { if (!(t as any)._w) { (t as any)._w = 1; wireTwist(t); } });
    }
    apply();
  }

  // ── click-to-sort the interface nodes within each Base (Name · Status · Tagged) ──
  wireTableSort(
    root,
    () => Array.from(root.querySelectorAll<HTMLElement>('.if-basegroup')).map((g) => ({
      headers: Array.from(g.querySelectorAll<HTMLElement>('.if-thead [data-sort-col]')),
      container: g.querySelector<HTMLElement>('.if-basegroup-body')!,
      items: () => Array.from(g.querySelectorAll<HTMLElement>('.if-node')),
    })),
    (node, col) => {
      const p = node.querySelector<HTMLElement>('.if-parent[data-if-row]');
      if (!p) return '';
      if (col === 0) return (p.querySelector('.if-row-name')?.textContent || '').trim().toLowerCase();
      if (col === 2) return ({ Published: 0, 'Not published': 1, Removed: 2 } as Record<string, number>)[(p.querySelector('.if-c-status')?.textContent || '').trim()] ?? 3;
      if (col === 3) { const m = (p.querySelector('.if-c-tags')?.textContent || '').match(/\d+/); return m ? Number(m[0]) : -1; }
      return '';
    },
    () => { pager.reset(); apply(); },
  );

  apply();
}
