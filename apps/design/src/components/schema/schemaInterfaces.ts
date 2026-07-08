/**
 * Client wiring for SchemaInterfaces.astro (the Interfaces tab). Frontmatter-thin, all
 * server behavior FAKED. Handles: per-interface page collapse, base filter, include-removed,
 * the create/edit modal (type interface|page, parent-interface required when page), the
 * Table/Field tag-picker (schema:ifTagAdd → auto/manual chips), definition JSON format/
 * validate, and save/soft-delete (append/update rows in place).
 */
import { setButtonLoading } from '../../lib/ui';
import { wireTableSort } from './tableSort';

interface IfTag { entityId: string; source: 'auto' | 'manual' }
interface Iface { id: string; name: string; type: 'interface' | 'page'; baseId: string; parentId?: string; status: 'active' | 'removed'; published?: boolean; internalDescription?: string; definition?: string; tags?: IfTag[]; removedAt?: string }
type Ent = { name: string; kind: 'base' | 'table' | 'field'; tableName: string | null };

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const entIcon = (kind: string) => kind === 'field' ? 'lucide--tag concept-ic-field' : kind === 'table' ? 'lucide--table-2' : 'lucide--database concept-ic-base';

// Status badge (mirror of the Astro ifStatusBadge): Published / Not published / Removed,
// our Storybook badge-soft + semantic + bg-current dot. Shown for interfaces AND pages.
const ifStatusBadge = (i: Iface) => {
  if (i.status === 'removed') return `<span class="badge badge-soft badge-warning if-badge tooltip tooltip-right" data-tip="No longer exists in Airtable"><span class="size-1.5 rounded-full bg-current"></span>Removed</span>`;
  return i.published === false
    ? `<span class="badge badge-soft badge-neutral if-badge tooltip tooltip-right" data-tip="Not published in Airtable — not live for users yet"><span class="size-1.5 rounded-full bg-current"></span>Not published</span>`
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
  // Per-interface/page change history (read drawer Changelog section).
  type IfChange = { entityId?: string; at: string; type: string; summary: string; before?: string; after?: string };
  let changelog: IfChange[] = [];
  try { changelog = JSON.parse(document.querySelector('[data-if-changelog]')?.textContent || '[]'); } catch { /* none */ }
  const CL_ICON: Record<string, string> = { added: 'lucide--plus-circle', removed: 'lucide--minus-circle', renamed: 'lucide--pencil-line', config: 'lucide--sliders-horizontal' };
  const fmtCl = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const changelogHtml = (id: string) => {
    const evs = changelog.filter((c) => c.entityId === id).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    if (!evs.length) return '';
    const items = evs.map((c) => `<li class="if-cl-item if-cl-${c.type}"><span class="iconify ${CL_ICON[c.type] || 'lucide--dot'} size-3.5 if-cl-ic" aria-hidden="true"></span><span class="if-cl-txt">${esc(c.summary)}${c.before && c.after ? ` <span class="if-cl-delta">${esc(c.before)} → ${esc(c.after)}</span>` : ''}</span><span class="if-cl-when">${esc(fmtCl(c.at))}</span></li>`).join('');
    return `<div><div class="if-read-sect-lbl"><span class="iconify lucide--history size-3.5 if-read-sect-ic" aria-hidden="true"></span>Changelog</div><ul class="if-cl">${items}</ul></div>`;
  };

  // ── filters (search · Base/Table/Field facets · include-removed) — node-based so the tree stays intact ──
  const removedToggle = root.querySelector<HTMLInputElement>('[data-if-removed]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-if-search]');
  const clearBtn = root.querySelector<HTMLElement>('[data-if-clear]');
  const facetHidden: Record<string, Set<string>> = { ifbase: new Set(), iftable: new Set(), iffield: new Set() };
  let includeRemoved = false;
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
  const anyFilter = () => !!query || includeRemoved || Object.values(facetHidden).some((s) => s.size > 0);
  const apply = () => {
    let shown = 0;
    root.querySelectorAll<HTMLElement>('[data-if-node]').forEach((node) => {
      const rows = Array.from(node.querySelectorAll<HTMLElement>('[data-if-row]'));
      // per-row removed visibility, then keep the whole node if any visible row matches the filters
      rows.forEach((r) => { r.hidden = (r.dataset.removedRow === '1' && !includeRemoved) || r.dataset.dismissed === '1'; });
      const nodeMatch = rows.some((r) => !r.hidden && rowMatch(r));
      node.hidden = !nodeMatch;
      if (!node.hidden) shown++;
    });
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
    if (!(d.name in facetHidden)) return; // ignore other tabs' facets
    facetHidden[d.name] = new Set<string>(d.hidden || []);
    apply();
  });
  removedToggle?.addEventListener('change', () => { includeRemoved = !!removedToggle.checked; apply(); });
  searchInput?.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); apply(); });
  clearBtn?.addEventListener('click', () => {
    Object.keys(facetHidden).forEach((k) => (facetHidden[k] = new Set()));
    query = ''; includeRemoved = false;
    if (searchInput) searchInput.value = '';
    if (removedToggle) removedToggle.checked = false;
    document.dispatchEvent(new CustomEvent('facetreset'));
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
  const readEl = $m<HTMLElement>('[data-if-read]');
  const formEl = $m<HTMLElement>('[data-if-form]');
  const title = panel?.querySelector<HTMLElement>('.sb-drawer-title');
  const saveBtn = $m<HTMLButtonElement>('[data-if-save]');
  let editingId: string | null = null;
  let readingId: string | null = null;
  let tags: IfTag[] = [];

  const chipHtml = (t: IfTag) => {
    const e = ents[t.entityId];
    const label = e ? (e.kind === 'field' && e.tableName ? `${e.name} · ${e.tableName}` : e.name) : t.entityId;
    return `<span class="if-chip if-chip-${t.source}" data-if-chip="${esc(t.entityId)}"><span class="iconify ${entIcon(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>${esc(label)}${t.source === 'manual' ? `<button type="button" class="if-chip-x" data-if-chip-x="${esc(t.entityId)}" aria-label="Remove tag"><span class="iconify lucide--x size-3" aria-hidden="true"></span></button>` : ''}</span>`;
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
    if (title) title.textContent = editingId ? (isPage ? 'Edit page' : 'Edit interface') : (isPage ? 'Register page' : 'Register interface');
    if (saveBtn) saveBtn.textContent = editingId ? 'Save changes' : (isPage ? 'Register page' : 'Register interface');
  };
  fType?.addEventListener('change', syncType);
  // Changing the Base re-scopes the parent-interface options.
  fBase?.addEventListener('change', () => fillParents(editingId));

  // Read view (default on row click) — leads with description + pages + what it touches.
  const readChip = (t: IfTag) => {
    const e = ents[t.entityId];
    const label = e ? (e.kind === 'field' && e.tableName ? `${e.name} · ${e.tableName}` : e.name) : t.entityId;
    return `<button type="button" class="if-chip if-chip-${t.source}" data-entity-open="${esc(t.entityId)}"><span class="iconify ${entIcon(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>${esc(label)}</button>`;
  };
  const openRead = (id: string) => {
    const i = byId.get(id);
    if (!i || !readEl) return;
    readingId = id;
    if (title) title.textContent = i.name;
    const removed = i.status === 'removed';
    const kindLabel = i.type === 'page' ? 'Page' : 'Interface';
    // Breadcrumbs — trace the Interface ▸ Page hierarchy (clickable back to the parent).
    const parent = i.type === 'page' && i.parentId ? byId.get(i.parentId) : null;
    const crumbs = parent
      ? `<nav class="if-read-crumbs"><button type="button" class="if-crumb" data-if-read-open="${esc(parent.id)}">${esc(parent.name)}</button><span class="if-crumb-sep" aria-hidden="true">›</span><span class="if-crumb-cur">${esc(i.name)}</span></nav>`
      : '';
    // Interface → list its Pages. (A page's parent is already shown by the breadcrumb.)
    let related = '';
    if (i.type === 'interface') {
      const pages = [...byId.values()].filter((p) => p.type === 'page' && p.parentId === i.id && p.status !== 'removed');
      if (pages.length) related = `<div><div class="if-read-sect-lbl"><span class="iconify lucide--layout-panel-left size-3.5 if-read-sect-ic" aria-hidden="true"></span>Pages</div><div class="if-read-pages">${pages.map((p) => `<button type="button" class="if-read-page" data-if-read-open="${esc(p.id)}"><span class="iconify lucide--file size-3.5" aria-hidden="true"></span>${esc(p.name)}</button>`).join('')}</div></div>`;
    }
    readEl.innerHTML = `
      ${crumbs}
      <div class="if-read-meta"><span class="badge badge-soft badge-primary">${kindLabel}</span>${ifStatusBadge(i)}<span class="if-read-base"><span class="iconify lucide--database concept-ic-base size-3.5" aria-hidden="true"></span>${esc(baseLabel(i.baseId))}</span></div>
      <div><div class="if-read-sect-lbl"><span class="iconify lucide--text size-3.5 if-read-sect-ic" aria-hidden="true"></span>Internal note</div><p class="if-read-desc${i.internalDescription ? '' : ' is-empty'}">${i.internalDescription ? esc(i.internalDescription) : 'No note yet — add one so teammates know what this shows.'}</p></div>
      ${related}
      <div><div class="if-read-sect-lbl"><span class="iconify lucide--at-sign size-3.5 if-read-sect-ic" aria-hidden="true"></span>Touches</div>${(i.tags || []).length ? `<div class="if-read-chips">${(i.tags || []).map(readChip).join('')}</div>` : `<p class="if-read-empty">No tables or fields tagged.</p>`}</div>
      ${changelogHtml(i.id)}
      ${i.definition ? `<details class="if-read-def"><summary>Raw definition (JSON)</summary><pre>${esc(i.definition)}</pre></details>` : ''}
      <div class="if-read-foot"><button type="button" class="btn btn-sm btn-neutral gap-1.5" data-if-read-edit><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span>Edit</button>${removed ? '' : `<button type="button" class="btn btn-sm btn-ghost text-error gap-1.5" data-if-read-delete><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span>Delete</button>`}</div>`;
    readEl.hidden = false;
    if (formEl) formEl.hidden = true;
    openDrawer(true);
  };

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
    if (readEl) readEl.hidden = true;
    if (formEl) formEl.hidden = false;
    openDrawer(true);
    setTimeout(() => fName?.focus(), 0);
  };
  root.querySelectorAll<HTMLElement>('[data-if-new]').forEach((b) => b.addEventListener('click', () => openEdit(null, (b.dataset.ifNew as 'interface' | 'page') || 'interface')));
  $m<HTMLElement>('[data-if-cancel]')?.addEventListener('click', () => openDrawer(false));
  readEl?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-if-read-edit]')) { if (readingId) openEdit(readingId); return; }
    if (t.closest('[data-if-read-delete]')) { if (readingId) softDelete(readingId); openDrawer(false); return; }
    const openOther = t.closest<HTMLElement>('[data-if-read-open]');
    if (openOther) { openRead(openOther.dataset.ifReadOpen!); return; }
    if (t.closest('[data-entity-open]')) openDrawer(false);
  });
  // EntityPanel "Referenced by" jump opens the interface/page read view here.
  document.addEventListener('schema:openInterface', (ev) => {
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (id && byId.has(id)) openRead(id);
  });

  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-if-twist]')) return; // collapse handled separately
    const edit = t.closest<HTMLElement>('[data-if-edit]');
    if (edit) { ev.stopPropagation(); openEdit(edit.dataset.ifEdit!); return; }
    const del = t.closest<HTMLElement>('[data-if-delete]');
    if (del) { ev.stopPropagation(); softDelete(del.dataset.ifDelete!); return; }
    const row = t.closest<HTMLElement>('[data-if-row]');
    if (row && !row.classList.contains('if-orphan-head')) openRead(row.dataset.ifId!);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-if-row]');
    if (!row || row.classList.contains('if-orphan-head')) return;
    ev.preventDefault();
    openRead(row.dataset.ifId!);
  });

  // ── tag-picker ──
  document.addEventListener('schema:ifTagAdd', (ev) => {
    if (!toggle?.checked) return;
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
  $m<HTMLFormElement>('[data-if-form]')?.addEventListener('submit', (ev) => {
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
  const actions = (i: Iface) => `<span class="if-row-actions"><button type="button" class="btn btn-sm btn-ghost btn-square" data-if-edit="${esc(i.id)}" aria-label="Edit"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button>${i.status === 'removed' ? '' : `<button type="button" class="btn btn-sm btn-ghost btn-square text-error" data-if-delete="${esc(i.id)}" aria-label="Delete"><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span></button>`}</span>`;
  const baseOf = (i: Iface) => i.baseId;
  const ifTagIds = (i: Iface, kind: 'table' | 'field') => (i.tags || []).filter((t) => ents[t.entityId]?.kind === kind).map((t) => t.entityId);
  const ifSearch = (i: Iface) => [i.name, i.type, ...(i.tags || []).map((t) => ents[t.entityId]?.name)].filter(Boolean).join(' ').toLowerCase();
  const ifAttrs = (i: Iface) => `data-tables="${esc(ifTagIds(i, 'table').join(' '))}" data-fields="${esc(ifTagIds(i, 'field').join(' '))}" data-search="${esc(ifSearch(i))}"`;
  const pageRowHtml = (p: Iface) => `<div class="if-row if-page" data-if-row data-if-kind="page" data-if-id="${esc(p.id)}" data-base="${esc(baseOf(p))}" ${ifAttrs(p)} data-removed-row="${p.status === 'removed' ? '1' : '0'}" role="button" tabindex="0"><span class="if-nm"><span class="iconify lucide--file concept-ic-page size-3.5 if-page-ic" aria-hidden="true"></span><span class="if-row-name">${esc(p.name)}</span></span><span class="if-c-type">Page</span><span class="if-c-status">${ifStatusBadge(p)}</span><span class="if-c-tags">${tagCell(p)}</span><span class="if-c-act">${actions(p)}</span></div>`;
  const parentRowHtml = (i: Iface, pageCount: number) => `<div class="if-parent if-row" data-if-row data-if-kind="interface" data-if-id="${esc(i.id)}" data-base="${esc(baseOf(i))}" ${ifAttrs(i)} data-removed-row="${i.status === 'removed' ? '1' : '0'}" role="button" tabindex="0"><span class="if-nm">${pageCount > 0 ? `<button type="button" class="if-twist" data-if-twist aria-expanded="true" aria-label="Toggle pages"><span class="iconify lucide--chevron-down size-4 if-caret" aria-hidden="true"></span></button>` : `<span class="if-twist-spacer" aria-hidden="true"></span>`}<span class="iconify lucide--layout-panel-left concept-ic-interface size-4 if-parent-ic" aria-hidden="true"></span><span class="if-row-name if-parent-name">${esc(i.name)}</span>${pageCount > 0 ? `<span class="if-pagecount mono-data">${pageCount} page${pageCount === 1 ? '' : 's'}</span>` : ''}</span><span class="if-c-type">Interface</span><span class="if-c-status">${ifStatusBadge(i)}</span><span class="if-c-tags">${tagCell(i)}</span><span class="if-c-act">${actions(i)}</span></div>`;

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
  );

  apply();
}
