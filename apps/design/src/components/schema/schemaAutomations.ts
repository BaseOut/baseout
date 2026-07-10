/**
 * Client wiring for SchemaAutomations.astro (the Automations tab). Frontmatter-thin.
 * All server behavior is FAKED (no backend). Handles: group collapse, base filter,
 * include-removed, open the create/edit modal (new + edit), soft-delete, the Table/Field
 * tag-picker (auto vs manual chips, added via EntitySearch's schema:auTagAdd), the raw
 * `definition` JSON format/validate, and save (appends/updates a row in place).
 */
import { setButtonLoading } from '../../lib/ui';
import { wireTableSort } from './tableSort';
import { entityChip } from './entityChip';
import { locationCrumbs } from './locationCrumbs';

interface AuTag { entityId: string; source: 'auto' | 'manual' }
interface Automation { id: string; name: string; baseId: string; triggerType?: string; status: 'active' | 'removed'; enabled?: boolean; airtableDescription?: string; internalDescription?: string; subscribers?: string[]; definition?: string; tags?: AuTag[]; removedAt?: string }
type Ent = { name: string; kind: 'base' | 'table' | 'field'; tableName: string | null };

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const entIcon = (kind: string) => kind === 'field' ? 'lucide--tag concept-ic-field' : kind === 'table' ? 'lucide--table-2' : 'lucide--database concept-ic-base';
// Section count badge (DRAWER CANON v2): a catalog badge pressed after the label, shown only from 2 up (suppress "1").
const countBadge = (n: number) => (n >= 2 ? ` <span class="badge badge-sm badge-neutral">${n}</span>` : '');

// Identity status (read drawer meta line): a colored DOT + label, NOT a soft badge.
// Active = green, Inactive (off) = grey, Removed = red. (The soft badge stays in the listing.)
const statusDot = (a: Automation) => {
  const removed = a.status === 'removed';
  const on = a.enabled !== false;
  const tone = removed ? 'red' : on ? 'green' : 'grey';
  const label = removed ? 'Removed' : on ? 'Active' : 'Inactive';
  return `<span class="au-status"><span class="au-dot au-dot-${tone}"></span>${label}</span>`;
};

// Status badge (mirror of the Astro statusBadge): badge-soft + semantic color + bg-current dot.
const statusBadge = (a: Automation) => {
  const removed = a.status === 'removed';
  const on = a.enabled !== false;
  if (removed) return `<span class="badge badge-soft badge-warning au-badge tooltip tooltip-right" data-tip="No longer exists in Airtable"><span class="size-1.5 rounded-full bg-current"></span>Removed</span>`;
  return on
    ? `<span class="badge badge-soft badge-success au-badge tooltip tooltip-right" data-tip="On in Airtable — this automation is running"><span class="size-1.5 rounded-full bg-current"></span>Active</span>`
    : `<span class="badge badge-soft badge-neutral au-badge tooltip tooltip-right" data-tip="Off in Airtable — this automation isn't running"><span class="size-1.5 rounded-full bg-current"></span>Inactive</span>`;
};

export function wireAutomations() {
  const root = document.querySelector<HTMLElement>('[data-automations]');
  if (!root || root.dataset.auWired) return;
  root.dataset.auWired = '1';
  if (root.dataset.canUse !== '1') return; // gated — nothing to wire

  const byId = new Map<string, Automation>();
  const ents: Record<string, Ent> = {};
  try { for (const a of JSON.parse(document.querySelector('[data-au-json]')?.textContent || '[]') as Automation[]) byId.set(a.id, a); } catch { /* none */ }
  try { Object.assign(ents, JSON.parse(document.querySelector('[data-au-entindex]')?.textContent || '{}')); } catch { /* none */ }
  const basesMap: Record<string, string> = {};
  try { Object.assign(basesMap, JSON.parse(document.querySelector('[data-au-bases]')?.textContent || '{}')); } catch { /* none */ }
  const baseLabel = (id?: string) => (id && basesMap[id]) || 'No base';
  // Per-automation change history (read drawer Changelog section).
  type AuChange = { entityId?: string; at: string; type: string; summary: string; before?: string; after?: string };
  let changelog: AuChange[] = [];
  try { changelog = JSON.parse(document.querySelector('[data-au-changelog]')?.textContent || '[]'); } catch { /* none */ }
  const CL_ICON: Record<string, string> = { added: 'lucide--plus-circle', removed: 'lucide--minus-circle', renamed: 'lucide--pencil-line', config: 'lucide--sliders-horizontal' };
  const fmtCl = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const changelogHtml = (id: string) => {
    const evs = changelog.filter((c) => c.entityId === id).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    if (!evs.length) return '';
    const items = evs.map((c) => `<li class="au-cl-item au-cl-${c.type}"><span class="iconify ${CL_ICON[c.type] || 'lucide--dot'} size-3.5 au-cl-ic" aria-hidden="true"></span><span class="au-cl-txt">${esc(c.summary)}${c.before && c.after ? ` <span class="au-cl-delta">${esc(c.before)} → ${esc(c.after)}</span>` : ''}</span><span class="au-cl-when">${esc(fmtCl(c.at))}</span></li>`).join('');
    return `<div><div class="au-read-sect-lbl"><span class="iconify lucide--history size-3.5 au-read-sect-ic" aria-hidden="true"></span>Changelog${countBadge(evs.length)}</div><ul class="au-cl">${items}</ul></div>`;
  };

  // ── filters (search · Base/Table/Field facets · include-removed) — same model as Browse/Relationships ──
  const rowsAll = () => Array.from(root.querySelectorAll<HTMLElement>('[data-au-row]'));
  const removedToggle = root.querySelector<HTMLInputElement>('[data-au-removed]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-au-search]');
  const clearBtn = root.querySelector<HTMLElement>('[data-au-clear]');
  const facetHidden: Record<string, Set<string>> = { aubase: new Set(), autable: new Set(), aufield: new Set() };
  let includeRemoved = false;
  let query = '';
  // A row passes a tag-facet when it has at least one value that isn't hidden (empty tag list → fails
  // only when the facet is active, i.e. the automation touches none of the shown tables/fields).
  const someShown = (ids: string, hidden: Set<string>) => ids.split(' ').filter(Boolean).some((v) => !hidden.has(v));
  const rowVisible = (row: HTMLElement) => {
    if (row.dataset.dismissed === '1') return false;
    if (!includeRemoved && row.dataset.removedRow === '1') return false;
    if (query && !(row.dataset.search || '').includes(query)) return false;
    if (facetHidden.aubase.has(row.dataset.base || '')) return false;
    if (facetHidden.autable.size && !someShown(row.dataset.tables || '', facetHidden.autable)) return false;
    if (facetHidden.aufield.size && !someShown(row.dataset.fields || '', facetHidden.aufield)) return false;
    return true;
  };
  const anyFilter = () => !!query || includeRemoved || Object.values(facetHidden).some((s) => s.size > 0);
  const apply = () => {
    let shown = 0;
    rowsAll().forEach((row) => { const ok = rowVisible(row); row.hidden = !ok; if (ok) shown++; });
    root.querySelectorAll<HTMLElement>('[data-au-group]').forEach((g) => {
      g.hidden = !Array.from(g.querySelectorAll<HTMLElement>('[data-au-row]')).some((r) => !r.hidden);
    });
    const nomatch = root.querySelector<HTMLElement>('[data-au-nomatch]');
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

  // ── group collapse ──
  root.querySelectorAll<HTMLElement>('[data-au-twist]').forEach((t) =>
    t.addEventListener('click', () => {
      const g = t.closest<HTMLElement>('[data-au-group]');
      if (!g) return;
      const collapsed = g.hasAttribute('data-collapsed');
      collapsed ? g.removeAttribute('data-collapsed') : g.setAttribute('data-collapsed', '');
      t.setAttribute('aria-expanded', String(collapsed));
    }),
  );

  // ── modal (create / edit) ──
  // The create/edit form lives in a right Drawer (checkbox-driven). #au-modal is the
  // drawer-toggle checkbox; the fields live in the drawer's panel.
  const toggle = document.getElementById('au-modal') as HTMLInputElement | null;
  const panel = (toggle?.closest('.sb-drawer')?.querySelector('.sb-drawer-panel') as HTMLElement | null) ?? null;
  const openDrawer = (v: boolean) => { if (toggle) toggle.checked = v; };
  const $m = <T extends HTMLElement>(sel: string) => panel?.querySelector<T>(sel) ?? null;
  const fName = $m<HTMLInputElement>('[data-au-f-name]');
  const fId = $m<HTMLInputElement>('[data-au-f-id]');
  const fBase = $m<HTMLSelectElement>('[data-au-f-base]');
  const fTrigger = $m<HTMLSelectElement>('[data-au-f-trigger]');
  const fEnabled = $m<HTMLInputElement>('[data-au-f-enabled]');
  const fDesc = $m<HTMLTextAreaElement>('[data-au-f-desc]');
  const fAirDesc = $m<HTMLTextAreaElement>('[data-au-f-airdesc]');
  const fSub = $m<HTMLInputElement>('[data-au-f-sub]');
  const subsWrap = $m<HTMLElement>('[data-au-subs]');
  const chipsWrap = $m<HTMLElement>('[data-au-chips]');
  const readEl = $m<HTMLElement>('[data-au-read]');
  const formEl = $m<HTMLElement>('[data-au-form]');
  const title = panel?.querySelector<HTMLElement>('.sb-drawer-title');
  const titleIc = panel?.querySelector<HTMLElement>('[data-sb-drawer-titleic]');
  const crumbsEl = panel?.querySelector<HTMLElement>('[data-sb-drawer-crumbs]');
  const saveBtn = $m<HTMLButtonElement>('[data-au-save]');
  let editingId: string | null = null;
  let readingId: string | null = null;
  let tags: AuTag[] = [];
  let subs: string[] = [];

  // Description tabs (Airtable / Internal) — mirror the field-description tab pattern, minus Publish.
  const showDescTab = (key: string) => {
    panel?.querySelectorAll<HTMLElement>('[data-au-desc-tab]').forEach((x) => x.classList.toggle('au-desc-tab-on', x.dataset.auDescTab === key));
    panel?.querySelectorAll<HTMLElement>('[data-au-desc-panel]').forEach((p) => (p.hidden = p.dataset.auDescPanel !== key));
  };
  panel?.querySelectorAll<HTMLElement>('[data-au-desc-tab]').forEach((t) => t.addEventListener('click', () => showDescTab(t.dataset.auDescTab || 'airtable')));

  // Subscriber email chips (free-text, validated on add).
  const renderSubs = () => { if (subsWrap) subsWrap.innerHTML = subs.map((e) => `<span class="au-sub"><span class="iconify lucide--mail size-3.5" aria-hidden="true" style="opacity:.6"></span>${esc(e)}<button type="button" class="au-sub-x" data-au-sub-x="${esc(e)}" aria-label="Remove"><span class="iconify lucide--x size-3" aria-hidden="true"></span></button></span>`).join(''); };
  const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const chipHtml = (t: AuTag) => {
    const e = ents[t.entityId];
    const name = e ? e.name : t.entityId;
    const context = e && e.kind === 'field' && e.tableName ? e.tableName : undefined;
    const icon = `<span class="iconify ${entIcon(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>`;
    return entityChip({ name, icon, context, attrs: 'data-au-chip="' + esc(t.entityId) + '"', remove: t.source === 'manual' ? 'data-au-chip-x="' + esc(t.entityId) + '"' : undefined, derived: t.source === 'auto' });
  };
  const renderChips = () => { if (chipsWrap) chipsWrap.innerHTML = tags.map(chipHtml).join(''); };

  // Read view (default on row click) — leads with description + what it touches; the raw
  // JSON is opaque/optional, tucked at the bottom.
  const readChip = (t: AuTag) => {
    const e = ents[t.entityId];
    const name = e ? e.name : t.entityId;
    const context = e && e.kind === 'field' && e.tableName ? e.tableName : undefined;
    const icon = `<span class="iconify ${entIcon(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>`;
    // Read view: plain neutral chip — the auto/manual distinction isn't actionable here, so we don't signal it.
    return entityChip({ name, icon, context, clickable: true, attrs: 'data-entity-open="' + esc(t.entityId) + '"' });
  };
  const openRead = (id: string) => {
    const a = byId.get(id);
    if (!a || !readEl) return;
    readingId = id;
    // Canon drawer header: the concept-icon tile + entity name live in the fixed rail (like the other
    // detail drawers); the body opens with the identity meta line. Populate the rail here.
    if (titleIc) { titleIc.innerHTML = '<span class="iconify lucide--zap concept-ic-automation size-4" aria-hidden="true"></span>'; titleIc.hidden = false; }
    if (title) title.textContent = a.name;
    // Location → header crumbs sub-row (the base), not the meta line.
    if (crumbsEl) {
      crumbsEl.innerHTML = locationCrumbs([
        { name: baseLabel(a.baseId), icon: '<span class="iconify lucide--database concept-ic-base size-3.5"></span>' },
      ]);
      crumbsEl.hidden = false;
    }
    const removed = a.status === 'removed';
    const subCount = (a.subscribers || []).length;
    const subsHtml = subCount
      ? `<div><div class="au-read-sect-lbl"><span class="iconify lucide--users size-3.5 au-read-sect-ic" aria-hidden="true"></span>Subscribers${countBadge(subCount)}</div><div class="au-read-listbox">${(a.subscribers || []).map((e) => `<span class="au-read-sub"><span class="iconify lucide--mail size-3.5" aria-hidden="true" style="opacity:.6"></span>${esc(e)}</span>`).join('')}</div></div>`
      : '';
    // Two descriptions: the Airtable-side copy (manual, no sync) + the Baseout-only Internal note.
    const noteHtml =
      `<div><div class="au-read-sect-lbl"><span class="iconify lucide--text size-3.5 au-read-sect-ic" aria-hidden="true"></span>Airtable description</div><p class="au-read-desc${a.airtableDescription ? '' : ' is-empty'}">${a.airtableDescription ? esc(a.airtableDescription) : 'No Airtable description saved.'}</p></div>` +
      `<div><div class="au-read-sect-lbl"><span class="iconify lucide--text size-3.5 au-read-sect-ic" aria-hidden="true"></span>Internal note</div><p class="au-read-desc${a.internalDescription ? '' : ' is-empty'}">${a.internalDescription ? esc(a.internalDescription) : 'No internal note yet.'}</p></div>`;
    const tagCount = (a.tags || []).length;
    readEl.innerHTML = `
      <div class="au-read-meta"><span class="au-read-kind">Automation</span><span class="au-read-sep" aria-hidden="true">·</span>${statusDot(a)}<span class="au-read-sep" aria-hidden="true">·</span><span class="au-meta-fresh">as of last backup</span></div>
      ${a.triggerType ? `<div><div class="au-read-sect-lbl"><span class="iconify lucide--zap size-3.5 au-read-sect-ic" aria-hidden="true"></span>Trigger</div><p class="au-read-desc">${esc(a.triggerType)}</p></div>` : ''}
      ${noteHtml}
      <div><div class="au-read-sect-lbl"><span class="iconify lucide--at-sign size-3.5 au-read-sect-ic" aria-hidden="true"></span>Touches${countBadge(tagCount)}</div>${tagCount ? `<div class="au-read-listbox">${(a.tags || []).map(readChip).join('')}</div>` : `<p class="au-read-empty">No tables or fields tagged.</p>`}</div>
      ${subsHtml}
      ${changelogHtml(a.id)}
      ${a.definition ? `<details class="sch-read-def"><summary>Raw definition (JSON)<span class="iconify lucide--chevron-down size-3.5 sch-def-chev" aria-hidden="true"></span></summary><pre>${esc(a.definition)}</pre></details>` : ''}
      <div class="sch-read-foot"><button type="button" class="btn btn-sm btn-neutral gap-1.5" data-read-edit><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span>Edit</button>${removed ? '' : `<button type="button" class="btn btn-sm btn-ghost text-error gap-1.5" data-read-delete><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span>Delete</button>`}</div>`;
    readEl.hidden = false;
    if (formEl) formEl.hidden = true;
    openDrawer(true);
  };

  const openEdit = (id: string | null) => {
    editingId = id;
    const a = id ? byId.get(id) : null;
    if (titleIc) { titleIc.innerHTML = ''; titleIc.hidden = true; }
    if (crumbsEl) { crumbsEl.innerHTML = ''; crumbsEl.hidden = true; }
    if (title) title.textContent = a ? 'Edit automation' : 'Register automation';
    if (saveBtn) saveBtn.textContent = a ? 'Save changes' : 'Register automation';
    if (fName) fName.value = a?.name ?? '';
    if (fId) { fId.value = a?.id ?? ''; fId.readOnly = !!a; }
    if (fBase) fBase.value = a?.baseId ?? '';
    if (fTrigger) {
      // Preserve a legacy / custom trigger value that isn't one of the canonical options.
      const tv = a?.triggerType ?? '';
      if (tv && !Array.from(fTrigger.options).some((o) => o.value === tv)) fTrigger.add(new Option(tv, tv));
      fTrigger.value = tv;
    }
    if (fEnabled) fEnabled.checked = a ? a.enabled !== false : true;
    if (fAirDesc) fAirDesc.value = a?.airtableDescription ?? '';
    if (fDesc) fDesc.value = a?.internalDescription ?? '';
    showDescTab('airtable'); // always land on the Airtable tab
    if (fSub) { fSub.value = ''; fSub.setCustomValidity(''); }
    subs = (a?.subscribers ?? []).slice();
    renderSubs();
    tags = (a?.tags ?? []).map((t) => ({ ...t }));
    renderChips();
    if (readEl) readEl.hidden = true;
    if (formEl) formEl.hidden = false;
    openDrawer(true);
    setTimeout(() => fName?.focus(), 0);
  };
  root.querySelectorAll<HTMLElement>('[data-au-new]').forEach((b) => b.addEventListener('click', () => openEdit(null)));
  $m<HTMLElement>('[data-au-cancel]')?.addEventListener('click', () => openDrawer(false));
  // Read-view actions: Edit → the form; Delete → soft-delete + close; a tag chip → close
  // the drawer so the EntityPanel (opened by the global data-entity-open delegate) shows.
  readEl?.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('[data-read-edit]')) { if (readingId) openEdit(readingId); return; }
    if (t.closest('[data-read-delete]')) { if (readingId) softDelete(readingId); openDrawer(false); return; }
    if (t.closest('[data-entity-open]')) openDrawer(false);
  });
  // EntityPanel "Referenced by" jump opens the automation's read view here.
  document.addEventListener('schema:openAutomation', (ev) => {
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (id && byId.has(id)) openRead(id);
  });

  // edit / delete (row actions) + row click → edit
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const edit = t.closest<HTMLElement>('[data-au-edit]');
    if (edit) { ev.stopPropagation(); openEdit(edit.dataset.auEdit!); return; }
    const del = t.closest<HTMLElement>('[data-au-delete]');
    if (del) { ev.stopPropagation(); softDelete(del.dataset.auDelete!); return; }
    const row = t.closest<HTMLElement>('[data-au-row]');
    if (row) openRead(row.dataset.auId!);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-au-row]');
    if (!row) return;
    ev.preventDefault();
    openRead(row.dataset.auId!);
  });

  // ── tag-picker: add (EntitySearch) / remove ──
  document.addEventListener('schema:auTagAdd', (ev) => {
    if (!toggle?.checked) return;
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (!id || tags.some((t) => t.entityId === id)) return;
    tags.push({ entityId: id, source: 'manual' });
    renderChips();
  });
  chipsWrap?.addEventListener('click', (ev) => {
    const x = (ev.target as HTMLElement).closest<HTMLElement>('[data-au-chip-x]');
    if (!x) return;
    tags = tags.filter((t) => t.entityId !== x.dataset.auChipX);
    renderChips();
  });

  // ── subscribers: add on Enter (or comma), remove on × ──
  const addSub = () => {
    const v = (fSub?.value || '').trim().replace(/,$/, '').toLowerCase();
    if (!v || !fSub) return;
    if (!isEmail(v)) { fSub.setCustomValidity('Enter a valid email'); fSub.reportValidity(); return; }
    fSub.setCustomValidity('');
    if (!subs.includes(v)) { subs.push(v); renderSubs(); }
    fSub.value = '';
  };
  fSub?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); addSub(); }
  });
  fSub?.addEventListener('blur', () => { if ((fSub?.value || '').trim()) addSub(); });
  subsWrap?.addEventListener('click', (ev) => {
    const x = (ev.target as HTMLElement).closest<HTMLElement>('[data-au-sub-x]');
    if (!x) return;
    subs = subs.filter((e) => e !== x.dataset.auSubX);
    renderSubs();
  });

  // Raw `definition` JSON is API-only (scraped automations) — never hand-entered here, so there's
  // no form input to validate; the stored value is preserved untouched on edit + shown read-only
  // in the read view when present.

  // ── save (faked) ──
  const form = $m<HTMLFormElement>('[data-au-form]');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = fName?.value.trim();
    const id = fId?.value.trim();
    const baseId = fBase?.value || '';
    if (!name || !id) return;
    if (!baseId) { fBase?.focus(); return; } // Base is required
    if (!saveBtn) return;
    setButtonLoading(saveBtn, true);
    setTimeout(() => {
      const rec: Automation = {
        id, name, baseId, triggerType: fTrigger?.value.trim() || undefined,
        status: (editingId ? byId.get(editingId)?.status : 'active') || 'active',
        enabled: fEnabled ? fEnabled.checked : true,
        airtableDescription: fAirDesc?.value.trim() || undefined,
        internalDescription: fDesc?.value.trim() || undefined,
        subscribers: subs.length ? subs.slice() : undefined,
        // definition is API-only — preserve the existing value on edit, never authored in the form.
        definition: editingId ? byId.get(editingId)?.definition : undefined,
        tags: tags.slice(),
      };
      byId.set(id, rec);
      upsertRow(rec, editingId);
      setButtonLoading(saveBtn, false);
      openDrawer(false);
      apply();
    }, 550);
  });

  // ── row rendering (mirror of the Astro renderRow) ──
  const auTagIds = (a: Automation, kind: 'table' | 'field') => (a.tags || []).filter((t) => ents[t.entityId]?.kind === kind).map((t) => t.entityId);
  const auSearch = (a: Automation) => [a.name, a.triggerType, ...(a.tags || []).map((t) => ents[t.entityId]?.name)].filter(Boolean).join(' ').toLowerCase();
  const rowHtml = (a: Automation) => {
    const removed = a.status === 'removed';
    const tagCount = (a.tags || []).length;
    return `<tr class="au-row" data-au-row data-au-id="${esc(a.id)}" data-base="${esc(a.baseId)}" data-tables="${esc(auTagIds(a, 'table').join(' '))}" data-fields="${esc(auTagIds(a, 'field').join(' '))}" data-search="${esc(auSearch(a))}" data-removed-row="${removed ? '1' : '0'}" role="button" tabindex="0">
      <td class="au-c-name"><span class="au-nm"><span class="iconify lucide--zap concept-ic-automation size-4 au-row-ic" aria-hidden="true"></span><span class="au-row-name">${esc(a.name)}</span></span></td>
      <td class="au-c-status">${statusBadge(a)}</td>
      <td class="au-c-trigger">${a.triggerType ? esc(a.triggerType) : '<span class="au-dash">—</span>'}</td>
      <td class="au-c-tags">${tagCount ? `<button type="button" class="btn btn-ghost btn-sm text-sm gap-1.5 tooltip tooltip-left" data-tip="${tagCount} tagged table${tagCount === 1 ? '' : 's'} / field${tagCount === 1 ? '' : 's'}" aria-label="${tagCount} tagged tables/fields"><span class="iconify lucide--tags size-4" aria-hidden="true"></span><span class="mono-data">${tagCount}</span> tagged</button>` : '<span class="au-dash">—</span>'}</td>
      <td class="au-c-act"><span class="au-row-actions"><button type="button" class="btn btn-sm btn-ghost btn-square" data-au-edit="${esc(a.id)}" aria-label="Edit"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button>${removed ? '' : `<button type="button" class="btn btn-sm btn-ghost btn-square text-error" data-au-delete="${esc(a.id)}" aria-label="Delete"><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span></button>`}</span></td>
    </tr>`;
  };
  const upsertRow = (a: Automation, prevId: string | null) => {
    const existing = prevId ? root.querySelector<HTMLElement>(`[data-au-row][data-au-id="${CSS.escape(prevId)}"]`) : null;
    if (existing) { existing.outerHTML = rowHtml(a); return; }
    // new → append to its Base group's body (create the group if missing)
    const key = a.baseId || '__nobase__';
    const list = root.querySelector<HTMLElement>('[data-au-list]');
    let group = root.querySelector<HTMLElement>(`[data-au-group][data-group-key="${CSS.escape(key)}"]`);
    if (!group && list) {
      const label = baseLabel(a.baseId);
      const wrap = document.createElement('div');
      wrap.className = 'au-group'; wrap.dataset.auGroup = ''; wrap.dataset.groupKey = key;
      wrap.innerHTML = `<button type="button" class="au-group-head" data-au-twist aria-expanded="true"><span class="iconify lucide--chevron-down size-4 au-caret" aria-hidden="true"></span><span class="iconify lucide--database concept-ic-base size-4 au-group-ic" aria-hidden="true"></span><span class="au-group-name">${esc(label)}</span><span class="au-group-count mono-data">0</span></button><table class="au-tbl"><thead><tr><th class="au-th-name" data-sort-col="0">Name</th><th class="au-th-status" data-sort-col="1">Status</th><th class="au-th-trigger" data-sort-col="2">Trigger</th><th class="au-th-tags" data-sort-col="3">Tagged</th><th class="au-th-act"></th></tr></thead><tbody class="au-group-body" data-au-body></tbody></table>`;
      list.querySelector('[data-au-nomatch]')?.before(wrap);
      wrap.querySelector('[data-au-twist]')?.addEventListener('click', () => {
        const c = wrap.hasAttribute('data-collapsed'); c ? wrap.removeAttribute('data-collapsed') : wrap.setAttribute('data-collapsed', '');
      });
      group = wrap;
    }
    group?.querySelector('.au-group-body')?.insertAdjacentHTML('beforeend', rowHtml(a));
    // bump the group count
    if (group) { const c = group.querySelector('.au-group-count'); if (c) c.textContent = String(group.querySelectorAll('[data-au-row]:not([data-removed-row="1"])').length); }
  };

  // ── soft-delete (faked) ──
  function softDelete(id: string) {
    const rec = byId.get(id);
    if (rec) rec.status = 'removed';
    const row = root.querySelector<HTMLElement>(`[data-au-row][data-au-id="${CSS.escape(id)}"]`);
    if (row && rec) row.outerHTML = rowHtml(rec);
    // surface the include-removed toggle if it was hidden (all-active before)
    apply();
  }

  // ── click-to-sort table columns (Name · Status · Trigger · Tagged) ──
  wireTableSort(
    root,
    () => Array.from(root.querySelectorAll<HTMLElement>('.au-group')).map((g) => ({
      headers: Array.from(g.querySelectorAll<HTMLElement>('thead [data-sort-col]')),
      container: g.querySelector<HTMLElement>('.au-group-body')!,
      items: () => Array.from(g.querySelectorAll<HTMLElement>('[data-au-row]')),
    })),
    (row, col) => {
      if (col === 0) return (row.querySelector('.au-row-name')?.textContent || '').toLowerCase();
      if (col === 1) return ({ Active: 0, Inactive: 1, Removed: 2 } as Record<string, number>)[(row.querySelector('.au-c-status')?.textContent || '').trim()] ?? 3;
      if (col === 2) return (row.querySelector('.au-c-trigger')?.textContent || '').trim().toLowerCase();
      if (col === 3) { const m = (row.querySelector('.au-c-tags')?.textContent || '').match(/\d+/); return m ? Number(m[0]) : -1; }
      return '';
    },
  );

  apply();
}
