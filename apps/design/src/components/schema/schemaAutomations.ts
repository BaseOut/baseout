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
import { createPager } from '../ui/tablePager';
import { entityIconClass } from './entityIcon';

interface AuTag { entityId: string; source: 'auto' | 'manual' }
interface Automation { id: string; name: string; baseId: string; triggerType?: string; status: 'active' | 'removed'; enabled?: boolean; airtableDescription?: string; internalDescription?: string; subscribers?: string[]; definition?: string; tags?: AuTag[]; removedAt?: string }
type Ent = { name: string; kind: 'base' | 'table' | 'field' | 'view'; tableName: string | null };

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Status badge (mirror of the Astro statusBadge): badge-soft + semantic color + bg-current dot.
const statusBadge = (a: Automation) => {
  const removed = a.status === 'removed';
  const on = a.enabled !== false;
  if (removed) return `<span class="badge badge-soft badge-warning au-badge tooltip tooltip-right" data-tip="No longer exists in Airtable"><span class="size-1.5 rounded-full bg-current"></span>Removed</span>`;
  return on
    ? `<span class="badge badge-soft badge-success au-badge tooltip tooltip-right" data-tip="On in Airtable — this automation is running"><span class="size-1.5 rounded-full bg-current"></span>Active</span>`
    : `<span class="badge badge-ghost au-badge tooltip tooltip-right" data-tip="Off in Airtable — this automation isn't running"><span class="size-1.5 rounded-full bg-current"></span>Inactive</span>`;
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

  // ── filters (search · Base/Table/Field facets · include-removed) — same model as Browse/Relationships ──
  const rowsAll = () => Array.from(root.querySelectorAll<HTMLElement>('[data-au-row]'));
  const searchInput = root.querySelector<HTMLInputElement>('[data-au-search]');
  const clearBtn = root.querySelector<HTMLElement>('[data-au-clear]');
  const facetHidden: Record<string, Set<string>> = { aubase: new Set(), autable: new Set(), aufield: new Set() };
  // Removed-status tri-state (was an "Include removed" checkbox): active(default) | removed | all.
  let status: 'active' | 'removed' | 'all' = 'active';
  let query = '';
  // A row passes a tag-facet when it has at least one value that isn't hidden (empty tag list → fails
  // only when the facet is active, i.e. the automation touches none of the shown tables/fields).
  const someShown = (ids: string, hidden: Set<string>) => ids.split(' ').filter(Boolean).some((v) => !hidden.has(v));
  const rowVisible = (row: HTMLElement) => {
    if (row.dataset.dismissed === '1') return false;
    const isRemoved = row.dataset.removedRow === '1';
    if (status === 'active' && isRemoved) return false;
    if (status === 'removed' && !isRemoved) return false;
    if (query && !(row.dataset.search || '').includes(query)) return false;
    if (facetHidden.aubase.has(row.dataset.base || '')) return false;
    if (facetHidden.autable.size && !someShown(row.dataset.tables || '', facetHidden.autable)) return false;
    if (facetHidden.aufield.size && !someShown(row.dataset.fields || '', facetHidden.aufield)) return false;
    return true;
  };
  const anyFilter = () => !!query || status !== 'active' || Object.values(facetHidden).some((s) => s.size > 0);
  // Pager (pattern-table-toolbar). The base groups are headers over independent rows, not a
  // hierarchy — an automation doesn't belong to the row above it — so the window is taken across
  // the whole filtered sequence and a group whose rows all fall off the page simply hides itself
  // (the existing empty-group rule below does that unchanged). 25/page: rows are chunky.
  const pager = createPager({
    root, name: 'au', sizes: [10, 25, 50], defaultSize: 25,
    storageKey: 'sch-au-pagesize', onChange: () => apply(),
  });
  const apply = () => {
    const matched: HTMLElement[] = [];
    rowsAll().forEach((row) => { row.hidden = true; if (rowVisible(row)) matched.push(row); });
    const shown = matched.length;
    pager.window(matched).forEach((row) => { row.hidden = false; });
    root.querySelectorAll<HTMLElement>('[data-au-group]').forEach((g) => {
      g.hidden = !Array.from(g.querySelectorAll<HTMLElement>('[data-au-row]')).some((r) => !r.hidden);
    });
    const nomatch = root.querySelector<HTMLElement>('[data-au-nomatch]');
    if (nomatch) nomatch.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !anyFilter();
  };
  document.addEventListener('facetchange', (ev) => {
    const d = (ev as CustomEvent).detail || {};
    if (d.name in facetHidden) { facetHidden[d.name] = new Set<string>(d.hidden || []); pager.reset(); apply(); return; }
    if (d.name === 'austatus') { status = (d.value || 'active') as typeof status; pager.reset(); apply(); return; }
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
  const title = panel?.querySelector<HTMLElement>('.sb-drawer-title');
  const titleIc = panel?.querySelector<HTMLElement>('[data-sb-drawer-titleic]');
  const crumbsEl = panel?.querySelector<HTMLElement>('[data-sb-drawer-crumbs]');
  const saveBtn = $m<HTMLButtonElement>('[data-au-save]');
  let editingId: string | null = null;
  let tags: AuTag[] = [];
  let subs: string[] = [];

  // Editing an EXISTING automation does NOT happen here. A row opens the stacking EntityPanel and
  // that panel edits itself in place — one layout, a read mode and an edit mode
  // (pattern-panel-edit-mode). It reports the committed record back through this event, and the
  // only thing left for the tab to do is re-render its listing row.
  document.addEventListener('schema:automationSaved', (ev) => {
    const rec = (ev as CustomEvent).detail?.rec as Automation | undefined;
    if (!rec?.id) return;
    byId.set(rec.id, { ...(byId.get(rec.id) as Automation), ...rec });
    upsertRow(byId.get(rec.id)!, rec.id);
    apply();
  });

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
    const icon = `<span class="iconify ${entityIconClass(e?.kind || 'table')} size-3.5" aria-hidden="true"></span>`;
    return entityChip({ name, icon, context, attrs: 'data-au-chip="' + esc(t.entityId) + '"', remove: t.source === 'manual' ? 'data-au-chip-x="' + esc(t.entityId) + '"' : undefined, derived: t.source === 'auto' });
  };
  const renderChips = () => { if (chipsWrap) chipsWrap.innerHTML = tags.map(chipHtml).join(''); };

  /** REGISTER only (`id` is always null now — editing lives in the panel). */
  const openEdit = (id: string | null) => {
    editingId = id;
    const a = id ? byId.get(id) : null;
    if (titleIc) { titleIc.innerHTML = ''; titleIc.hidden = true; }
    if (crumbsEl) { crumbsEl.innerHTML = ''; crumbsEl.hidden = true; }
    if (title) title.textContent = 'Register automation';
    if (saveBtn) saveBtn.textContent = 'Register automation';
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
    openDrawer(true);
    setTimeout(() => fName?.focus(), 0);
  };
  root.querySelectorAll<HTMLElement>('[data-au-new]').forEach((b) => b.addEventListener('click', () => openEdit(null)));
  $m<HTMLElement>('[data-au-cancel]')?.addEventListener('click', () => openDrawer(false));

  // Q4 — a row opens the automation as a stacking EntityPanel (like Browse/Relationships), not a
  // one-off drawer. The panel footer routes Edit/Delete back here via the events below.
  const openInPanel = (id: string) => { if (byId.has(id)) document.dispatchEvent(new CustomEvent('schema:openEntity', { detail: { id } })); };
  document.addEventListener('schema:openAutomation', (ev) => { const id = (ev as CustomEvent).detail?.id as string | undefined; if (id) openInPanel(id); });
  document.addEventListener('schema:deleteAutomation', (ev) => { const id = (ev as CustomEvent).detail?.id as string | undefined; if (id && byId.has(id)) softDelete(id); });

  // edit / delete (row hover actions) + row click → open the panel
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    // The row's pencil is a SHORTCUT to the panel's edit mode — not a second edit surface.
    const edit = t.closest<HTMLElement>('[data-au-edit]');
    if (edit) {
      ev.stopPropagation();
      const id = edit.dataset.auEdit!;
      openInPanel(id);
      document.dispatchEvent(new CustomEvent('schema:panelEditMode', { detail: { id } }));
      return;
    }
    const del = t.closest<HTMLElement>('[data-au-delete]');
    if (del) { ev.stopPropagation(); softDelete(del.dataset.auDelete!); return; }
    const row = t.closest<HTMLElement>('[data-au-row]');
    if (row) openInPanel(row.dataset.auId!);
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-au-row]');
    if (!row) return;
    ev.preventDefault();
    openInPanel(row.dataset.auId!);
  });

  // ── tag-picker: add (EntitySearch) / remove ──
  document.addEventListener('schema:auTagAdd', (ev) => {
    if (!toggle?.checked) return; // the Register drawer owns this picker (the panel has its own)
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
  const form = $m<HTMLFormElement>('[data-au-reg]');
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
    return `<tr class="au-row row-clickable" data-au-row data-au-id="${esc(a.id)}" data-base="${esc(a.baseId)}" data-tables="${esc(auTagIds(a, 'table').join(' '))}" data-fields="${esc(auTagIds(a, 'field').join(' '))}" data-search="${esc(auSearch(a))}" data-removed-row="${removed ? '1' : '0'}" role="button" tabindex="0">
      <td class="au-c-name"><span class="au-nm"><span class="iconify lucide--zap concept-ic-automation size-4 au-row-ic" aria-hidden="true"></span><span class="au-row-name">${esc(a.name)}</span></span></td>
      <td class="au-c-status">${statusBadge(a)}</td>
      <td class="au-c-trigger">${a.triggerType ? esc(a.triggerType) : '<span class="au-dash">—</span>'}</td>
      <td class="au-c-tags">${tagCount ? `<button type="button" class="btn btn-ghost btn-sm text-sm gap-1.5 tooltip tooltip-left" data-tip="${tagCount} tagged table${tagCount === 1 ? '' : 's'} / field${tagCount === 1 ? '' : 's'}" aria-label="${tagCount} tagged tables/fields"><span class="iconify lucide--tags size-4" aria-hidden="true"></span><span class="mono-data">${tagCount}</span> tagged</button>` : '<span class="au-dash">—</span>'}</td>
      <td class="au-c-act"><span class="row-end"><span class="row-actions"><button type="button" class="btn btn-sm btn-ghost btn-square tooltip tooltip-left" data-tip="Edit" data-au-edit="${esc(a.id)}" aria-label="Edit"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span></button>${removed ? '' : `<button type="button" class="btn btn-sm btn-ghost btn-square text-error tooltip tooltip-left" data-tip="Delete" data-au-delete="${esc(a.id)}" aria-label="Delete"><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span></button>`}</span><span class="row-go" aria-hidden="true"><span class="iconify lucide--chevron-right size-4"></span></span></span></td>
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
    if (!root) return;
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
    () => { pager.reset(); apply(); },
  );

  apply();
}
