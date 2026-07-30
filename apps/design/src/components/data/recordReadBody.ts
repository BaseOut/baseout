/**
 * recordReadBody — the shared record-detail BODY (Location crumb · Fields · Linked records ·
 * History · Referenced-in), extracted from RecordPanel.astro (2026-07-23) so it can render
 * identically inside two different stacking-panel hosts: the standalone RecordPanel (`.rp-*`,
 * Browse + Docs) and a Data-Changelog run drill panel (`.dcp-*`, `pattern-data-changelog`'s
 * run→record visit-stack). Same relationship `schemaReadBody.ts` has to the Schema EntityPanel.
 *
 * Host-agnostic: takes the record + a small view-state object and returns HTML; it does NOT
 * reference either host's own `createPanelStack` instance. `RecordBodyCtx.fieldClickable` /
 * `showRefs` let a host drop the cross-stack-only affordances (field-config open-beside,
 * Referenced-in→Docs) it doesn't support — the DCP drill host sets both false (Dan 2026-07-23:
 * drill-hosted records keep the body-local reads — linked drill-in-place, provenance expand,
 * view-as-of — but drop field-config open-beside, value-tables, and Referenced-in→Docs).
 *
 * NOT here (stay host-side, see RecordPanel.astro): field-config view + its "Values" table
 * (RP-only, needs RP's own stack for open-beside), the `[data-entity-open]` click interception,
 * and the `[data-rp-refdoc]` → `schema:openDoc` handler (RP-only; a DCP-hosted body simply
 * doesn't render the section it would live in).
 */

export interface Cell { raw: string; linkedCount?: number; empty?: boolean }
export interface Field {
  id: string; name: string; type: string; linkedTableId?: string; expression?: string;
  refs?: string[]; viaFieldId?: string; sourceTableId?: string; sourceFieldId?: string; aggregation?: string;
}
export interface Table { id: string; baseId: string; name: string; fields: Field[] }
export interface Hist { runId: string; at: string; type: 'created' | 'updated' | 'deleted'; fields?: { fieldId: string; before: string; after: string }[] }
export interface Rec { id: string; tableId: string; primary: string; cells: Record<string, Cell>; linked?: Record<string, string[]>; history?: Hist[] }
export interface DocRef { id: string; title: string; kind: 'doc' | 'chat' }
/**
 * A comment as the PANEL needs it — already resolved by the host (mentions replaced, author named,
 * status decided), because the panel body is built as an HTML string and must not re-derive rules
 * the feed already applies. Two surfaces deriving "is this deleted" separately is how they drift.
 */
export interface PanelComment {
  id: string;
  author: string;
  initials: string;
  text: string;
  at: string;
  edited: boolean;
  status: 'present' | 'deleted' | 'unverified';
  lastSeenAt: string;
  parentId?: string;
  attachmentCount: number;
}

/** Everything a host must resolve so the body can render without touching its own stack. */
export interface RecordBodyCtx {
  baseName: Record<string, string>;
  tableById: Map<string, Table>;
  recById: Map<string, Rec>;
  /** field type → ready `<svg>`/`<span class="iconify">` markup (RecordPanel's `iconsByType`). */
  icons: Record<string, string>;
  staticMode: boolean;
  docRefs: Record<string, DocRef[]>;
  /** RP = true (a field row opens field-config); DCP drill = false (inert field rows). */
  fieldClickable: boolean;
  /** RP = true; DCP drill = false — the "Referenced in" section isn't rendered at all. */
  showRefs: boolean;
  /** record id → its comments, newest thread first. Absent on hosts that carry no comments. */
  comments?: Record<string, PanelComment[]>;
}

/** Per-panel view state for ONE record (asOf pin, field search, active linked-records tab). A
 *  host owns the object and re-renders on mutation; functions below read/write it in place. */
export interface RecordViewState { asOf: string | null; fieldQuery: string; linkTab: string }

/* How many linked records a field shows before "Show N more" (pattern-node-showmore). 25, not 50:
   this list is NESTED INSIDE a drawer, so one field filling the whole panel buries every field after
   it — the same reason a tree caps its children per node rather than paging (Oleh 2026-07-24). */
export const PAGE = 25;

export const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', { month: 'short', day: 'numeric' }); };
export const family = (t: string) => {
  if (['number', 'currency', 'percent', 'rating', 'duration', 'rollup', 'count', 'autoNumber'].includes(t)) return 'number';
  if (['multipleRecordLinks'].includes(t)) return 'link';
  if (['multipleLookupValues'].includes(t)) return 'lookup';
  if (t === 'formula') return 'formula';
  if (['singleSelect', 'multipleSelects'].includes(t)) return 'select';
  return 'text';
};

export const ic = (ctx: RecordBodyCtx, type: string) => ctx.icons[type] ? `<span class="rp-fic">${ctx.icons[type]}</span>` : '<span class="rp-fic"></span>';
// The hover "open beside" affordance appended to a real linked/source row.
const besideBtn = (id: string) => `<button type="button" class="btn btn-sm btn-ghost btn-square rp-openbeside tooltip tooltip-left" data-rp-openbeside="${id}" data-tip="Open beside · ⌘/Ctrl-click" aria-label="Open beside"><span class="iconify lucide--columns-2 size-4" aria-hidden="true"></span></button>`;
// Same ⧉ open-beside control, on a FIELD row (data-rp-fieldbeside, not data-rp-openbeside — it spawns
// openFieldBeside, not openBeside). Identical icon/tooltip/classes to besideBtn/.ep-beside/.dcp-openbeside —
// one visual answer to "this can open beside" across the whole app (Oleh 2026-07-30).
const fieldBesideBtn = (id: string) => `<button type="button" class="btn btn-sm btn-ghost btn-square rp-fieldbeside tooltip tooltip-left" data-rp-fieldbeside="${id}" data-tip="Open beside · ⌘/Ctrl-click" aria-label="Open beside"><span class="iconify lucide--columns-2 size-4" aria-hidden="true"></span></button>`;

// ── Cell value (type-aware) — pure, no ctx needed ───────────────────────────
export const cellValue = (rec: Rec, f: Field, override?: Record<string, string>): string => {
  const raw = override ? override[f.id] ?? '' : rec.cells[f.id]?.raw ?? '';
  const c = rec.cells[f.id];
  if (!raw || c?.empty) return '<span class="rp-empty">—</span>';
  const fam = family(f.type);
  if (fam === 'number') return `<span class="rp-num">${esc(raw)}</span>`;
  if (f.type === 'singleSelect' || f.type === 'multipleSelects') return `<span class="rp-selval">${esc(raw)}</span>`;
  return esc(raw);
};

// Reconstruct a record's values as of a backup run: revert every run newer than asOf.
export const valuesAsOf = (rec: Rec, runId: string): Record<string, string> => {
  const vals: Record<string, string> = {};
  Object.entries(rec.cells).forEach(([k, c]) => (vals[k] = c.raw));
  for (const h of rec.history || []) {
    if (h.runId === runId) break;
    if (h.type === 'updated') (h.fields || []).forEach((f) => (vals[f.fieldId] = f.before));
  }
  return vals;
};

// ── Provenance panels (one visual family) ──────────────────────────────────
export const provFormula = (ctx: RecordBodyCtx, rec: Rec, f: Field): string => {
  const rows = (f.refs || []).map((rid) => {
    const rf = ctx.tableById.get(rec.tableId)!.fields.find((x) => x.id === rid);
    if (!rf) return '';
    return `<div class="rp-provrow">${ic(ctx, rf.type)}<span class="rp-provname">${esc(rf.name)}</span><span class="rp-provval">${cellValue(rec, rf)}</span></div>`;
  }).join('');
  return `<div class="rp-prov"><div class="rp-provhead"><span class="iconify lucide--variable size-3.5" aria-hidden="true"></span><span class="rp-provexpr">${esc(f.expression || '')}</span></div>${rows}</div>`;
};
export const linkedList = (rec: Rec, f: Field, total: number): string => {
  return `<div class="rp-prov rp-linked" data-rp-linked data-total="${total}" data-loaded="${Math.min(PAGE, total)}" data-field="${f.id}" data-rec="${rec.id}">
    <div class="rp-provhead"><span class="iconify lucide--link size-3.5" aria-hidden="true"></span><span class="rp-provname">${esc(f.name)}</span><span class="rp-provcount">${total.toLocaleString()} linked</span></div>
    <label class="input input-sm rp-linksearch"><span class="iconify lucide--search size-3.5 opacity-50" aria-hidden="true"></span><input type="search" data-rp-linksearch placeholder="Search linked records" aria-label="Search linked records" /></label>
    <div class="rp-linkrows" data-rp-linkrows></div>
    <div class="rp-linknote" data-rp-linknote hidden></div>
    <div class="rp-loadmore" data-rp-linkmore hidden></div>
  </div>`;
};
export const provLookup = (ctx: RecordBodyCtx, rec: Rec, f: Field): string => {
  const via = ctx.tableById.get(rec.tableId)!.fields.find((x) => x.id === f.viaFieldId);
  const srcTable = f.sourceTableId ? ctx.tableById.get(f.sourceTableId) : null;
  const srcField = srcTable?.fields.find((x) => x.id === f.sourceFieldId);
  const sourceIds = (rec.linked?.[f.viaFieldId || ''] || []);
  const rows = sourceIds.slice(0, 5).map((sid) => {
    const sr = ctx.recById.get(sid);
    const val = sr && srcField ? (sr.cells[srcField.id]?.raw || '') : '';
    return `<div class="rp-provrow rp-provlink" data-rp-open="${sr ? sid : ''}"><span class="rp-provname">${esc(sr?.primary || sid)}</span><span class="rp-provval">${esc(val)}</span>${sr ? besideBtn(sid) : ''}</div>`;
  }).join('') || `<div class="rp-provrow"><span class="rp-empty">No source records</span></div>`;
  const agg = f.aggregation ? `<span class="rp-provagg">${esc(f.aggregation)} across ${sourceIds.length || '—'} record${sourceIds.length === 1 ? '' : 's'}</span>` : '';
  return `<div class="rp-prov"><div class="rp-provhead rp-provvia">via <strong>${esc(via?.name || '?')}</strong> from <strong>${esc(srcTable?.name || '?')}</strong>${agg}</div>${rows}</div>`;
};

// ── Fields section ────────────────────────────────────────────────────────
export const secHead = (icon: string, label: string, count?: number) => `<div class="rp-seclabel"><span class="iconify ${icon} size-3.5 rp-sec-ic" aria-hidden="true"></span><span>${label}</span>${count != null ? `<span class="rp-sec-count">${count.toLocaleString()}</span>` : ''}</div>`;
export const renderFields = (ctx: RecordBodyCtx, view: RecordViewState, rec: Rec): string => {
  const t = ctx.tableById.get(rec.tableId)!;
  const override = view.asOf ? valuesAsOf(rec, view.asOf) : undefined;
  const banner = view.asOf ? `<div class="rp-asof"><span class="iconify lucide--history size-3.5" aria-hidden="true"></span>Viewing values as of ${esc(fmtDate((rec.history || []).find((h) => h.runId === view.asOf)?.at || ''))} · <button type="button" class="rp-asof-x" data-rp-asof-clear>back to latest</button></div>` : '';
  const rows = t.fields.map((f) => {
    const fam = family(f.type);
    const provable = (fam === 'formula' && (f.refs?.length)) || fam === 'lookup' || (f.type === 'rollup' && !!f.viaFieldId);
    const expandBtn = provable ? `<button type="button" class="rp-expand" data-rp-expand aria-label="Show where this value comes from"><span class="iconify lucide--chevron-right size-4" aria-hidden="true"></span></button>` : '';
    const hide = view.fieldQuery && !f.name.toLowerCase().includes(view.fieldQuery) ? 'style="display:none"' : '';
    // The field name is otherwise silent about ⌘/Ctrl-click opening it beside — a hidden affordance
    // is not an affordance (Oleh 2026-07-30), so it carries the same tooltip register as every other
    // open-beside control in the app.
    const fnameHtml = ctx.fieldClickable
      ? `<button type="button" class="rp-fname rp-fname-btn tooltip tooltip-top" data-entity-open="${esc(f.id)}" aria-label="${esc(f.name)} — open field settings" data-tip="Open field settings · ⌘/Ctrl-click to open beside">${esc(f.name)}</button>`
      : `<span class="rp-fname">${esc(f.name)}</span>`;
    // ⧉ open-beside: same canon control as linked-record rows / Schema EntityPanel / the Changelog
    // drill, reveal-on-hover. Only where a field row can be opened at all (fieldClickable) — an inert
    // drill-hosted row must not advertise a capability it doesn't have. A normal flex sibling (not
    // absolutely positioned): `.rp-fval` already truncates and yields its own width, so this never
    // overlaps the provenance-expand chevron — both stay reachable while the row is hovered.
    const besideHtml = ctx.fieldClickable ? fieldBesideBtn(f.id) : '';
    return `<div class="rp-field" data-rp-field="${f.id}" data-fname="${esc(f.name.toLowerCase())}" ${hide}>
      <div class="rp-fieldrow">${ic(ctx, f.type)}${fnameHtml}<span class="rp-fval">${cellValue(rec, f, override)}</span>${besideHtml}${expandBtn}</div>
      <div class="rp-provwrap" data-rp-provwrap hidden></div>
    </div>`;
  }).join('');
  const search = `<label class="input input-sm rp-fieldsearch"><span class="iconify lucide--search size-3.5 opacity-50" aria-hidden="true"></span><input type="search" data-rp-fieldsearch value="${esc(view.fieldQuery)}" placeholder="Search fields" aria-label="Search fields" /></label>`;
  return `${banner}<div class="rp-sec" id="rp-sec-fields">${secHead('lucide--list', 'Fields', t.fields.length)}${search}<div class="rp-list" data-rp-fieldlist>${rows}</div></div>`;
};

// ── Linked records section (mutates view.linkTab to a real tab if unset/stale) ─────────────
export const renderLinked = (ctx: RecordBodyCtx, view: RecordViewState, rec: Rec): string => {
  const t = ctx.tableById.get(rec.tableId)!;
  const linkFields = t.fields.filter((f) => f.type === 'multipleRecordLinks');
  if (!linkFields.length) return '';
  if (!view.linkTab || !linkFields.some((f) => f.id === view.linkTab)) view.linkTab = linkFields[0].id;
  const tabs = linkFields.map((f) => {
    const n = rec.cells[f.id]?.linkedCount || 0;
    return `<button type="button" class="rp-linktab ${f.id === view.linkTab ? 'rp-linktab-on' : ''}" data-rp-linktab="${f.id}">${esc(f.name)} <span class="rp-linktab-n">${n.toLocaleString()}</span></button>`;
  }).join('');
  const active = linkFields.find((f) => f.id === view.linkTab)!;
  const total = rec.cells[active.id]?.linkedCount || 0;
  const list = linkedList(rec, active, total);
  return `<div class="rp-sec" id="rp-sec-linked">${secHead('lucide--link', 'Linked records', linkFields.length)}<div class="rp-linktabs" role="tablist">${tabs}</div><div class="rp-linkbody" data-rp-linkbody>${list}</div></div>`;
};

// ── History section ─────────────────────────────────────────────────────────
export const renderHistory = (ctx: RecordBodyCtx, rec: Rec): string => {
  if (ctx.staticMode) {
    return `<div class="rp-locked"><span class="rp-locked-ic"><span class="iconify lucide--lock size-5" aria-hidden="true"></span></span><p class="rp-locked-title">History needs a dynamic backup</p><p class="rp-locked-what">Per-record history compares every backup in a live database. This is an imported static copy, so there's nothing to diff — switch to a dynamic backup to trace how a record changed.</p></div>`;
  }
  const hist: Hist[] = rec.history && rec.history.length ? rec.history : [{ runId: 'run_current', at: '', type: 'created' }];
  const t = ctx.tableById.get(rec.tableId)!;
  const fname = (fid: string) => t.fields.find((x) => x.id === fid)?.name || fid;
  const badge = (ty: string) => ty === 'created' ? '<span class="badge badge-soft badge-success badge-sm">Created</span>' : ty === 'deleted' ? '<span class="badge badge-soft badge-error badge-sm">Deleted</span>' : '<span class="badge badge-soft badge-warning badge-sm">Updated</span>';
  const rows = hist.map((h) => {
    const diffs = h.type === 'updated' ? (h.fields || []).map((d) =>
      `<div class="rp-diff"><span class="rp-difflbl">${esc(fname(d.fieldId))}</span><span class="rp-diffold">${esc(d.before)}</span><span class="iconify lucide--arrow-right size-3 opacity-50" aria-hidden="true"></span><span class="rp-diffnew">${esc(d.after)}</span></div>`
    ).join('') : h.type === 'deleted' ? '<div class="rp-tomb">Record removed from this backup.</div>' : '<div class="rp-tomb rp-tomb-add">First captured — all fields added.</div>';
    const asOfBtn = h.at ? `<button type="button" class="rp-viewas" data-rp-viewas="${h.runId}">view as of this backup</button>` : '';
    return `<div class="rp-histentry"><div class="rp-histtop">${badge(h.type)}<span class="rp-histrun">${h.at ? esc(fmtDate(h.at)) + ' · ' : ''}${esc(h.runId)}</span>${asOfBtn}</div><div class="rp-histbody">${diffs}</div></div>`;
  }).join('');
  const runN = hist.filter((h) => h.at).length || 1;
  return `<div class="rp-sec" id="rp-sec-history"><div class="rp-histhead">${secHead('lucide--history', 'History')}<span class="rp-histrange">since first backup · ${runN} run${runN === 1 ? '' : 's'}</span></div><div class="rp-list">${rows}</div></div>`;
};

// ── "Referenced in" section (B5) — docs/chats that tag this record; reverse of Docs' @@ ──
export const renderRefs = (ctx: RecordBodyCtx, rec: Rec): string => {
  const refs = ctx.docRefs[rec.id] || [];
  if (!refs.length) return '';
  const rows = refs.map((r) => `<div class="rp-provrow rp-provlink rp-refrow" data-rp-refdoc="${esc(r.id)}">
    <span class="iconify ${r.kind === 'doc' ? 'lucide--file-text' : 'lucide--messages-square'} size-3.5 rp-ref-ic" aria-hidden="true"></span>
    <span class="rp-provname">${esc(r.title)}</span>
    <span class="rp-refkind">${r.kind === 'doc' ? 'Doc' : 'Chat'}</span>
    <span class="iconify lucide--chevron-right size-3.5 opacity-40" aria-hidden="true"></span>
  </div>`).join('');
  return `<div class="rp-sec" id="rp-sec-refs">${secHead('lucide--file-text', 'Referenced in', refs.length)}<div class="rp-list">${rows}</div></div>`;
};

// ── Comments (comments-explorer) ────────────────────────────────────────────
// "Comments are always tied to a Record, so the Record sidepage should have a comments section,
// and from the Comments listing table we could deep link to that section/comment within the
// record" (founder, 2026-07-30). So the THREAD lives here and not in the stream: a reply is
// structure (`parentCommentId`), and the one place where a whole conversation belongs is the
// record it is about. The stream stays one line per comment and links in.
const cmBadge = (c: PanelComment): string => {
  if (c.status === 'deleted') {
    return `<span class="badge badge-sm badge-soft badge-error gap-1 rp-cm-badge">
      <span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span>Deleted</span>`;
  }
  if (c.status === 'unverified') {
    return `<span class="badge badge-sm badge-soft badge-warning gap-1 rp-cm-badge">
      <span class="iconify lucide--eye-off size-3.5" aria-hidden="true"></span>Last seen ${esc(fmtDate(c.lastSeenAt))}</span>`;
  }
  return '';
};

const cmRow = (c: PanelComment, reply: boolean): string => `
  <div class="rp-cm${reply ? ' rp-cm-reply' : ''}" id="rp-cm-${esc(c.id)}" data-rp-comment="${esc(c.id)}">
    ${c.initials ? `<span class="rp-cm-ini" aria-hidden="true">${esc(c.initials)}</span>` : '<span class="rp-cm-noini" aria-hidden="true"></span>'}
    <div class="rp-cm-main">
      <div class="rp-cm-head">
        <span class="rp-cm-author">${esc(c.author)}</span>
        <span class="rp-cm-at">${esc(fmtDate(c.at))}</span>
        ${c.edited ? '<span class="rp-cm-edited">edited</span>' : ''}
        ${cmBadge(c)}
      </div>
      <p class="rp-cm-text">${esc(c.text)}</p>
      ${c.attachmentCount ? `<div class="rp-cm-att"><span class="iconify lucide--paperclip size-3.5" aria-hidden="true"></span>${c.attachmentCount} attachment${c.attachmentCount === 1 ? '' : 's'}</div>` : ''}
    </div>
  </div>`;

export const renderComments = (ctx: RecordBodyCtx, rec: Rec): string => {
  const all = ctx.comments?.[rec.id] || [];
  if (!all.length) return '';
  // Replies hang off their parent. A reply whose parent is not in this capture is promoted to the
  // top level rather than dropped — losing a comment because we lost its parent would be a silent
  // deletion of data we actually hold.
  const byParent = new Map<string, PanelComment[]>();
  const ids = new Set(all.map((c) => c.id));
  const roots: PanelComment[] = [];
  for (const c of all) {
    if (c.parentId && ids.has(c.parentId)) {
      const list = byParent.get(c.parentId) || [];
      list.push(c);
      byParent.set(c.parentId, list);
    } else roots.push(c);
  }
  const rows = roots
    .map((r) => cmRow(r, false) + (byParent.get(r.id) || []).map((x) => cmRow(x, true)).join(''))
    .join('');
  return `<div class="rp-sec" id="rp-sec-comments">${secHead('lucide--message-square-text', 'Comments', all.length)}<div class="rp-cmlist">${rows}</div></div>`;
};

// ── Location crumb (Base ▸ Table ancestors) ─────────────────────────────────
export const sep = '<span class="sb-crumb-sep iconify lucide--chevron-right size-3" aria-hidden="true"></span>';
export const crumb = (icon: string, name: string, cur = false) => `<span class="sb-crumb${cur ? ' sb-crumb-cur' : ''}">${cur ? '' : `<span class="sb-crumb-ic"><span class="iconify ${icon} size-3.5" aria-hidden="true"></span></span>`}<span class="sb-crumb-name">${esc(name)}</span></span>`;
/** Ancestors only (base ▸ table) — the record name lives in the host's own title, not a tail crumb. */
export const ancestorCrumbs = (ctx: RecordBodyCtx, rec: Rec): string => {
  const t = ctx.tableById.get(rec.tableId)!;
  return crumb('lucide--database', ctx.baseName[t.baseId]) + sep + crumb('lucide--table-2', t.name);
};

/** The full body: Fields + Linked records + Comments + History + (Referenced-in, when showRefs).
 *  Comments sit ABOVE History deliberately — they are content about the record, like its fields,
 *  while History is the audit trail underneath everything. */
export const renderRecordBody = (ctx: RecordBodyCtx, view: RecordViewState, rec: Rec): string =>
  renderFields(ctx, view, rec) + renderLinked(ctx, view, rec) + renderComments(ctx, rec) + renderHistory(ctx, rec) + (ctx.showRefs ? renderRefs(ctx, rec) : '');

// ── Linked list incremental render (shared; reads container data attrs) ───────
export function paintLinked(ctx: RecordBodyCtx, container: HTMLElement) {
  const total = Number(container.dataset.total);
  const loaded = Number(container.dataset.loaded);
  const fid = container.dataset.field!;
  const rec = ctx.recById.get(container.dataset.rec!)!;
  const f = ctx.tableById.get(rec.tableId)!.fields.find((x) => x.id === fid)!;
  const sampleIds = rec.linked?.[fid] || [];
  const linkedTable = f.linkedTableId ? ctx.tableById.get(f.linkedTableId) : null;
  const prefix = linkedTable?.name.startsWith('Order') ? 'ORD-' : ((linkedTable?.name.slice(0, 3).toUpperCase() || 'REC') + '-');
  const search = (container.querySelector<HTMLInputElement>('[data-rp-linksearch]')?.value || '').toLowerCase();
  const rowsEl = container.querySelector<HTMLElement>('[data-rp-linkrows]')!;
  const items: { id: string; text: string; real: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const it = i < sampleIds.length ? (() => { const r = ctx.recById.get(sampleIds[i]); return { id: sampleIds[i], text: r?.primary || sampleIds[i], real: !!r }; })() : { id: '', text: `${prefix}${1001 + i}`, real: false };
    if (!search || it.text.toLowerCase().includes(search)) items.push(it);
    if (items.length >= loaded) break;
  }
  rowsEl.innerHTML = items.map((it) => it.real
    ? `<div class="rp-provrow rp-provlink" data-rp-open="${it.id}"><span class="rp-provname">${esc(it.text)}</span>${besideBtn(it.id)}<span class="iconify lucide--chevron-right size-3.5 opacity-40" aria-hidden="true"></span></div>`
    : `<div class="rp-provrow rp-provrow-ph"><span class="rp-provname">${esc(it.text)}</span></div>`).join('');
  // Honest note: past the shipped sample the rows are placeholders for scale, not openable. Only shows
  // when synthesis actually happens (total > sample) — with full data in production it never renders.
  const noteEl = container.querySelector<HTMLElement>('[data-rp-linknote]');
  if (noteEl) {
    const synth = total > sampleIds.length;
    noteEl.hidden = !synth;
    if (synth) noteEl.textContent = sampleIds.length
      ? `Beyond the first ${sampleIds.length.toLocaleString()}, linked records are shown for scale and can't be opened in this preview.`
      : `These linked records aren't in the preview sample — shown for scale, they can't be opened.`;
  }
  const more = container.querySelector<HTMLElement>('[data-rp-linkmore]')!;
  more.hidden = !(loaded < total && !search);
  // Say what the click does and what is left, not just "Load more" — the same wording the tree's
  // per-node control uses, so one reveal-in-chunks idiom reads the same everywhere.
  if (!more.hidden) more.textContent = `Show ${Math.min(PAGE, total - loaded).toLocaleString()} more of ${total.toLocaleString()}`;
}
