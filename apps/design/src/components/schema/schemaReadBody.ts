/**
 * Shared body builders for Automations and Interfaces, rendered inside the stacking EntityPanel
 * (pattern-entity-panel). The body is the panel's inner HTML (identity meta → sections → footer);
 * the header icon + crumbs (and, in edit mode, the editable NAME) are the panel's own, so they're
 * NOT here.
 *
 * ONE PANEL, TWO MODES (pattern-panel-edit-mode, Oleh 2026-07-28). There is no separate edit form
 * any more, and no per-field inline editing either. `ctx.mode` flips every Baseout-owned value
 * between a read slot and an input IN PLACE — same sections, same order, same vertical positions,
 * same row heights (`.sch-slot` / `.sch-slot-in` are declared together in global.css precisely so
 * that holds). Captured blocks (trigger · touches · actions) render IDENTICALLY in both modes and
 * are never disabled and never greyed: a greyed control reads as broken or as "do something else
 * first", and these are facts, not fields. Edit mode only adds a quiet "from capture" marker to
 * those section labels, so the absence of an input is explained rather than felt.
 *
 * Emits PANEL attributes: a tagged table/field chip is `data-ep-push` (drills within the panel,
 * ⌘-click opens beside); edit-mode inputs carry `data-ep-f="<field>"` and are harvested by the
 * panel controller; `data-ep-tagx` removes a manual tag; the footer carries `data-ep-read-delete`
 * in read mode and `data-ep-save` / `data-ep-cancel` in edit mode.
 */
import { entityChip } from './entityChip';
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';
import { readAnatomy, type AnatomyFields } from './automationAnatomy';
import { TRIGGER_TYPES } from './schemaTriggerTypes';
import { entityIconClass } from './entityIcon';

export type PanelMode = 'read' | 'edit';

/** `fieldType` carries the Airtable type so a field chip can show that type's glyph.
 *  It was previously dropped on the way in, which silently made every chip generic. */
export interface ReadEnt { name: string; kind: string; tableName?: string | null; fieldType?: string }
export interface ReadBodyCtx {
  /** Resolve a tagged entity id → its display info (name/kind/table), or null if unknown. */
  ent: (id: string) => ReadEnt | null;
  /** Read or Edit. The panel owns this state; the body renders the SAME layout either way. */
  mode: PanelMode;
  /** Base id → base name (for the interface/automation location, when needed). */
  baseLabel: (id?: string) => string;
  /** The item's own change history as ready HTML (may be ''). */
  changelogHtml: (id: string) => string;
}

interface AutomationLike extends AnatomyFields {
  id: string; name: string; baseId?: string; triggerType?: string;
  status?: 'active' | 'removed'; enabled?: boolean;
  airtableDescription?: string; internalDescription?: string;
  subscribers?: string[]; definition?: string; tags?: { entityId: string; source?: string }[];
}
interface InterfaceLike extends AnatomyFields {
  id: string; name: string; type?: 'interface' | 'page'; pageType?: string; baseId?: string; parentId?: string;
  status?: 'active' | 'removed'; published?: boolean;
  internalDescription?: string; definition?: string; tags?: { entityId: string; source?: string }[];
  /** Sibling pages (interface only) — resolved by the caller. */
  pages?: { id: string; name: string }[];
}

const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const countBadge = (n: number) => (n >= 2 ? ` <span class="badge badge-sm badge-neutral">${n}</span>` : '');

/**
 * A section label. `captured` marks a block that was read off the backup — in EDIT mode it gains
 * the "from capture" pill, which is the whole explanation for why that block has no inputs. In
 * read mode the marker is absent: there is nothing to explain when nothing is editable anywhere.
 */
function sectLbl(prefix: 'au' | 'if', ctx: ReadBodyCtx, icon: string, text: string, count = 0, captured = false): string {
  const mark = captured && ctx.mode === 'edit' ? `<span class="sch-cap-mark">from capture</span>` : '';
  return `<div class="${prefix}-read-sect-lbl"><span class="iconify ${icon} size-3.5 ${prefix}-read-sect-ic" aria-hidden="true"></span>${esc(text)}${countBadge(count)}${mark}</div>`;
}

/**
 * The one value SLOT. Read renders a borderless box; edit renders the input that box was sized
 * for. Both carry the same font, padding and min-height (global.css), so the row does not change
 * height when the mode flips — which is the entire point of the pattern.
 */
function slot(ctx: ReadBodyCtx, field: string, value: string | undefined, empty: string, multiline = true): string {
  const v = value || '';
  if (ctx.mode === 'edit') {
    return multiline
      ? `<textarea class="textarea textarea-sm sch-slot-in" data-ep-f="${esc(field)}" rows="3" aria-label="${esc(empty)}">${esc(v)}</textarea>`
      : `<input type="text" class="input input-sm sch-slot-in" data-ep-f="${esc(field)}" value="${esc(v)}" aria-label="${esc(empty)}" />`;
  }
  return `<div class="sch-slot${multiline ? ' is-multi' : ''}${v ? '' : ' is-empty'}">${v ? esc(v) : esc(empty)}</div>`;
}

/** The canonical segmented control (global.css `.sch-modeswitch`) — never a local copy. */
const modeSwitch = (ctx: ReadBodyCtx) =>
  `<div class="join sch-modeswitch sch-panel-modes">`
  + `<button type="button" class="btn btn-sm join-item${ctx.mode === 'read' ? ' sch-mode-active' : ''}" data-ep-mode="read"><span class="iconify lucide--book-open size-3.5" aria-hidden="true"></span>Read</button>`
  + `<button type="button" class="btn btn-sm join-item${ctx.mode === 'edit' ? ' sch-mode-active' : ''}" data-ep-mode="edit"><span class="iconify lucide--pencil size-3.5" aria-hidden="true"></span>Edit</button>`
  + `</div>`;

/**
 * A field chip carrying that field's Airtable TYPE glyph — the same mark Browse, Search
 * and the filters use, so one field reads identically everywhere. Falls back to the
 * generic kind glyph when the type is unknown. Sanctioned by the entity-chip catalog
 * entry: a sharper icon on the existing chip, never a second builder.
 *
 * `removable` is set only for a MANUAL tag in edit mode: a derived touch is a captured fact and
 * has no × (removing it would just mean disagreeing with the backup).
 */
function fieldChip(ctx: ReadBodyCtx, entityId: string, removable = false): string {
  const e = ctx.ent(entityId);
  const name = e ? e.name : entityId;
  const k = e?.fieldType ? airtableIconKey(e.fieldType) : null;
  const icon = k
    ? `<svg viewBox="0 0 16 16" aria-hidden="true">${AIRTABLE_FIELD_ICONS[k]}</svg>`
    : `<span class="iconify ${entityIconClass(e?.kind || 'field')} size-3.5" aria-hidden="true"></span>`;
  return removable
    ? entityChip({ name, icon, attrs: 'data-ep-push="' + esc(entityId) + '"', remove: 'data-ep-tagx="' + esc(entityId) + '"' })
    : entityChip({ name, icon, clickable: true, attrs: 'data-ep-push="' + esc(entityId) + '"' });
}

/** One table an entity reaches, with the fields it reaches inside it. */
interface TouchGroup {
  tableId?: string; tableName: string; fieldIds: string[]; derived: boolean;
  /** Ids that came from the MANUAL tag registry — the only ones edit mode may remove. */
  manual: Set<string>;
}

/**
 * ONE touches section (Oleh 2026-07-28): the definition-derived touches and the manual
 * tag registry describe the same thing — what this reaches — so they merge into a single
 * grouped list rather than sitting beside each other as near-duplicates. Provenance is
 * kept as a quiet note on groups that only a human added.
 */
function buildTouchGroups(src: AnatomyFields & { tags?: { entityId: string; source?: string }[] }, ctx: ReadBodyCtx): TouchGroup[] {
  const byName = new Map<string, TouchGroup>();
  const push = (tableName: string, tableId: string | undefined, fieldId: string | null, derived: boolean) => {
    let g = byName.get(tableName);
    if (!g) { g = { tableId, tableName, fieldIds: [], derived, manual: new Set() }; byName.set(tableName, g); }
    if (tableId && !g.tableId) g.tableId = tableId;
    if (derived) g.derived = true;
    if (fieldId && !g.fieldIds.includes(fieldId)) g.fieldIds.push(fieldId);
  };
  for (const t of readAnatomy(src).touches) {
    const te = ctx.ent(t.tableId);
    push(te?.name || t.tableId, t.tableId, null, true);
    for (const f of t.fieldIds || []) push(te?.name || t.tableId, t.tableId, f, true);
  }
  // A tag is a table OR a field; a field tag is grouped under the table it belongs to,
  // which `ent()` gives us by NAME (there is no table id on that path).
  for (const tag of src.tags || []) {
    const manual = tag.source !== 'auto';
    const e = ctx.ent(tag.entityId);
    if (!e) { push(tag.entityId, undefined, null, false); if (manual) byName.get(tag.entityId)?.manual.add(tag.entityId); continue; }
    if (e.kind === 'field') {
      const key = e.tableName || 'Unknown table';
      push(key, undefined, tag.entityId, !manual);
      if (manual) byName.get(key)?.manual.add(tag.entityId);
    } else {
      push(e.name, tag.entityId, null, !manual);
      if (manual) byName.get(e.name)?.manual.add(tag.entityId);
    }
  }
  return [...byName.values()];
}

/** One "label — value" row. The whole strip is built from these: it is how a detail panel
 *  states a fact, and it lets containment be shown by the row itself rather than by a box,
 *  an indent and a divider all arguing about it. */
const anatRow = (label: string, value: string) =>
  `<div class="sch-anat-row"><span class="sch-anat-k">${esc(label)}</span><span class="sch-anat-v">${value}</span></div>`;

/**
 * A table and the fields reached inside it, as ONE row: the table is the label, its fields
 * are the value. Containment then needs no explaining — it is the row.
 */
function touchGroupHtml(ctx: ReadBodyCtx, g: TouchGroup): string {
  const editing = ctx.mode === 'edit';
  const inner = `<span class="iconify lucide--table-2 size-3.5 sch-anat-tbl-ic" aria-hidden="true"></span><span class="sch-anat-tbl-n">${esc(g.tableName)}</span>`;
  const table = g.tableId
    ? `<button type="button" class="sch-anat-tbl" data-ep-push="${esc(g.tableId)}">${inner}</button>`
    : `<span class="sch-anat-tbl is-static">${inner}</span>`;
  // Only a MANUALLY tagged table gets an × — and only in edit mode. A derived touch is a fact.
  const tableX = editing && g.tableId && g.manual.has(g.tableId)
    ? `<button type="button" class="sb-chip-x sch-anat-tblx" data-ep-tagx="${esc(g.tableId)}" aria-label="Remove tag"><span class="iconify lucide--x size-3" aria-hidden="true"></span></button>`
    : '';
  const fields = g.fieldIds.length
    ? g.fieldIds.map((f) => fieldChip(ctx, f, editing && g.manual.has(f))).join('')
    // An em-dash, not an empty cell: "this table is touched, no specific field" is a fact,
    // and a blank would read as missing data.
    : `<span class="sch-anat-none">—</span>`;
  const note = g.derived ? '' : `<span class="sch-anat-src">added manually</span>`;
  return `<div class="sch-anat-row"><span class="sch-anat-k sch-anat-k-tbl">${table}${tableX}</span><span class="sch-anat-v">${fields}${note}</span></div>`;
}

/**
 * Touches, grouped by table, capped at 5 rows with the rest behind an inline disclosure
 * (the panel's list rule — an uncapped list is the worst case that rule exists to prevent).
 *
 * In EDIT mode the section also renders the tag-picker mount at its END (the panel moves the
 * shared EntitySearch node into it). It is appended below the last row on purpose: everything
 * above keeps its position, which is the rule this pattern is built on.
 */
function touchesHtml(prefix: 'au' | 'if', ctx: ReadBodyCtx, groups: TouchGroup[]): string {
  const editing = ctx.mode === 'edit';
  // Absent → omit the whole section in READ mode. The panel rule is "omit a section entirely when
  // absent", and an inventory-grade capture must not grow headers that exist only to announce they
  // are empty. Edit mode keeps it, because a section that only appears once it has content cannot
  // be used to add the first entry.
  if (!groups.length && !editing) return '';
  // NO "from capture" marker here, even though some groups ARE derived. Touches is the one MIXED
  // section: it merges the capture's touched tables/fields with the manual tag registry, and in edit
  // mode it carries the tag picker. A marker that says "this block has no inputs because it came
  // from the capture" would sit directly above an input — the pill has to mean exactly one thing, so
  // it stays on Trigger and Actions, which are captured end to end. Derived-vs-manual is already
  // distinguished per CHIP (derived chips are tinted and carry no ×), which is the honest altitude
  // for a mixed section (verified 2026-07-28: the marker and the picker were rendering together).
  const lbl = sectLbl(prefix, ctx, 'lucide--at-sign', 'Touches', groups.length);
  const CAP = 5;
  const shown = groups.slice(0, CAP).map((g) => touchGroupHtml(ctx, g)).join('');
  const rest = groups.slice(CAP);
  const more = rest.length
    ? `<details class="sch-anat-more"><summary>+${rest.length} more<span class="iconify lucide--chevron-down size-3.5 sch-def-chev" aria-hidden="true"></span></summary><div class="sch-anat-rows">${rest.map((g) => touchGroupHtml(ctx, g)).join('')}</div></details>`
    : '';
  const picker = editing
    ? `<div class="sch-tagpick"><span class="sch-tagpick-lbl">Tag another table or field</span><div data-ep-tagmount></div></div>`
    : '';
  return `<div>${lbl}<div class="sch-anat-rows">${shown}</div>${more}${picker}</div>`;
}

/**
 * The anatomy strip: trigger → touches → typed action count. Everything the panel shows
 * about a definition, and deliberately nothing more — no step configuration (the founder's
 * boundary, encoded as layout: there is no slot here it could occupy).
 *
 * THE TRIGGER SLOT RULE: one slot, two sources. When the capture carries a definition the trigger
 * is part of the anatomy and is NOT editable — there is captured data it would contradict. When
 * the entity was registered by hand and the capture is empty, that SAME slot renders the manual
 * trigger select in edit mode. Editability follows the data, never a separate box.
 */
function anatomyHtml(
  prefix: 'au' | 'if',
  src: AnatomyFields & { tags?: { entityId: string; source?: string }[]; triggerType?: string },
  ctx: ReadBodyCtx,
  manualTrigger: boolean,
): string {
  const a = readAnatomy(src);
  const groups = buildTouchGroups(src, ctx);

  // Trigger: the captured anatomy when present, else the manually registered value in the same slot.
  let trig = '';
  if (a.trigger) {
    const t = a.trigger;
    // Broken into labelled rows rather than written as a sentence, so the table is simply a value
    // and can be the entity chip it actually is.
    const tableCell = t.tableId
      ? entityChip({ name: ctx.ent(t.tableId)?.name || t.tableId, icon: `<span class="iconify lucide--table-2 size-3.5" aria-hidden="true"></span>`, clickable: true, attrs: 'data-ep-push="' + esc(t.tableId) + '"' })
      : '';
    const watched = t.watchedFieldIds || [];
    trig = `<div>${sectLbl(prefix, ctx, 'lucide--zap', 'Trigger', 0, true)}`
      + `<div class="sch-anat-rows">`
      + anatRow('Event', `<span class="sch-anat-event">${esc(t.type)}</span>`)
      + (tableCell ? anatRow('Table', tableCell) : '')
      // No "Stage, Name, and 2 more fields" summary above the chips: it restated the very list
      // sitting under it. Airtable uses that phrasing INSTEAD of showing the fields, not as well.
      + (watched.length ? anatRow('Fields', watched.map((f) => fieldChip(ctx, f)).join('')) : '')
      + `</div></div>`;
  } else if (manualTrigger) {
    // No capture to contradict → this is Baseout's own record of the trigger, so it is a field.
    // Rendered in BOTH modes (never appearing/disappearing with the mode), empty state included.
    const val = src.triggerType || '';
    const body = ctx.mode === 'edit'
      ? `<select class="select select-sm sch-slot-in" data-ep-f="triggerType" aria-label="Trigger type">`
        + `<option value=""${val ? '' : ' selected'}>Not recorded</option>`
        + TRIGGER_TYPES.map((t) => `<option value="${esc(t)}"${t === val ? ' selected' : ''}>${esc(t)}</option>`).join('')
        // Preserve a legacy / custom value that isn't one of the canonical options.
        + (val && !TRIGGER_TYPES.includes(val) ? `<option value="${esc(val)}" selected>${esc(val)}</option>` : '')
        + `</select>`
      : `<div class="sch-slot${val ? '' : ' is-empty'}">${val ? esc(val) : 'Not recorded'}</div>`;
    trig = `<div>${sectLbl(prefix, ctx, 'lucide--zap', 'Trigger')}${body}</div>`;
  } else if (src.triggerType) {
    trig = `<div>${sectLbl(prefix, ctx, 'lucide--zap', 'Trigger')}<div class="sch-slot">${esc(src.triggerType)}</div></div>`;
  }

  const s = a.actionSummary;
  // One type per line, and NO "N actions:" prefix — the count already sits in the section badge.
  const actionList = s && s.types.length
    ? `<p class="sch-anat-acts">${s.types.map((t) => esc(t)).join('<span class="sch-anat-dot" aria-hidden="true">·</span>')}</p>`
    : s
      ? `<p class="${prefix}-read-desc">${s.count} action${s.count === 1 ? '' : 's'}</p>`
      : '';
  const actions = s
    ? `<div>${sectLbl(prefix, ctx, 'lucide--play', 'Actions', s.count, true)}`
      + actionList
      // A script can reach anything; presenting a partial list as complete would be the
      // one genuinely dangerous thing this section could do.
      + (a.hasScript ? `<div role="note" class="alert alert-soft alert-warning sch-anat-note"><span class="iconify lucide--circle-alert size-4" aria-hidden="true"></span><span class="flex-1">This automation runs a script — the fields shown are those declared in its configuration, and may be incomplete.</span></div>` : '')
      + `</div>`
    : '';

  const na = a.depth === 'unknown' ? `<div><p class="sch-anat-na">Details not available for this capture.</p></div>` : '';

  // The blocks are ONE unit — the captured anatomy. Everything after them (descriptions, notes,
  // subscribers) is Baseout's own annotation, and a closing rule marks where the machine-read
  // facts stop and the human-written ones begin.
  const strip = `${na}${trig}${touchesHtml(prefix, ctx, groups)}${actions}`;
  return strip ? `${strip}<div class="sch-anat-end" aria-hidden="true"></div>` : '';
}

/**
 * The footer bar — ONE slot, two contents. Read carries Delete; edit carries Save + Cancel in the
 * same place, at the same height. Edit itself is no longer a footer button: it is the mode switch
 * in the identity line, so there is exactly one control that says which mode you are in.
 */
const panelFooter = (kind: 'automation' | 'interface', id: string, removed: boolean, mode: PanelMode) => {
  if (mode === 'edit') {
    return `<div class="sch-read-foot"><button type="button" class="btn btn-sm btn-primary gap-1.5" data-ep-save="${esc(id)}" data-ep-read-kind="${kind}"><span class="iconify lucide--check size-3.5" aria-hidden="true"></span>Save</button>`
      + `<button type="button" class="btn btn-sm btn-ghost" data-ep-cancel>Cancel</button>`
      + `<span class="sch-foot-hint">Esc to cancel</span></div>`;
  }
  // A removed entity is read-only history: nothing to delete, and (above) no mode switch either.
  return removed
    ? ''
    : `<div class="sch-read-foot"><button type="button" class="btn btn-sm btn-ghost text-error gap-1.5" data-ep-read-delete="${esc(id)}" data-ep-read-kind="${kind}"><span class="iconify lucide--trash-2 size-3.5" aria-hidden="true"></span>Delete</button></div>`;
};

/** Automation body — meta → trigger → touches → actions → descriptions → subscribers → changelog → raw. */
export function automationReadBody(a: AutomationLike, ctx: ReadBodyCtx): string {
  const removed = a.status === 'removed';
  const editing = ctx.mode === 'edit';
  const on = a.enabled !== false;
  const tone = removed ? 'red' : on ? 'green' : 'grey';
  const statusLabel = removed ? 'Removed' : on ? 'Active' : 'Inactive';
  // ONE status slot. Read states the fact as a dot + label (the panel canon); edit turns that same
  // slot into the switch. Removed keeps the plain dot in both modes — there is nothing to turn on
  // when it no longer exists in Airtable, and there is no edit mode for it either.
  const statusSlot = removed || !editing
    ? `<span class="au-status"><span class="au-dot au-dot-${tone}"></span>${statusLabel}</span>`
    : `<label class="au-status sch-slot-toggle">`
      + `<input type="checkbox" class="toggle toggle-sm toggle-primary" data-ep-f="enabled"${on ? ' checked' : ''} aria-label="Automation enabled" />`
      + `<span>${statusLabel}</span></label>`;

  const subs = a.subscribers || [];
  // Shown even when empty, because a section that only appears once it has content cannot be used
  // to add the first entry. Same container in both modes; edit adds the × and the add-input.
  const subChips = subs.map((e) =>
    `<span class="au-read-sub"><span class="iconify lucide--mail size-3.5" aria-hidden="true" style="opacity:.6"></span>${esc(e)}`
    + (editing ? `<button type="button" class="sb-chip-x" data-ep-subx="${esc(e)}" aria-label="Remove ${esc(e)}"><span class="iconify lucide--x size-3" aria-hidden="true"></span></button>` : '')
    + `</span>`).join('');
  const subsBody = editing
    ? `<div class="au-read-listbox">${subChips}<input type="email" class="input input-sm au-sub-add" data-ep-subadd placeholder="Add an email, then press Enter" autocomplete="off" aria-label="Add a subscriber" /></div>`
    // The empty state keeps the SAME container (not a bare line), so the box is one 56px row in
    // both modes and nothing under it moves when you press Edit.
    : `<div class="au-read-listbox">${subs.length ? subChips : '<span class="au-read-empty">No subscribers.</span>'}</div>`;
  const subsHtml = `<div>${sectLbl('au', ctx, 'lucide--users', 'Subscribers', subs.length)}${subsBody}</div>`;

  const noteHtml =
    `<div>${sectLbl('au', ctx, 'lucide--text', 'Airtable description')}${slot(ctx, 'airtableDescription', a.airtableDescription, 'No Airtable description saved.')}</div>` +
    `<div>${sectLbl('au', ctx, 'lucide--text', 'Internal note')}${slot(ctx, 'internalDescription', a.internalDescription, 'No internal note yet.')}</div>`;

  // Wrapped in .au-read so the shared 28px inter-section rhythm applies inside the stacking panel's
  // .ep-body (the old one-off drawer got this spacing from the same container).
  return `<div class="au-read">
    <div class="au-read-meta"><span class="au-read-kind">Automation</span><span class="au-read-sep" aria-hidden="true">·</span>${statusSlot}<span class="au-read-sep" aria-hidden="true">·</span><span class="au-meta-fresh">as of last backup</span>${removed ? '' : modeSwitch(ctx)}</div>
    ${anatomyHtml('au', a, ctx, true)}
    ${noteHtml}
    ${subsHtml}
    ${ctx.changelogHtml(a.id)}
    ${a.definition ? `<details class="sch-read-def"><summary>Raw definition (JSON)<span class="iconify lucide--chevron-down size-3.5 sch-def-chev" aria-hidden="true"></span></summary><pre>${esc(a.definition)}</pre></details>` : ''}
    ${panelFooter('automation', a.id, removed, ctx.mode)}
  </div>`;
}

/** Interface / page body — meta → internal note → pages → touches → changelog → raw. */
export function interfaceReadBody(i: InterfaceLike, ctx: ReadBodyCtx): string {
  const removed = i.status === 'removed';
  const editing = ctx.mode === 'edit';
  const kindLabel = i.type === 'page' ? 'Page' : 'Interface';
  const published = i.published !== false;
  const tone = removed ? 'red' : published ? 'green' : 'grey';
  const statusLabel = removed ? 'Removed' : published ? 'Published' : 'Not published';
  const statusSlot = removed || !editing
    ? `<span class="if-status"><span class="if-dot if-dot-${tone}"></span>${statusLabel}</span>`
    : `<label class="if-status sch-slot-toggle">`
      + `<input type="checkbox" class="toggle toggle-sm toggle-primary" data-ep-f="published"${published ? ' checked' : ''} aria-label="Published in Airtable" />`
      + `<span>${statusLabel}</span></label>`;
  const pages = i.type === 'interface' ? i.pages || [] : [];
  const related = pages.length
    ? `<div>${sectLbl('if', ctx, 'lucide--layout-panel-left', 'Pages', pages.length)}<div class="if-read-pages">${pages.map((p) => `<button type="button" class="if-read-page" data-ep-push="${esc(p.id)}"><span class="iconify lucide--file size-3.5" aria-hidden="true"></span>${esc(p.name)}</button>`).join('')}</div></div>`
    : '';
  // Wrapped in .if-read for the shared 28px inter-section rhythm inside the stacking panel's .ep-body.
  return `<div class="if-read">
    <div class="if-read-meta"><span class="if-read-kind">${kindLabel}</span>${i.pageType ? `<span class="if-read-sep" aria-hidden="true">·</span><span class="sch-anat-ptype">${esc(i.pageType)}</span>` : ''}<span class="if-read-sep" aria-hidden="true">·</span>${statusSlot}<span class="if-read-sep" aria-hidden="true">·</span><span class="if-meta-fresh">as of last backup</span>${removed ? '' : modeSwitch(ctx)}</div>
    <div>${sectLbl('if', ctx, 'lucide--text', 'Internal note')}${slot(ctx, 'internalDescription', i.internalDescription, 'No note yet — add one so teammates know what this shows.')}</div>
    ${related}
    ${anatomyHtml('if', i, ctx, false)}
    ${ctx.changelogHtml(i.id)}
    ${i.definition ? `<details class="sch-read-def"><summary>Raw definition (JSON)<span class="iconify lucide--chevron-down size-3.5 sch-def-chev" aria-hidden="true"></span></summary><pre>${esc(i.definition)}</pre></details>` : ''}
    ${panelFooter('interface', i.id, removed, ctx.mode)}
  </div>`;
}

/** Changelog-section HTML for an item id, from a flat change list — shared by the panel. */
export function readChangelogHtml(prefix: 'au' | 'if', changes: { entityId?: string; at: string; type: string; summary: string; before?: string; after?: string }[], id: string): string {
  const CL_ICON: Record<string, string> = { added: 'lucide--plus-circle', removed: 'lucide--minus-circle', renamed: 'lucide--pencil-line', config: 'lucide--sliders-horizontal' };
  const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const evs = changes.filter((c) => c.entityId === id).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  if (!evs.length) return '';
  const items = evs.map((c) => `<li class="${prefix}-cl-item ${prefix}-cl-${c.type}"><span class="iconify ${CL_ICON[c.type] || 'lucide--dot'} size-3.5 ${prefix}-cl-ic" aria-hidden="true"></span><span class="${prefix}-cl-txt">${esc(c.summary)}${c.before && c.after ? ` <span class="${prefix}-cl-delta">${esc(c.before)} → ${esc(c.after)}</span>` : ''}</span><span class="${prefix}-cl-when">${esc(fmt(c.at))}</span></li>`).join('');
  return `<div><div class="${prefix}-read-sect-lbl"><span class="iconify lucide--history size-3.5 ${prefix}-read-sect-ic" aria-hidden="true"></span>Changelog${countBadge(evs.length)}</div><ul class="${prefix}-cl">${items}</ul></div>`;
}
