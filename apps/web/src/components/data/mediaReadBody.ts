/**
 * mediaReadBody — the shared ASSET-detail BODY (preview · actions · File metadata · Where it is
 * attached), extracted from MediaPanel.astro (2026-08-03, Stage 3) so any stacking-panel host can
 * render an asset, not just the `.mp-*` drawer that happened to own the closure.
 *
 * Same relationship `recordReadBody.ts` has to RecordPanel and `entityReadBody` (schemaReadBody.ts)
 * has to the Schema EntityPanel: a pure `(entity, ctx) => string`, referencing no host's
 * `createPanelStack` instance and owning no state. A host can only render a KIND whose body is a
 * module — that is the whole reason this file exists.
 *
 * ── The separation this extraction had to make ────────────────────────────────────────────────
 * The original `renderBody(r)` was already pure, but its only caller (`renderAssetView`) wrote the
 * header CRUMBS and the header ICON straight onto the panel in the same breath, so "the asset body"
 * in practice meant "body + two pieces of chrome". Crumbs and the header glyph belong to the SHARED
 * chrome — every kind has them, and a host that owns one chrome for eight kinds cannot have one kind
 * smuggling its own header assignment through a body string. They are therefore exported here as
 * separate CHROME builders (`assetCrumbs`, `ASSET_HEAD_ICON`) that a host assigns into its own
 * header slots. `mediaReadBody` returns the body and nothing but the body.
 *
 * ── Why there is no `view` third parameter ────────────────────────────────────────────────────
 * `recordReadBody`/`entityReadBody` take `(entity, ctx, view)` because their bodies have per-panel
 * transient state (asOf pin, field query, active linked tab / open description editor). The asset
 * body has NONE: nothing in it toggles, filters or pages. A placeholder `view` object would be
 * scaffolding that lies about what the body does, so the signature stops at two.
 *
 * ── Why the ROW is the model ──────────────────────────────────────────────────────────────────
 * The panel reads its content off the Attachments listing row's dataset rather than a second JSON
 * snapshot of the assets, so the listing, the gallery and the panel are three projections of ONE
 * server-rendered set and the 10,000-asset volume fixture never ships the same objects twice. This
 * module therefore takes the row's `dataset` — plain data, not an `HTMLElement`: a string builder
 * must not be handed the DOM.
 */

import { fmtDay } from '../../lib/time';
import { locationCrumbs, type CrumbSeg } from '../schema/locationCrumbs';
import { entityIconMarkup } from '../schema/entityIcon';
import { mediaThumbHtml, attGlyph, KIND_LABEL, KIND_ICON, mediaKind } from './mediaFormat';

export const esc = (s: string) => (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** Day precision WITH the year — a capture date is compared across months, unlike a record's history. */

/**
 * The file's ONE source (founder, 2026-08-03) — base ▸ table ▸ (field) ▸ record. `b/t/f/r` are the
 * NAMES, `bi/ti/fi/ri` the ids behind them, because every segment is navigable. `f`/`fi` are
 * ABSENT for a comment attachment: Airtable's comment payload carries no field id, so the field
 * segment is not rendered rather than rendered as a placeholder.
 *
 * There is no `+N`, no "attached in N places" and no dedup note, because an attachment id lives in
 * exactly one place.
 */
export type Src = { b: string; t: string; f?: string; r: string; u: string; bi: string; ti: string; fi?: string; ri: string };

/** The Attachments listing row's dataset, which IS the asset model (see the file header). */
export interface AssetRowData {
  id?: string;
  name?: string;
  type?: string;
  thumb?: string;
  /** JSON-encoded `Src`, or absent when the capture recorded no source. */
  src?: string;
  /** Present when Baseout holds its own copy of the bytes (gates the Download button). */
  baseout?: string;
  /** A BYOS Space's destination name (gates "Open in {provider}"). */
  provider?: string;
  sizetext?: string;
  dims?: string;
  storelabel?: string;
  sourcelabel?: string;
  date?: string;
  lastseen?: string;
}

/** Everything a host must resolve so the body can render without touching its own stack. */
export interface MediaBodyCtx {
  /** The Space's latest capture timestamp — a file last seen before it is no longer attached. */
  syncedAt: string;
  /** Can the host open this record at all? A crumb that cannot open must not look like it can. */
  hasRecord: (id: string) => boolean;
}

export const parseSrc = (raw?: string): Src | null => { try { return JSON.parse(raw || 'null'); } catch { return null; } };

// ── CHROME builders (header slots — NOT part of the body string) ──────────────────────────────

/** The header glyph for an asset panel. Chrome: the host assigns it into its own header icon slot. */
export const ASSET_HEAD_ICON = '<span class="iconify lucide--paperclip concept-ic-asset size-4"></span>';

/**
 * The header CRUMBS for an asset — the file's ANCESTORS (base ▸ table), asking the HOST to open that
 * entity. Chrome, assigned by the host into its crumb row.
 *
 * `data-mp-openentity`, NOT `data-entity-open`. The latter is answered by a DOCUMENT-LEVEL delegate
 * inside the Schema EntityPanel, so every crumb emitted here raised that OTHER drawer's stack on top
 * of the one the file is open in — two `position: fixed` sheets, two rails, two ＋ buttons. The host
 * prefix keeps the destination the host's decision, which is the same rule the record segment below
 * has always followed (`data-mp-openrec`). It costs the caller nothing: the host opens the FULL
 * entity panel (`makeEntityPanel` over the same `.ep-sheet`) in its own stack.
 *
 * The field and the record deliberately do NOT appear here: they live in the body's source row,
 * where they belong next to the Airtable link. Repeating four levels in a 480px header would
 * truncate all four to nothing.
 */
export function assetCrumbs(src: Src | null): string {
  if (!src) return '';
  return locationCrumbs([
    { name: src.b, icon: entityIconMarkup('base', { size: 'size-3.5' }), openAttrs: `data-mp-openentity="${esc(src.bi)}"` },
    { name: src.t, icon: entityIconMarkup('table', { size: 'size-3.5' }), openAttrs: `data-mp-openentity="${esc(src.ti)}"` },
  ]);
}

// ── The body ──────────────────────────────────────────────────────────────────────────────────

export function mediaReadBody(a: AssetRowData, ctx: MediaBodyCtx): string {
  const kind = mediaKind({ filename: a.name, type: a.type });
  const src = parseSrc(a.src);

  // Preview. Same rule as the grid: OUR stored copy or nothing — never an Airtable URL, which
  // expires in ~2 hours. The absent case is a stated FACT about the file, not a failed page.
  const preview = a.thumb
    ? `<div class="mp-preview">${mediaThumbHtml({ id: a.id!, filename: a.name, type: a.type, thumbUrl: a.thumb }, { size: 'lg', tip: false })}</div>`
    : `<div class="mp-preview mp-preview-none"><span class="iconify ${attGlyph({ filename: a.name, type: a.type })} mp-preview-gl" aria-hidden="true"></span><p class="mp-preview-note">No preview available</p></div>`;

  // Actions. Download exists only when we hold the bytes; there is no disabled placeholder.
  const acts: string[] = [];
  if (a.baseout) acts.push(`<button type="button" class="btn btn-sm btn-primary gap-1.5" data-mp-download><span class="iconify lucide--download size-4" aria-hidden="true"></span>Download</button>`);
  if (a.provider) acts.push(`<button type="button" class="btn btn-sm btn-soft btn-primary gap-1.5" data-mp-openprovider><span class="iconify lucide--external-link size-4" aria-hidden="true"></span>Open in ${esc(a.provider)}</button>`);
  // RECORD-LEVEL, and verified as such (2026-08-03). Airtable's own documentation describes
  // record-level linking (a base URL composed with RECORD_ID()) and documents NO per-attachment
  // deep link — the only attachment-level URLs it documents are the temporary
  // airtableusercontent.com ones, which expire ~2h and which this product must never link to.
  // So the copy says "View in Airtable" and means the record. Do not invent a URL shape.
  if (src?.u) acts.push(`<a class="btn btn-sm btn-ghost gap-1.5" href="${esc(src.u)}" target="_blank" rel="noopener"><span class="iconify lucide--external-link size-4" aria-hidden="true"></span>View in Airtable</a>`);
  const actions = acts.length ? `<div class="mp-actions">${acts.join('')}</div>` : '';

  // A file whose last capture predates the Space's latest one is no longer in the source. The
  // catalog warning Alert says so — never a hand-rolled grey box.
  // Where the surviving copy lives depends on the Space, so the reassurance must be conditional.
  // Saying "Baseout still holds the copy" on a BYOS asset is the same lie as the dedup note was:
  // the bytes went to the customer's own destination and we hold none of them.
  const kept = a.baseout
    ? ' Baseout still holds the copy it captured.'
    : a.provider
      ? ` The copy written to ${esc(a.provider)} at capture time is unaffected.`
      : '';
  const gone = ctx.syncedAt && a.lastseen && a.lastseen < ctx.syncedAt
    ? `<div class="alert alert-soft alert-warning mp-gone" role="status"><span class="iconify lucide--trash-2 size-4" aria-hidden="true"></span><span>This file is no longer attached in Airtable (last seen in the ${esc(fmtDay(a.lastseen))} capture).${kept}</span></div>`
    : '';

  // Metadata. A row is OMITTED rather than printed as "Unknown" — an empty value teaches people
  // the panel is unreliable, a missing row teaches them nothing at all, which is correct here.
  const tile = (k: string, icon: string, v: string, sub: string) =>
    `<div class="ep-stat"><div class="ep-stat-top"><span class="ep-stat-k">${esc(k)}</span><span class="iconify ${icon} ep-stat-ic" aria-hidden="true"></span></div><span class="ep-stat-v">${esc(v)}</span><span class="ep-stat-sub">${esc(sub)}</span></div>`;
  // "Type", matching the listing column and the toolbar facet — one word for one concept.
  // The tile's glyph is the CATEGORY icon (the same five the column and the facet use), not
  // the format glyph: the format is already on the preview a few pixels above.
  const tiles: string[] = [tile('Type', KIND_ICON[kind], KIND_LABEL[kind], a.type || 'type not recorded')];
  if (a.sizetext) tiles.push(tile('Size', 'lucide--hard-drive', a.sizetext, 'as captured'));
  if (a.dims) tiles.push(tile('Dimensions', 'lucide--ruler', a.dims, 'pixels'));
  const stats = `<div class="ep-stats" style="--ep-stat-n:${tiles.length}">${tiles.join('')}</div>`;

  const rows: string[] = [];
  rows.push(`<div class="mp-row"><span class="mp-row-k">Storage</span><span class="mp-row-v">${esc(a.storelabel || '—')}</span></div>`);
  rows.push(`<div class="mp-row"><span class="mp-row-k">Source</span><span class="mp-row-v">${esc(a.sourcelabel || '')} attachment</span></div>`);
  // D09 item 8 — the word qualifies itself. This is when BASEOUT took the file into a backup,
  // which is the only date that exists: Airtable's attachment payload carries no timestamp of
  // its own, so an unqualified "Captured" reads as the file's age and there is nothing behind
  // that reading. The note says so once, here, rather than on every row of the listing.
  if (a.date) rows.push(`<div class="mp-row"><span class="mp-row-k">Captured by Baseout</span><span class="mp-row-v">${esc(fmtDay(a.date))}</span></div>`);
  if (a.date) rows.push(`<div class="mp-note">Airtable records no date of its own for an attachment, so this is when the file entered a Baseout backup — not when it was added in Airtable.</div>`);
  if (a.lastseen) rows.push(`<div class="mp-row"><span class="mp-row-k">Last seen</span><span class="mp-row-v">${esc(fmtDay(a.lastseen))}</span></div>`);
  const meta = `<div class="mp-sec"><div class="mp-seclabel"><span class="iconify lucide--info size-3.5" aria-hidden="true"></span>File</div>${stats}<div class="mp-rows">${rows.join('')}</div></div>`;

  // ── WHERE IT IS ATTACHED — the ONE source, in full ────────────────────────────────────────
  // The founder's correction (2026-08-03): *"the source of the attachment will always be in a
  // single table, field, and record"*. So there is one trail, no count, no "attached in N
  // places" and no dedup note. Four segments for a field attachment, three for a comment
  // attachment — a comment carries no field id in Airtable's payload, and the segment is then
  // ABSENT rather than a placeholder.
  //
  // EVERY SEGMENT IS NAVIGABLE, and every one of them asks the HOST:
  //  · base / table / field → `data-mp-openentity` (see `assetCrumbs` above for why this is NOT
  //    `data-entity-open`: that attribute has a document-level owner, so it can never be "routed by
  //    the host" — it always lands in the Schema drawer's stack).
  //  · record → `data-mp-openrec`, likewise routed by the host.
  // That the destination is one stack or another is the host's business, not the body's — which is
  // exactly what makes this body portable.
  // "Open in a new tab" is realised as OPEN-BESIDE (⌘/Ctrl-click, middle-click) — the app is one
  // page of panel stacks, and a browser tab would throw away the context being asked for.
  const srcRow = ((): string => {
    if (!src) return '<div class="mp-none">No source recorded for this file.</div>';
    const recOpenable = !!src.r && !!src.ri && ctx.hasRecord(src.ri);
    // EVERY segment degrades like the record does: an unresolved name renders in words and
    // stops being clickable, never falls back to the key. A base, table or field can leave the
    // backup schema exactly as a record can, and `fld…` on screen is the raw-identifier leak
    // the Comments work established a rule against.
    const seg = (name: string, kind: 'base' | 'table' | 'field', id: string, gone: string): CrumbSeg => ({
      name: name || gone,
      icon: entityIconMarkup(kind, { size: 'size-3.5' }),
      openAttrs: name ? `data-mp-openentity="${esc(id)}"` : undefined,
    });
    const segs: CrumbSeg[] = [
      seg(src.b, 'base', src.bi, 'Base not in this backup'),
      seg(src.t, 'table', src.ti, 'Table not in this backup'),
    ];
    // The field segment exists only for a field attachment.
    if (src.fi) segs.push(seg(src.f ?? '', 'field', src.fi, 'Field not in this backup'));
    segs.push({
      // No primary value → the record is not in this backup. Say that, never the key.
      name: src.r || 'Record not in this backup',
      icon: entityIconMarkup('record', { size: 'size-3.5' }),
      openAttrs: recOpenable ? `data-mp-openrec="${esc(src.ri)}"` : undefined,
    });
    const link = src.u
      ? `<a class="btn btn-sm btn-ghost btn-square mp-trail-go tooltip tooltip-left" href="${esc(src.u)}" target="_blank" rel="noopener" aria-label="Open this record in Airtable" data-tip="Open the record in Airtable"><span class="iconify lucide--external-link size-4" aria-hidden="true"></span></a>`
      : `<span class="mp-trail-gone tooltip tooltip-left" data-tip="This record is not in the current backup, so there is nothing to link to."><span class="iconify lucide--unlink size-3.5" aria-hidden="true"></span></span>`;
    return `<div class="mp-trail"><nav class="sb-crumb-row mp-trail-crumbs">${locationCrumbs(segs)}</nav>${link}</div>`;
  })();
  const prov = `<div class="mp-sec"><div class="mp-seclabel"><span class="iconify lucide--git-branch size-3.5" aria-hidden="true"></span>Where it is attached</div><div class="mp-trails">${srcRow}</div></div>`;

  return gone + preview + actions + meta + prov;
}
