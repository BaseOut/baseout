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
import { fmtDay, fmtTime } from '../../lib/time';
import { entityChip } from './entityChip';
import { AIRTABLE_FIELD_ICONS, airtableIconKey } from './airtableFieldIcons';
import { AIRTABLE_GLYPH } from './airtableGlyph';
import { readAnatomy, type AnatomyFields } from './automationAnatomy';
import { TRIGGER_TYPES } from './schemaTriggerTypes';
import { entityIconClass, entityIconMarkup } from './entityIcon';
import { fieldTypeLabel, viewTypeLabel, tableRelationships, type SchemaEntity } from './schemaEntities';

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

export const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
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
  const inner = `<span class="iconify lucide--table-2 concept-ic-table size-3.5 sch-anat-tbl-ic" aria-hidden="true"></span><span class="sch-anat-tbl-n">${esc(g.tableName)}</span>`;
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
      ? entityChip({ name: ctx.ent(t.tableId)?.name || t.tableId, icon: `<span class="iconify lucide--table-2 concept-ic-table size-3.5" aria-hidden="true"></span>`, clickable: true, attrs: 'data-ep-push="' + esc(t.tableId) + '"' })
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
    // "Airtable copy", not "Airtable description": the API can't export an automation's description,
    // so this is a copy the user records in Baseout and nothing here is written back.
    `<div>${sectLbl('au', ctx, 'lucide--text', 'Airtable copy')}${slot(ctx, 'airtableDescription', a.airtableDescription, 'No copy of the Airtable description recorded.')}</div>` +
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
      // The toggle records a FACT in Baseout; it does not publish or unpublish anything in
      // Airtable (we never write there). The label has to say so, or a live switch beside
      // "published in Airtable" reads as an unpublish control.
      + `<input type="checkbox" class="toggle toggle-sm toggle-primary" data-ep-f="published"${published ? ' checked' : ''} aria-label="Record whether this is published in Airtable" />`
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

/**
 * The two blocks the Changelog TAB's private drawer used to own, now rendered on the change itself
 * (2026-08-06, T6). They are the reason that drawer was worth opening: an AI-written plain-language
 * reading of the change, and the broken-data warning ("12 records may now have invalid values").
 * Deleting the drawer without moving these would have been a consolidation that costs information.
 * Catalog Alerts (`alert alert-soft alert-{info|warning}`) — the same two the drawer used.
 */
export function changeDetailHtml(c: { aiSummary?: string; warning?: string }): string {
  const ai = c.aiSummary
    ? `<div class="alert alert-soft alert-info ep-cl-ai" role="status"><span class="iconify lucide--sparkles size-4" aria-hidden="true"></span><div><div class="ep-cl-ai-head">AI summary</div><p class="ep-cl-ai-text">${esc(c.aiSummary)}</p></div></div>`
    : '';
  const warn = c.warning
    ? `<div class="alert alert-soft alert-warning ep-cl-warn" role="alert"><span class="iconify lucide--triangle-alert size-4" aria-hidden="true"></span><span>${esc(c.warning)}</span></div>`
    : '';
  return ai || warn ? `<div class="ep-cl-detail">${ai}${warn}</div>` : '';
}

/** Changelog-section HTML for an item id, from a flat change list — shared by the panel. */
export function readChangelogHtml(prefix: 'au' | 'if', changes: { id?: string; entityId?: string; at: string; type: string; summary: string; before?: string; after?: string; aiSummary?: string; warning?: string }[], id: string): string {
  const CL_ICON: Record<string, string> = { added: 'lucide--plus-circle', removed: 'lucide--minus-circle', renamed: 'lucide--pencil-line', config: 'lucide--sliders-horizontal' };
  const evs = changes.filter((c) => c.entityId === id).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  if (!evs.length) return '';
  // `data-ep-cl-row` is the FOCUS TARGET: a Changelog-tab row opens this panel and asks it to land on
  // exactly this change (entityPanelController.focusChange), the shape RecordPanel already uses for a
  // deep-linked comment (`data:openRecord { focus, commentId }` → `[data-rp-comment]`).
  const items = evs.map((c) => `<li class="${prefix}-cl-item ${prefix}-cl-${c.type}"${c.id ? ` data-ep-cl-row="${esc(c.id)}"` : ''}><span class="iconify ${CL_ICON[c.type] || 'lucide--dot'} size-3.5 ${prefix}-cl-ic" aria-hidden="true"></span><span class="${prefix}-cl-txt">${esc(c.summary)}${c.before && c.after ? ` <span class="${prefix}-cl-delta">${esc(c.before)} → ${esc(c.after)}</span>` : ''}${changeDetailHtml(c)}</span><span class="${prefix}-cl-when">${esc(fmtDay(c.at))} · ${esc(fmtTime(c.at))}</span></li>`).join('');
  return `<div><div class="${prefix}-read-sect-lbl"><span class="iconify lucide--history size-3.5 ${prefix}-read-sect-ic" aria-hidden="true"></span>Changelog${countBadge(evs.length)}</div><ul class="${prefix}-cl">${items}</ul></div>`;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * entityReadBody — the SCHEMA-ENTITY body (space · base · table · field · view)
 *
 * Extracted from EntityPanel.astro's private `renderBody()` closure (2026-08-03) with NO
 * behaviour change, for the reason `recordReadBody.ts` already exists: a body that lives inside
 * one host can only be reused by importing that host, so the second surface ships a reduced copy
 * instead — and a table opened from Attachments then silently becomes a lesser table than the
 * same table opened from Schema. Catalog: pattern-multi-panel-drawer ("a body is a pure
 * (entity, ctx, view) => string module; a private renderBody() closure inside a host is the
 * anti-pattern") and pattern-entity-panel.
 *
 * Host-agnostic: it takes the entity, a resolver ctx and a view-state snapshot, and returns HTML.
 * It never touches a `createPanelStack` instance, and it never owns state.
 *
 * WHAT DELIBERATELY STAYS IN THE HOST (pattern-panel-edit-mode):
 *   · `descStates` / `editIds` / `drafts` — PER PANEL, keyed PER ENTITY. The body reads them
 *     through `ctx.descOf` and the `view` snapshot; it must never cache or own
 *     them. Two panels can legitimately show the SAME entity, and each keeps its own uncommitted
 *     text; hoisting any of the three to a host-wide map makes typing in one rewrite the other,
 *     and no lint, typecheck or build can see it.
 *   · `descEditCaret` / `focusDescInput` / `caretOffsetAt` — DOM-side. A string builder must not
 *     own caret restoration.
 *   · The automation / interface branch, the header (icon · name · crumbs · section-nav rail),
 *     and every delegated click handler.
 *
 * All markup keeps the `.ep-*` class names, which live in EntityPanel.astro as `is:global` — the
 * body is innerHTML-injected, and an Astro scoped style never reaches it.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The description pair for ONE entity, owned by ONE panel.
 * `airtable` is a READ MIRROR — Baseout never writes it (pattern-access-scope); `extended` is
 * Baseout's own note and the only editable half.
 */
export interface DescState { airtable: string; extended: string }
export type DescField = 'airtable' | 'extended';
export interface EntityDocRef { id: string; title: string }
/**
 * `aiSummary` / `warning` moved here from the Changelog tab's deleted drawer (T6) — see
 * `changeDetailHtml`. `where` is set ONLY when the change is about something that is no longer in
 * the snapshot and was therefore attributed to its nearest surviving ancestor: it names what the
 * change was actually about, so a field-deletion listed under its table never reads as if the table
 * itself changed.
 */
export interface EntityClItem { id: string; at: string; type: string; summary: string; before?: string; after?: string; entityId?: string; aiSummary?: string; warning?: string; where?: string }
export interface EntityTagRef { id: string; name: string; kind: 'automation' | 'interface' | 'page' }

/** Everything the body must be able to RESOLVE. Pure lookups — no state lives here. */
export interface EntityBodyCtx {
  /** Resolve any id the host can render, including its panel-local pseudo-entities. */
  byId: (id: string) => SchemaEntity | undefined;
  /** The whole entity index — needed to invert the reference graph and to find views. */
  index: SchemaEntity[];
  /** Documents the host knows about (for the Documentation section). */
  docs: EntityDocRef[];
  /** This entity's own change events. */
  changelogFor: (id: string) => EntityClItem[];
  /** Automations / interfaces / pages that tag this entity. */
  refsFor: (id: string) => EntityTagRef[];
  /** Chats that tag this entity. */
  chatRefsFor: (id: string) => { id: string; title: string }[];
  /** 'ready' | 'locked' | … — gates the Generate-with-AI affordances. */
  aiState: string;
  /** An interface id → which glyph it takes (a page and its parent interface differ). */
  interfaceGlyph: (id: string) => 'page' | 'interface';
  /** The PANEL'S per-entity description overlay. The body reads it; the panel owns it. */
  descOf: (e: SchemaEntity) => DescState;
}

/**
 * A snapshot of the panel's transient view state, rebuilt on every render by the host.
 * `sections` is the one OUT parameter: the builder clears it and pushes each section in render
 * order, so the host's section-nav strip can never drift from the body it labels.
 */
export interface EntityViewState {
  /** Which field (if any) is open in the textarea, and on which entity. */
  descEdit: { id: string; field: DescField } | null;
  /** Which source tab is showing (persists across the innerHTML rebuilds each action triggers). */
  descTab: DescField;
  /** True while the open editor's text came from Generate (drives the AI disclaimer slot). */
  descEditAi: boolean;
  /** OUT: sections in render order — cleared and refilled by entityReadBody. */
  sections: { slug: string; label: string }[];
}

const epDot = (h: string) => `<span class="ep-dot ep-dot-${h === 'green' ? 'green' : h === 'red' ? 'red' : 'amber'}"></span>`;
const epHealthLabel = (h: string) => (h === 'green' ? 'Healthy' : h === 'red' ? 'Needs attention' : 'Could improve');

/** A field's own Airtable TYPE glyph — richer than entityIcon's generic tag, so it stays local. */
export const epFieldIcon = (type?: string) => {
  const k = type ? airtableIconKey(type) : null;
  return k ? `<svg viewBox="0 0 16 16" aria-hidden="true">${AIRTABLE_FIELD_ICONS[k]}</svg>` : '<span class="iconify lucide--circle size-3.5"></span>';
};

/**
 * The header/row glyph for an entity. `size: ''` — this icon is sized by `.ep-row-ic .iconify`
 * (global.css), not a per-span Tailwind size class. FIELD is the deliberate exception: it shows
 * the field's actual Airtable type icon rather than going through the shared mapping.
 * Exported because the host's crumb + title rows need the same glyph as the body's rows.
 */
export const entityKindIcon = (e: SchemaEntity, ctx: EntityBodyCtx): string =>
  e.kind === 'space' ? entityIconMarkup('space', { size: '' })
  : e.kind === 'base' ? entityIconMarkup('base', { size: '' })
  : e.kind === 'table' ? entityIconMarkup('table', { size: '' })
  : e.kind === 'automation' ? entityIconMarkup('automation', { size: '' })
  : e.kind === 'interface' ? entityIconMarkup(ctx.interfaceGlyph(e.id), { size: '' })
  : e.kind === 'view' ? entityIconMarkup('view', { size: '' })
  : epFieldIcon(e.fieldType);

/** One reference row. The wrapper exists so the hover "open beside" ⧉ can be a SIBLING button
 *  (a <button> cannot nest inside the row <button>). */
export function entityRow(e: SchemaEntity, ctx: EntityBodyCtx, dir?: string): string {
  const type = e.kind === 'field' ? `<span class="ep-row-type">${esc(fieldTypeLabel(e.fieldType))}</span>`
    : e.kind === 'view' ? `<span class="ep-row-type">${esc(viewTypeLabel(e.viewType))}</span>` : '';
  const dirLabel = dir ? `<span class="ep-rel-dir">${dir}</span>` : '';
  return `<div class="ep-rowwrap">
        <button type="button" class="ep-row" data-ep-push="${e.id}">
        <span class="ep-row-ic">${entityKindIcon(e, ctx)}</span>
        <span class="ep-row-name">${esc(e.name)}${e.isPrimary ? ' <span class="ep-row-type">· primary</span>' : ''}</span>
        ${type}${dirLabel}${epDot(e.health)}
        <span class="iconify lucide--chevron-right size-3.5 ep-row-chev"></span>
      </button>
        <button type="button" class="btn btn-sm btn-ghost btn-square ps-beside ep-beside tooltip tooltip-left" data-ep-beside="${e.id}" aria-label="Open beside" data-tip="Open beside · ⌘/Ctrl-click"><span class="iconify lucide--columns-2 size-4" aria-hidden="true"></span></button>
      </div>`;
}

// Canon (c) hierarchy: a top-level section header carries a quiet grey concept icon (the SAME
// icons the app/tabs use). Sub-labels inside a section (.ep-cfg-k: Formula / References / Rolls up)
// do NOT go through section(), so they stay icon-less — that contrast is what marks the levels.
const EP_SECTION_ICON: Record<string, string> = {
  Description: 'lucide--text', Descriptions: 'lucide--text',
  Configuration: 'lucide--settings-2',
  Relationships: 'lucide--waypoints', 'Derived from': 'lucide--waypoints',
  Fields: 'lucide--table-2', Tables: 'lucide--table-2',
  'Fields shown': 'lucide--columns-3',
  Options: 'lucide--list', Changelog: 'lucide--history',
  Documentation: 'lucide--book-text', 'Referenced by': 'lucide--link',
};

/** Sections are collected into `view.sections` in render order so the host's section-nav chip
 *  strip always matches the body. Label = the title text before any trailing badge HTML; slug =
 *  a stable anchor id. Section titles are unique within one panel, so slugs don't collide. */
function epSection(view: EntityViewState, title: string, count: number | null, inner: string): string {
  const label = title.split('<')[0].trim();
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  view.sections.push({ slug, label });
  // Look the icon up by the LABEL, not the raw title: a title may carry trailing markup (the
  // "N of M" counter), and keying on the whole string silently dropped the icon in exactly
  // those cases.
  const ic = EP_SECTION_ICON[label];
  const icHtml = ic ? `<span class="iconify ${ic} size-3.5 ep-sec-ic" aria-hidden="true"></span>` : '';
  // Count badge only when it carries information: a lone item (count === 1) is self-evident
  // from the single row below, so we suppress the "1" badge. Shown from 2 upward.
  const nBadge = count !== null && count > 1 ? `<span class="badge badge-sm badge-neutral ep-sec-n">${count}</span>` : '';
  return `<div class="ep-sec" id="ep-sec-${slug}"><div class="ep-sec-h">${icHtml}${title}${nBadge}</div>${inner}</div>`;
}

// Canon (b): cap a row list at 5, then a "+N more" disclosure holding the rest. Rows keep their
// data-ep-* attrs, so the host's delegated click handler still opens each entity from inside the
// disclosure. Prevents the 50-reference worst-case wall.
function epCapRows(rowHtml: string[], cap = 5): string {
  if (rowHtml.length <= cap) return `<div class="ep-rows">${rowHtml.join('')}</div>`;
  const rest = rowHtml.length - cap;
  // The whole capped list is ONE container: the first `cap` rows, then the "+N more" details
  // (its expanded rows are direct .ep-row children, so the hairline separators + clipped hover
  // continue seamlessly inside the same box).
  return `<div class="ep-rows">`
    + rowHtml.slice(0, cap).join('')
    + `<details class="ep-more">`
    + `<summary class="ep-more-sum">+${rest} more<span class="iconify lucide--chevron-down size-3.5 ep-more-chev" aria-hidden="true"></span></summary>`
    + rowHtml.slice(cap).join('')
    + `</details>`
    + `</div>`;
}

// B3/B8 — the REVERSE reference graph, inverted from the forward field config carried in `index`.
// PRODUCTION / ENGINE NOTE: Airtable's meta API returns only the FORWARD config (a formula's
// referenced fields, a lookup/rollup's target). The reverse edges ("what references THIS field")
// are NOT returned — the engine must invert the graph across the base. Here the mirror derives it
// client-side from the fixtures; do not hand-fake edges.
function epFieldReferencers(e: SchemaEntity, index: SchemaEntity[]): SchemaEntity[] {
  if (e.kind !== 'field') return [];
  const seen = new Set<string>();
  const out: SchemaEntity[] = [];
  for (const t of index) {
    if (t.kind !== 'field' || t.id === e.id) continue;
    const hit = (t.referencedFieldIds || []).includes(e.id) || t.lookupTargetFieldId === e.id || t.derivedFrom === e.id;
    if (hit && !seen.has(t.id)) { seen.add(t.id); out.push(t); }
  }
  return out;
}

// Descriptions as two source tabs (Airtable · Internal) — pattern-annotation-field.
//
// READ MIRROR + OWNED NOTE (2026-08-07). The Airtable copy is a MIRROR: Baseout reads Airtable and
// never writes it, so this half has no editor, no AI Generate and no action row at all — only the
// value, the provenance caption and one forward pointer to Actions. The token our connect flow
// tells users to create (`schema.bases:read` + `data.records:read`) cannot write a field
// description, so the old Draft → Publish lifecycle was not merely off-strategy, it was
// unbuildable; it is deleted, not deprecated (pattern-access-scope). The Internal note is
// Baseout's own and stays fully editable, and it is the only half AI generates into.
function epRenderDescriptions(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  // Removed entities are read-only history — show last-known values only (no edit / AI).
  if (e.removed) {
    const sr = ctx.descOf(e);
    const block = (cap: string, val: string) => `<div class="ep-desc-panel" style="margin-top:12px">${val.trim() ? `<div class="ep-desc-v">${esc(val)}</div>` : `<div class="ep-desc-v ep-empty">—</div>`}</div><div class="ep-desc-meta">${cap}</div>`;
    let ro = '';
    if (sr.airtable.trim()) ro += block('Airtable description · from the last backup', sr.airtable);
    if (sr.extended.trim()) ro += block('Internal note · from the last backup', sr.extended);
    if (!ro) ro = `<p class="ep-empty-note">No description was captured before it was deleted.</p>`;
    return epSection(view, 'Description', null, ro);
  }
  const s = ctx.descOf(e);
  // The Internal note's AI draft is prompted to be more technical/verbose. In this faked
  // harness we fall back to the public AI text where no distinct technical draft is seeded
  // (in production the engine always returns a separate, more-technical draft).
  const aiTech = (e.aiTechnicalDescription || e.aiDescription || '').trim();
  const editing = view.descEdit && view.descEdit.id === e.id ? view.descEdit.field : null;
  const canGenExt = ctx.aiState === 'ready' && !!aiTech;
  const credit = '<span class="ep-credit">10 credits</span>';

  // Scope captions — a quiet note under each value, stated as PROVENANCE rather than permission.
  // The mirrored half carries the Airtable mark (pattern-access-scope: marked ⇒ we never write it);
  // the owned half carries none, and that absence is the affordance.
  const atMeta = `<div class="ep-desc-meta"><span class="ep-desc-meta-ic ep-desc-at-mark" aria-hidden="true">${AIRTABLE_GLYPH}</span>From Airtable, as of the last backup. Baseout never writes to Airtable.</div>`;
  const extMeta = `<div class="ep-desc-meta"><span class="iconify lucide--eye-off size-3.5 ep-desc-meta-ic"></span>Visible only in Baseout.</div>`;

  // Only the Internal note has an editor — the Airtable half is a mirror.
  const editor = (value: string) => {
    const gen = canGenExt
      ? `<button type="button" class="btn btn-sm btn-ghost gap-1.5 text-primary" data-ep-desc-gen="extended"><span class="iconify lucide--sparkles size-3.5"></span><span>${value.trim() ? 'Regenerate' : 'Generate'} ${credit}</span></button>`
      : '';
    // AI disclaimer owns the "under the input" slot, and only in edit mode — at rest a value we
    // only read has no state worth a line (Square / Udemy "review before…" pattern).
    const hint = view.descEditAi
      ? `<div class="ep-desc-hint"><span class="iconify lucide--sparkles size-3.5"></span>AI-generated — review before saving.</div>`
      : '';
    return `<textarea class="textarea textarea-bordered textarea-sm w-full ep-desc-input" rows="6" data-ep-desc-input placeholder="Internal notes — more technical detail, visible only in Baseout…">${esc(value)}</textarea>
          ${extMeta}
          ${hint}
          <div class="ep-actions">
            <button type="button" class="btn btn-sm btn-primary gap-1.5" data-ep-desc-save="extended"><span class="iconify lucide--check size-3.5"></span>Save</button>
            ${gen}
            <button type="button" class="btn btn-sm btn-ghost ml-auto" data-ep-desc-cancel>Cancel</button>
          </div>`;
  };

  // The value box holds ONLY the description content; the caption, status and actions are
  // siblings BELOW it. When `field` is set the box doubles as the edit affordance — clicking
  // it (or focusing + Enter) drops straight into the textarea at the caret, with no separate
  // "Edit" button to gate it. (The caret itself is restored by the HOST — see the header note.)
  const box = (inner: string, field?: DescField) =>
    `<div class="ep-desc-panel${field ? ' ep-desc-zone' : ''}"${field ? ` data-ep-desc-editzone="${field}" tabindex="0" role="button" aria-label="Edit description"` : ''}>${inner}${field ? '<span class="ep-desc-zone-ic" aria-hidden="true"><span class="iconify lucide--pencil size-3.5"></span></span>' : ''}</div>`;

  // The MIRRORED half — exactly two states, both read-only: empty and filled. No editor, no AI, no
  // action row. The empty one is PLAIN TEXT and not click-to-edit: a disabled control would say
  // "not right now", and the truth is "not here, ever". The forward pointer is ONE daisyUI tooltip
  // on the value (never a native `title=` — the DS bans it, and the app paints every `[data-tip]`
  // through one controller), not a badge repeated on every row of a thousand-field tree.
  const atValue = s.airtable.trim()
    ? `<div class="ep-desc-v">${esc(s.airtable)}</div>`
    : `<div class="ep-desc-v ep-empty">No description in Airtable.</div>`;
  const at = `<div class="tooltip tooltip-bottom ep-desc-tip" data-tip="Changing this in Airtable will be possible from Actions.">${box(atValue)}</div>${atMeta}`;

  let ext: string;
  if (editing === 'extended') {
    ext = editor(s.extended);
  } else if (s.extended.trim() === '') {
    // Mirror the Airtable empty-state: offer AI generation (a more technical draft) as the
    // alternative to writing the internal note by hand.
    const genExtCta = canGenExt
      ? `<div class="ep-actions"><button type="button" class="btn btn-sm btn-primary gap-1.5" data-ep-desc-gen="extended"><span class="iconify lucide--sparkles size-3.5"></span><span>Generate with AI ${credit}</span></button></div>`
      : ctx.aiState === 'locked'
      ? `<div class="ep-actions"><a href="/settings/billing" class="btn btn-sm btn-primary gap-1.5"><span class="iconify lucide--lock size-3.5"></span>Generate with AI</a></div>`
      : '';
    ext = box(`<div class="ep-desc-v ep-empty">Click to add an internal note — more technical detail for your team.</div>`, 'extended') + extMeta + genExtCta;
  } else {
    ext = box(`<div class="ep-desc-v">${esc(s.extended)}</div>`, 'extended') + extMeta;
  }

  // Custom two-button tab strip with a full-width baseline rail (the daisyUI radio tabs left
  // the labels "floating" with no underline). Only the active panel renders; switching tabs
  // re-renders via the host's click handler (descTab persists across rebuilds).
  // The MIRRORED tab carries the Airtable mark; the OWNED tab carries none, and that absence is
  // what teaches the read/write rule without stating it twice (pattern-access-scope).
  const isAirtable = view.descTab !== 'extended';
  const tabsBar = `<div role="tablist" class="ep-desc-tabsbar">
        <button type="button" role="tab" aria-selected="${isAirtable}" class="ep-desc-tabbtn ep-desc-tabbtn-mark${isAirtable ? ' ep-tab-on' : ''}" data-ep-desc-tab="airtable"><span class="ep-desc-tab-mark" aria-hidden="true">${AIRTABLE_GLYPH}</span>Airtable</button>
        <button type="button" role="tab" aria-selected="${!isAirtable}" class="ep-desc-tabbtn${!isAirtable ? ' ep-tab-on' : ''}" data-ep-desc-tab="extended">Internal</button>
      </div>`;
  const tabs = `${tabsBar}<div role="tabpanel" class="ep-desc-tab">${isAirtable ? at : ext}</div>`;

  return epSection(view, 'Descriptions', null, tabs);
}

// C4 — this entity's change history (the same feed, scoped to one entity).
const EP_CL_BADGE: Record<string, string> = { added: 'badge-soft badge-success', removed: 'badge-soft badge-error', renamed: 'badge-soft badge-primary', typed: 'badge-soft badge-warning', config: 'badge-ghost', view: 'badge-ghost' };
const EP_CL_LABEL: Record<string, string> = { added: 'Added', removed: 'Removed', renamed: 'Renamed', typed: 'Type changed', config: 'Config changed', view: 'View' };

function epRenderChangelogSection(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  const items = ctx.changelogFor(e.id);
  if (!items.length) return '';
  // `data-ep-cl-row` is the FOCUS TARGET a Changelog-tab row deep-links to (see changeDetailHtml).
  const rows = items.map((c) => `<div class="ep-cl-row" data-ep-cl-row="${esc(c.id)}">
        <div class="ep-cl-top"><span class="badge badge-sm ${EP_CL_BADGE[c.type] || 'badge-ghost'}">${esc(EP_CL_LABEL[c.type] || c.type)}</span><span class="ep-cl-date">${esc(fmtDay(c.at))} · ${esc(fmtTime(c.at))}</span></div>
        ${c.where ? `<div class="ep-cl-where"><span class="iconify lucide--corner-down-right size-3.5" aria-hidden="true"></span>${esc(c.where)}</div>` : ''}
        <div class="ep-cl-sum">${esc(c.summary)}${c.before && c.after ? ` <span class="ep-cl-delta"><span class="ep-cl-before">${esc(c.before)}</span> → <span class="ep-cl-after">${esc(c.after)}</span></span>` : ''}</div>
        ${changeDetailHtml(c)}
      </div>`).join('');
  return epSection(view, 'Changelog', items.length, `<div class="ep-cl">${rows}</div>`);
}

function epRenderDocsSection(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  const refs = (e.docIds || []).map((id) => ctx.docs.find((d) => d.id === id)).filter(Boolean) as EntityDocRef[];
  const inner = refs.length
    ? `<div class="ep-rows">${refs.map((d) => `<button type="button" class="ep-row" data-ep-doc="${d.id}"><span class="ep-row-ic"><span class="iconify lucide--file-text size-3.5"></span></span><span class="ep-row-name">${esc(d.title)}</span><span class="iconify lucide--arrow-up-right size-3.5 ep-row-chev"></span></button>`).join('')}</div>`
    : `<p class="ep-empty-note">No documents reference this yet.</p>`;
  return epSection(view, 'Documentation', refs.length || null, inner);
}

// ── view-schema-details: "Fields shown" (VIEW panels only) ────────────────────────────────
//
// Airtable returns a view's `visibleFieldIds` for GRID views and, per the founder, only through
// the REST API on an ENTERPRISE AIRTABLE ACCOUNT — the MCP route yields id/name/type alone. Both
// capture depths ship, so this block renders either way and the two absences are worded apart:
//
//   • non-grid view      → Airtable never returns it, for anybody. Permanent, blameless.
//   • grid view, absent  → THIS connection did not read that deep.
//
// The gate is the CUSTOMER'S Airtable plan, not Baseout's, so the copy names the connection and
// carries no tier language, no price and no CTA — there is nothing here for us to sell.
//
// NEVER a bare "12 of 34": that answers a question nobody asked and provokes the one they did.
// The fields are NAMED, as entity chips with their Airtable field-type glyph + the panel-push hook.
//
// The cap is 20, NOT the 5 the row-lists use. That rule bounds VERTICAL space — five rows are
// five lines — and chips do not spend height the same way: twenty of them wrap into roughly the
// height four rows would take. Applying a row cap to a chip box was a category error; it hid
// fields for no reason while the panel had room for them (Oleh 2026-07-29).
//
// And the overflow expands INSIDE the same box. It is one list; splitting it into a second
// bordered box below made two lists appear where there is one.
const EP_CHIP_CAP = 20;
function epChipBox(chips: string[]): string {
  if (chips.length <= EP_CHIP_CAP) return `<div class="ep-chipbox">${chips.join('')}</div>`;
  const rest = chips.length - EP_CHIP_CAP;
  return `<div class="ep-chipbox">${chips.slice(0, EP_CHIP_CAP).join('')}`
    + `<details class="ep-chipmore"><summary class="ep-chipmore-sum">+${rest} more<span class="iconify lucide--chevron-down size-3.5 ep-more-chev" aria-hidden="true"></span></summary></details>`
    + `<span class="ep-chiprest">${chips.slice(EP_CHIP_CAP).join('')}</span></div>`;
}

function epRenderViewFields(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  if (e.kind !== 'view') return '';
  const ids = e.visibleFieldIds;
  if (!ids) {
    // No `visibleFieldIds` at all. Which silence is it?
    const note = e.viewType && e.viewType !== 'grid'
      ? `Airtable only shares which fields a view shows for <strong>grid</strong> views, so there is nothing to capture for a ${esc(viewTypeLabel(e.viewType))} view.`
      : `This connection didn’t include which fields this view shows. Airtable returns that only through its REST API on an enterprise Airtable account.`;
    return epSection(view, 'Fields shown', null, `<p class="ep-empty-note">${note}</p>`);
  }
  // An id that doesn't resolve against the index would otherwise render as the raw string.
  const fields = ids.map((id) => ctx.byId(id)).filter(Boolean) as SchemaEntity[];
  const m = typeof e.fieldCount === 'number' ? e.fieldCount : null;
  // "N of M" — M is the owning table's LIVE field count (removed fields excluded), so a view
  // panel can never claim a bigger number than the table panel it belongs to.
  const counter = ` <span class="ep-sec-nm">· ${fields.length}${m !== null ? ` of ${m}` : ''}</span>`;
  const chips = fields.map((f) => entityChip({
    name: f.name,
    icon: epFieldIcon(f.fieldType),
    clickable: true,
    attrs: `data-ep-push="${esc(f.id)}"`,
  }));
  return epSection(view, `Fields shown${counter}`, null, epChipBox(chips));
}

// B8 — grouped "Referenced by": every place that points at THIS entity, grouped by kind
// (Automations · Interfaces & pages · Views · Formulas · Rollups · Lookups · Chats), each a
// labelled sub-list with the kind's concept icon + a capped (5) row list. Empty groups are
// omitted. Sources: automations/interfaces from the tag map; formulas/rollups/lookups from the
// inverted reference graph (epFieldReferencers); chats from the chat map.
// Every row is click-through (reuses the host's data-ep-*/data-ep-doc handlers; chats add
// data-ep-chat → jump to the Chat tab).
function epRenderReferencedBy(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  const tagRefs = ctx.refsFor(e.id);
  const autos = tagRefs.filter((r) => r.kind === 'automation');
  const ifaces = tagRefs.filter((r) => r.kind !== 'automation');
  const referencers = epFieldReferencers(e, ctx.index);
  const formulas = referencers.filter((t) => t.fieldType === 'formula');
  const rollups = referencers.filter((t) => t.fieldType === 'rollup');
  const lookups = referencers.filter((t) => t.fieldType === 'lookup');
  const chatRefs = ctx.chatRefsFor(e.id);
  // view-schema-details, the reverse direction: which VIEWS display this field. Answers "if I
  // restore or rename this field, where does it show up?". Only grid views on a full-access
  // connection carry visibleFieldIds, so an empty result means UNKNOWN, not "nowhere" — which is
  // exactly why the group must be omitted rather than rendered as "Views 0" (the shared
  // .filter((g) => g[2].length) below does that for every group here). Deleted views are
  // history and are left out, as they are everywhere else by default.
  const showingViews = e.kind === 'field'
    ? ctx.index.filter((v) => v.kind === 'view' && !v.removed && (v.visibleFieldIds || []).includes(e.id))
    : [];

  const tagRow = (r: EntityTagRef, icon: string) =>
    `<button type="button" class="ep-row" ${r.kind === 'automation' ? 'data-ep-ref-auto' : 'data-ep-ref-iface'}="${esc(r.id)}"><span class="ep-row-ic"><span class="iconify ${icon} size-3.5"></span></span><span class="ep-row-name">${esc(r.name)}</span><span class="iconify lucide--arrow-up-right size-3.5 ep-row-chev"></span></button>`;
  const chatRow = (c: { id: string; title: string }) =>
    `<button type="button" class="ep-row" data-ep-chat="${esc(c.id)}"><span class="ep-row-ic"><span class="iconify lucide--messages-square size-3.5"></span></span><span class="ep-row-name">${esc(c.title)}</span><span class="iconify lucide--arrow-up-right size-3.5 ep-row-chev"></span></button>`;

  const groups: [string, string, string[]][] = [
    ['lucide--zap', 'Automations', autos.map((r) => tagRow(r, 'lucide--zap'))],
    ['lucide--layout-panel-left', 'Interfaces & pages', ifaces.map((r) => tagRow(r, 'lucide--layout-panel-left'))],
    ['lucide--eye', 'Views', showingViews.map((v) => entityRow(v, ctx))],
    ['lucide--variable', 'Formulas', formulas.map((t) => entityRow(t, ctx))],
    ['lucide--sigma', 'Rollups', rollups.map((t) => entityRow(t, ctx))],
    ['lucide--search', 'Lookups', lookups.map((t) => entityRow(t, ctx))],
    // Docs are NOT a group here — they live in the dedicated Documentation section (avoids
    // showing the same doc twice on one panel). Referenced-by = automations/pages/computed/chats.
    ['lucide--messages-square', 'Chats', chatRefs.map(chatRow)],
  ];
  const total = groups.reduce((n, g) => n + g[2].length, 0);
  if (!total) return '';
  const inner = groups
    .filter((g) => g[2].length)
    .map(([ic, label, rows]) => `<div class="ep-refgrp"><div class="ep-refgrp-h"><span class="iconify ${ic} size-3.5 ep-refgrp-ic" aria-hidden="true"></span>${label}${rows.length > 1 ? `<span class="badge badge-sm badge-neutral ep-refgrp-n">${rows.length}</span>` : ''}</div>${epCapRows(rows)}</div>`)
    .join('');
  return epSection(view, 'Referenced by', total, inner);
}

// A4 — formula / lookup configuration block, resolved against the index.
function epRenderConfig(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  const parts: string[] = [];
  if (e.formula) {
    const refs = (e.referencedFieldIds || []).map((id) => ctx.byId(id)).filter(Boolean) as SchemaEntity[];
    parts.push(`<div class="ep-cfg-k">Formula</div><pre class="ep-code">${esc(e.formula)}</pre>`);
    if (refs.length) parts.push(`<div class="ep-cfg-k">References ${refs.length}</div>${epCapRows(refs.map((r) => entityRow(r, ctx)))}`);
  }
  if (e.lookupViaFieldId) {
    const via = ctx.byId(e.lookupViaFieldId);
    const target = e.lookupTargetFieldId ? ctx.byId(e.lookupTargetFieldId) : undefined;
    const tName = target?.tableName || via?.linkedTableName || 'the linked table';
    parts.push(`<div class="ep-cfg-k">${e.fieldType === 'rollup' ? 'Rolls up' : 'Looks up'}</div>`);
    if (target) parts.push(`<div class="ep-rows">${entityRow(target, ctx)}</div>`);
    parts.push(`<p class="ep-empty-note">in <strong>${esc(tName)}</strong>${via ? `, via <button type="button" class="ep-link" data-ep-push="${via.id}">${esc(via.name)}</button>` : ''}.</p>`);
  }
  return parts.length ? epSection(view, 'Configuration', null, parts.join('')) : '';
}

/**
 * The schema-entity panel body: space · base · table · field · view.
 * Pure — same inputs, same string, no DOM, no stack, no state of its own.
 * Side effect by contract: it clears and refills `view.sections` in render order.
 */
export function entityReadBody(e: SchemaEntity, ctx: EntityBodyCtx, view: EntityViewState): string {
  view.sections.length = 0;
  // NOTE the shape: this used to FALL THROUGH to 'Table' for any unhandled kind, so a view
  // panel would have confidently labelled itself "Table". Every kind is now named explicitly
  // and the fallback is the kind string itself — a wrong-but-honest label beats a confident
  // lie. A view reads "View · Grid" (view-schema-details).
  const kindWord = e.kind === 'field' ? fieldTypeLabel(e.fieldType)
    : e.kind === 'view' ? `View · ${viewTypeLabel(e.viewType)}`
    : e.kind === 'base' ? 'Base'
    : e.kind === 'space' ? 'Space'
    : e.kind === 'table' ? 'Table'
    : String(e.kind);

  // Drawer canon v2: the icon + name render in the HEADER (the host's renderCrumbs). The body
  // opens with the identity meta line only (kind · health · freshness).
  let html = `<div class="ep-title-meta ep-body-meta"><span class="ep-meta-kind">${esc(kindWord)}</span>${!e.removed ? ` <span class="ep-meta-sep" aria-hidden="true">·</span> <span class="ep-meta-health">${epDot(e.health)}${esc(epHealthLabel(e.health))}</span> <span class="ep-meta-sep" aria-hidden="true">·</span> <span class="ep-meta-fresh">as of last backup</span>` : ''}</div>`;

  // #11 View in Airtable lives as a header corner icon (host renderCrumbs) — not welded to the body.

  // deleted-items-filter: a removed entity is read-only history — say so up front.
  if (e.removed) {
    // The banner needs a bare NOUN, not the meta line's "View · Grid" — kindWord.toLowerCase()
    // would have produced "This view · grid no longer exists…".
    const kindNoun = e.kind === 'view' ? 'view' : kindWord.toLowerCase();
    html += `<div class="alert alert-soft alert-warning ep-removed" role="status"><span class="iconify lucide--trash-2 size-4" aria-hidden="true"></span><span>This ${esc(kindNoun)} no longer exists in Airtable${e.removedAt ? ` (deleted ${esc(fmtDay(e.removedAt))})` : ''}. Showing the last backup.</span></div>`;
  }

  // view-schema-details: the capture returned this view but not its owning table. Soft INFO,
  // never amber — amber is this app's Removed voice, and this is a gap in OUR read, not a
  // defect in the user's base. Named here as well as in Browse so the panel is self-explaining
  // when it is opened from search rather than from the tree.
  if (e.kind === 'view' && e.tableUnresolved) {
    html += `<div class="alert alert-soft alert-info ep-removed" role="status"><span class="iconify lucide--help-circle size-4" aria-hidden="true"></span><span>We captured this view but not which table it belongs to, so it isn’t nested under one.</span></div>`;
  }

  // Metric tiles — the bordered strip + dashed dividers, matching the Home KPI tiles
  // (each tile = label + icon on top · big value · sub-label). Icons are written as
  // literals so their masks are generated (the panel renders via innerHTML at runtime).
  const statTile = (k: string, icon: string, value: string, sub: string) =>
    `<div class="ep-stat"><div class="ep-stat-top"><span class="ep-stat-k">${k}</span><span class="iconify ${icon} ep-stat-ic" aria-hidden="true"></span></div><span class="ep-stat-v">${value}</span><span class="ep-stat-sub">${sub}</span></div>`;
  const stats: string[] = [];
  if (typeof e.recordCount === 'number') stats.push(statTile('Records', 'lucide--rows-3', e.recordCount.toLocaleString(), 'as of last backup'));
  // A VIEW carries fieldCount only as the "N of M" DENOMINATOR for its Fields-shown block — it
  // is the owning table's number. Rendered as a tile here it read "Fields 12 · in this table",
  // which on a view panel is taken as "this view shows 12 fields": a claim we cannot make for a
  // grid view and never can for any other type. The view's honest answer is epRenderViewFields().
  if (typeof e.fieldCount === 'number' && e.kind !== 'view') stats.push(statTile('Fields', 'lucide--columns-3', String(e.fieldCount), e.kind === 'base' ? 'across all tables' : 'in this table'));
  // Health is NOT a tile any more — it's an inline chip in the identity meta line above (label +
  // heart-icon + status was 3× redundant and a lone Health tile ballooned to a full-width card).
  if (stats.length) html += `<div class="ep-stats" style="--ep-stat-n:${stats.length}">${stats.join('')}</div>`;

  // Descriptions (table + field only — base/space have none).
  if (e.kind === 'table' || e.kind === 'field') html += epRenderDescriptions(e, ctx, view);

  // A4 — field-type configuration (formula / lookup).
  if (e.kind === 'field') html += epRenderConfig(e, ctx, view);

  // view-schema-details — which fields this view displays (or which silence we are in).
  if (e.kind === 'view') html += epRenderViewFields(e, ctx, view);

  // Children.
  const children = (e.childIds || []).map((id) => ctx.byId(id)).filter(Boolean) as SchemaEntity[];
  if (children.length) {
    const title = e.kind === 'space' ? 'Bases' : e.kind === 'base' ? 'Tables' : 'Fields';
    // A3 — filter within a long child list (tables with many fields / bases with many tables).
    const filter = children.length > 7
      ? `<input type="text" class="input input-sm ep-filter" data-ep-filter placeholder="Filter ${title.toLowerCase()}…" aria-label="Filter ${title.toLowerCase()}" />`
      : '';
    html += epSection(view, title, children.length, `${filter}<div class="ep-rows" data-ep-rows>${children.map((c) => entityRow(c, ctx)).join('')}</div>`);
  }
  if (e.kind === 'field' && e.options && e.options.length) {
    html += epSection(view, 'Options', e.options.length, `<div class="ep-options">${e.options.map((o) => `<span class="badge badge-sm badge-ghost">${esc(o)}</span>`).join('')}</div>`);
  }

  // Relationships.
  // B3 — back-references: the fields that point AT this field (formula / rollup / lookup),
  // computed by inverting the forward graph. Rendered as rows with a "← REFERENCED BY"
  // direction marker (mirrors the table-level LINKS TO / LINKED FROM language); the row's own
  // type text (Formula / Rollup / Lookup) is the type indicator. Forward config is untouched.
  const backRefRows = e.kind === 'field' ? epFieldReferencers(e, ctx.index).map((t) => entityRow(t, ctx, '← referenced by')) : [];
  const backRefBlock = backRefRows.length
    ? `<div class="ep-rel-back"><div class="ep-cfg-k">Referenced by ${backRefRows.length}</div>${epCapRows(backRefRows)}</div>`
    : '';
  const linked = e.linkedTableId ? ctx.byId(e.linkedTableId) : undefined;
  if (e.kind === 'field' && e.linkedTableId && linked) {
    // A6 — linked table + cardinality (Hasura object/array semantics, not crow's-foot) + the backlink field.
    // One labelled meta (like the Backlink section below) — a single soft badge that
    // carries both the notation and its plain meaning, never a badge + loose text.
    const card = e.allowsMultiple === false ? '1:1 · links to a single record' : '1:many · allows multiple records';
    let inner = `<div class="ep-rows">${entityRow(linked, ctx, 'links to')}</div>`;
    inner += `<div class="ep-cfg-k">Cardinality</div><span class="badge badge-sm badge-soft badge-primary ep-rel-card">${card}</span>`;
    const inverse = e.inverseFieldId ? ctx.byId(e.inverseFieldId) : undefined;
    if (inverse) inner += `<div class="ep-rel-back"><div class="ep-cfg-k">Backlink</div><div class="ep-rows">${entityRow(inverse, ctx, 'in ' + esc(inverse.tableName || ''))}</div></div>`;
    inner += backRefBlock;
    html += epSection(view, 'Relationships', null, inner);
  } else if (e.kind === 'field' && e.derivedFrom) {
    html += epSection(view, 'Derived from', null, `<p class="ep-empty-note">Computed from <strong>${esc(e.derivedFrom)}</strong>.</p>`);
    if (backRefBlock) html += epSection(view, 'Relationships', backRefRows.length, backRefBlock);
  } else if (e.kind === 'field' && backRefBlock) {
    // A plain field (no outgoing link) that other fields reference — its Relationships section
    // is the back-references alone (e.g. Amount ← Weighted Value / Pipeline Value).
    html += epSection(view, 'Relationships', backRefRows.length, backRefBlock);
  } else if (e.kind === 'table') {
    const rel = tableRelationships(e, ctx.index);
    const out = rel.outgoing.map((r) => { const t = ctx.byId(r.tableId); return t ? entityRow(t, ctx, 'links to') : ''; }).join('');
    const inc = rel.incoming
      .filter((r, i, a) => a.findIndex((x) => x.tableId === r.tableId) === i)
      .map((r) => { const t = ctx.byId(r.tableId); return t ? entityRow(t, ctx, 'linked from') : ''; }).join('');
    if (out || inc)
      html += epSection(view, 'Relationships', rel.outgoing.length + rel.incoming.length, `<div class="ep-rows">${out}${inc}</div>`);
  }

  // C4 — this entity's change history.
  html += epRenderChangelogSection(e, ctx, view);

  // Documentation (reverse tagging).
  html += epRenderDocsSection(e, ctx, view);
  // Referenced by (automations / interfaces that tag this entity).
  html += epRenderReferencedBy(e, ctx, view);

  // The progressive section-nav is NOT in the body — the host renders it into the fixed HEADER
  // from the SAME `view.sections` collected while building these sections.
  return html;
}
