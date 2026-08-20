/**
 * entityPanelController — the per-panel controller for the schema entity drawer.
 *
 * Extracted VERBATIM out of EntityPanel.astro's <script> (it was `makePanel()` there). It is a
 * CONTROLLER, not a body: unlike `recordReadBody` / `entityReadBody` (pure `(entity, ctx, view) =>
 * string` builders), it owns the visit stack (push / popTo), the internal-note edit buffer with
 * caret restoration, the panel edit mode, the borrowed tag picker and the
 * progressive section-nav — and it emits/handles the `data-ep-*` hooks that the read body only
 * EMITS. A host that mounted `entityReadBody` without this would render a live-looking description
 * editor and drill rows that do nothing.
 *
 * PER-PANEL STATE. `descStates`, `editIds` and `drafts` are created INSIDE the factory — one set
 * per panel instance, keyed per entity id. They must never be hoisted to module scope: two panels
 * showing the same entity each keep their own uncommitted text, and a module-level map would make
 * typing in one panel silently rewrite the other. No lint, typecheck or build can see that.
 *
 * The factory takes only its own root sheet + callbacks; it never touches the host's
 * `createPanelStack` instance, so any host (EntityPanel today) can instantiate it.
 */
import { locationCrumbs } from './locationCrumbs';
import type { SchemaEntity } from './schemaEntities';
import { automationReadBody, interfaceReadBody, readChangelogHtml, entityReadBody, entityKindIcon, esc,
  type EntityBodyCtx, type EntityViewState, type DescState } from './schemaReadBody';
import { pushEscape } from '../../lib/escapeStack';

type DocRef = { id: string; title: string };

// Per-panel factory (pattern-multi-panel-drawer). Each call wires ONE .ep-sheet into a fully
// independent panel (own stack, own description-edit state, own DOM). The HOST (the `entity:` kind in
// EntityPanel.astro) creates one per open panel and routes drills/close/back between them.
// opts.onDrill/onClose/onCloseAll/onExhaustedBack hand control back to the controller so a click
// in one panel can spawn/replace/close the other. Rendering + description logic are unchanged.
export type EntityPanelOpts = { role: 'anchor' | 'focus'; onDrill?: (id: string) => void; onOpenBeside: (id: string) => void; onClose: () => void; onCloseAll: () => void; onExhaustedBack: () => void };
export function makeEntityPanel(root: HTMLElement, opts: EntityPanelOpts) {
  let panelActive = false;
  // Master-detail: the id of the reference row (in THIS panel) whose child is open on the right — that
  // row is kept SELECTED (.ep-row-active) so the pair reads as parent → child. Re-applied every render.
  let activeChildId: string | null = null;

  const indexEl = document.querySelector('[data-ep-index]');
  const docsEl = document.querySelector('[data-ep-docs]');
  const aiEl = document.querySelector('[data-ep-ai]');
  const index: SchemaEntity[] = indexEl ? JSON.parse(indexEl.textContent || '[]') : [];
  const docs: DocRef[] = docsEl ? JSON.parse(docsEl.textContent || '[]') : [];
  type ClItem = { id: string; at: string; type: string; summary: string; before?: string; after?: string; entityId?: string; aiSummary?: string; warning?: string; where?: string };
  const clEl = document.querySelector('[data-ep-changelog]');
  const changelog: ClItem[] = clEl ? JSON.parse(clEl.textContent || '[]') : [];
  const clByEntity = new Map<string, ClItem[]>();
  changelog.forEach((c) => { if (c.entityId) { const a = clByEntity.get(c.entityId) || []; a.push(c); clByEntity.set(c.entityId, a); } });
  const aiState: string = aiEl ? JSON.parse(aiEl.textContent || '"ready"') : 'ready';
  const refsEl = document.querySelector('[data-ep-refs]');
  const refsByEntity: Record<string, { id: string; name: string; kind: 'automation' | 'interface' | 'page' }[]> = refsEl ? JSON.parse(refsEl.textContent || '{}') : {};
  const chatRefsEl = document.querySelector('[data-ep-chatrefs]');
  const chatRefsByEntity: Record<string, { id: string; title: string }[]> = chatRefsEl ? JSON.parse(chatRefsEl.textContent || '{}') : {};
  const byId = new Map(index.map((e) => [e.id, e]));
  // Space level: a synthetic top entity whose children are the bases, so a panel can drill
  // Space→Base→Table→Field. Panel-local only (NOT added to the shared index → Browse / typeahead /
  // other tabs stay untouched).
  const SPACE_ID = '__ep_space__';
  const spaceBases = index.filter((e) => e.kind === 'base');
  if (spaceBases.length) byId.set(SPACE_ID, { id: SPACE_ID, kind: 'space', name: 'Space', baseId: SPACE_ID, baseName: 'Space', health: 'green', hasDescription: false, childIds: spaceBases.map((b) => b.id) } as SchemaEntity);

  // Q4 — Automations & Interfaces open as ordinary stacking panels. Parse their objects and register
  // PANEL-LOCAL pseudo-entities in byId (kind 'automation'/'interface') so open/push/openBeside/rail all
  // work unchanged; renderBody branches on the kind to the shared read-body builder. Not added to the
  // shared index → Browse / typeahead / other tabs are untouched.
  type AutoObj = { id: string; name: string; baseId?: string; type?: 'interface' | 'page'; status?: string; parentId?: string; [k: string]: unknown };
  const autoEl = document.querySelector('[data-ep-automations]');
  const ifaceEl = document.querySelector('[data-ep-interfaces]');
  const autoList: AutoObj[] = autoEl ? JSON.parse(autoEl.textContent || '[]') : [];
  const ifaceList: AutoObj[] = ifaceEl ? JSON.parse(ifaceEl.textContent || '[]') : [];
  const autoById = new Map<string, AutoObj>(autoList.map((a) => [a.id, a]));
  const ifaceById = new Map<string, AutoObj>(ifaceList.map((i) => [i.id, i]));
  const baseName = (id?: string) => (id && byId.get(id)?.name) || 'No base';
  const addPseudo = (o: AutoObj, kind: 'automation' | 'interface') =>
    byId.set(o.id, { id: o.id, kind, name: o.name, baseId: o.baseId || '', baseName: baseName(o.baseId), health: 'green', hasDescription: false, childIds: [] } as unknown as SchemaEntity);
  autoList.forEach((a) => addPseudo(a, 'automation'));
  ifaceList.forEach((i) => addPseudo(i, 'interface'));
  // Resolver shared with the tab markup: a tagged entity's display info + the item's own changelog.
  const readCtx = {
    // fieldType is passed through so a field chip can carry that type's Airtable glyph.
    // It used to be dropped here, which made every chip render the generic tag icon —
    // silently, since nothing errors when an optional field goes missing.
    ent: (id: string) => { const e = byId.get(id); return e ? { name: e.name, kind: e.kind, tableName: e.tableName, fieldType: e.fieldType } : null; },
    // pattern-panel-edit-mode: ONE layout, two modes. The body builder reads this and swaps each
    // Baseout-owned value for its input in place; captured blocks ignore it entirely.
    get mode(): 'read' | 'edit' { const id = stack[stack.length - 1]; return id && editIds.has(id) ? 'edit' : 'read'; },
    baseLabel: baseName,
    changelogHtml: (id: string) => readChangelogHtml(autoById.has(id) ? 'au' : 'if', changelog as unknown as { entityId?: string; at: string; type: string; summary: string }[], id),
  };

  // B3/B8 — the REVERSE reference graph, inverted from the forward field config carried in
  // `index`. PRODUCTION / ENGINE NOTE: Airtable's meta API returns only the FORWARD config
  // (a formula's referenced fields, a lookup/rollup's target). The reverse edges ("what
  // references THIS field") are NOT returned — the engine must invert the graph across the
  // base. Here the mirror derives it client-side from the fixtures; do not hand-fake edges.

  const body = root.querySelector<HTMLElement>('[data-ep-body]')!;
  const crumbsEl = root.querySelector<HTMLElement>('[data-ep-crumbs]')!;
  const crumbRowEl = root.querySelector<HTMLElement>('[data-ep-crumbrow]')!;
  const viewatEl = root.querySelector<HTMLAnchorElement>('[data-ep-viewat]')!;
  const idChipEl = root.querySelector<HTMLElement>('[data-ep-idchip]')!;
  const backBtn = root.querySelector<HTMLElement>('[data-ep-back]')!;
  const headIcEl = root.querySelector<HTMLElement>('[data-ep-head-ic]')!;
  const headTitleEl = root.querySelector<HTMLElement>('[data-ep-head-title]')!;
  let stack: string[] = [];
  // Scroll-spy observer for the progressive section-nav; rebuilt on every body re-render.
  let secNavOff: (() => void) | null = null;

  // Descriptions — `descStates` is a per-entity overlay that survives re-renders. `airtable` is a
  // READ MIRROR of what the last backup captured (Baseout never writes to Airtable, so there is no
  // local-vs-remote pair to reconcile any more); `extended` is Baseout's own note and the only
  // half that can be edited here. `descEdit` is the single active edit buffer; `descTab` keeps the
  // active source tab across the innerHTML rebuilds that each action triggers.
  const descStates = new Map<string, DescState>();
  const descOf = (e: SchemaEntity): DescState => {
    let s = descStates.get(e.id);
    if (!s) {
      s = {
        airtable: e.airtableDescription ?? '',
        extended: e.userDescription ?? '',
      };
      descStates.set(e.id, s);
    }
    return s;
  };
  // ── Panel edit MODE (pattern-panel-edit-mode) ───────────────────────────────────────────────
  // Automation / interface panels have a read mode and an edit mode, and pressing Edit relayouts
  // nothing: the value in each slot becomes an input where it already sat. Nothing on those
  // objects syncs to Airtable (the API cannot export them), so every editable field here is
  // Baseout's own note — nothing here leaves the product, but Save is
  // still EXPLICIT: a mistimed blur must not silently rewrite a colleague's note.
  //
  // `editIds` is per ENTITY, not per panel: drilling away from a half-finished edit and coming
  // back restores it rather than silently discarding it. Inside the panel the only ways out are
  // Save (commit) and Read / Cancel / Escape (discard) — one rule, no hidden third state.
  const editIds = new Set<string>();
  // Uncommitted values, per entity id. The body renders `{...object, ...draft}` so a re-render
  // (tag added, subscriber removed) never loses what you typed.
  const drafts = new Map<string, Record<string, unknown>>();
  const curObj = (): AutoObj | null => { const id = stack[stack.length - 1]; return (id && (autoById.get(id) || ifaceById.get(id))) || null; };
  const draftOf = (id: string) => { let d = drafts.get(id); if (!d) { d = {}; drafts.set(id, d); } return d; };
  const draftObj = (o: AutoObj): AutoObj => (editIds.has(o.id) ? { ...o, ...(drafts.get(o.id) || {}) } : o);
  /** Pull every open input into the draft. MUST run before anything that re-renders or navigates. */
  function harvestEdit() {
    const id = stack[stack.length - 1];
    if (!id || !editIds.has(id)) return;
    const d = draftOf(id);
    body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-ep-f]').forEach((el) => {
      const f = el.dataset.epF!;
      d[f] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
    });
    // The NAME is edited in the panel title, which lives in the header — outside `body`.
    const nameIn = headTitleEl.querySelector<HTMLInputElement>('[data-ep-f="name"]');
    if (nameIn) d.name = nameIn.value;
  }
  /** Leave edit mode, discarding the draft (Read segment · Cancel · Escape all mean the same). */
  function exitEdit(id: string) { editIds.delete(id); drafts.delete(id); refresh(); renderCrumbs(); }
  let descEdit: { id: string; field: 'airtable' | 'extended' } | null = null;
  let descTab: 'airtable' | 'extended' = 'airtable';
  // True while the open editor's text came from Generate (drives the AI disclaimer slot).
  let descEditAi = false;
  // Caret offset to restore when entering edit by clicking the text, so the cursor lands where
  // you clicked rather than at the end. null ⇒ place the caret at the end.
  let descEditCaret: number | null = null;
  const descInput = () => body.querySelector<HTMLTextAreaElement>('[data-ep-desc-input]');
  const focusDescInput = () => { const ta = descInput(); if (ta) { ta.focus(); const n = ta.value.length; const pos = descEditCaret == null ? n : Math.min(Math.max(0, descEditCaret), n); try { ta.setSelectionRange(pos, pos); } catch {} descEditCaret = null; } };
  // Map a click point inside a read value to a character offset (for caret-at-click on edit).
  const caretOffsetAt = (zone: HTMLElement, x: number, y: number): number | null => {
    const valEl = zone.querySelector('.ep-desc-v'); if (!valEl) return null;
    const d = document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
    try {
      if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(x, y); if (r && valEl.contains(r.startContainer)) return r.startOffset; }
      else if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); if (p && valEl.contains(p.offsetNode)) return p.offset; }
    } catch {}
    return null;
  };
  // A11y: announce description state changes to screen readers, and restore keyboard
  // focus after an action re-renders the panel body (innerHTML swap drops focus).
  const liveEl = root.querySelector<HTMLElement>('[data-ep-live]');
  const announce = (m: string) => { if (liveEl) liveEl.textContent = m; };
  const focusDescEdit = (field: 'airtable' | 'extended') => body.querySelector<HTMLElement>(`[data-ep-desc-editzone="${field}"]`)?.focus();
  // (The panel-local success toast went with the write-back it confirmed: the only surviving
  // commit — Save on the Internal note — has always announced to the live region and never toasted.)
  // Autosave an in-progress edit before any navigation / close, so typed text is never lost.
  // The Airtable value is MIRRORED, never written (pattern-access-scope): no editzone, Generate or
  // Save is rendered for it, so a commit can only ever target the internal note. These two write
  // paths are therefore narrowed to 'extended' rather than left accepting a field they must never
  // receive — an unreachable branch that still knows how to overwrite the mirror is exactly how a
  // future caller resurrects a write-back that no gate would notice.
  const commitOpenEdit = () => {
    if (!descEdit || descEdit.field !== 'extended') return;
    const ta = descInput(); const st = descStates.get(descEdit.id);
    if (ta && st) st.extended = ta.value;
  };
  const commitField = (id: string, value: string) => {
    const e = byId.get(id); if (!e) return;
    descOf(e).extended = value;
  };

  // ── The BODY ──────────────────────────────────────────────────────────
  // The schema-entity body (space/base/table/field/view) lives in schemaReadBody.ts as the pure
  // `entityReadBody(entity, ctx, view)` — the shape recordReadBody.ts already proves works
  // host-agnostically (pattern-multi-panel-drawer: "a body is a pure (entity, ctx, view) => string
  // module; a private renderBody() closure inside a host is the anti-pattern").
  //
  // What stays HERE is exactly what the module must not own:
  //   · descStates / editIds / drafts — PER PANEL, keyed PER ENTITY (declared above). The body
  //     reads them through the two lookups below and the per-render snapshot; it never caches or
  //     owns them. Two panels can show the SAME entity and each keeps its own uncommitted text.
  //   · descEditCaret / focusDescInput / caretOffsetAt — DOM-side caret restoration.
  //   · the automation / interface branch below, the header, and every delegated click handler.
  const bodyCtx: EntityBodyCtx = {
    byId: (id) => byId.get(id),
    index,
    docs,
    changelogFor: (id) => clByEntity.get(id) || [],
    refsFor: (id) => refsByEntity[id] || [],
    chatRefsFor: (id) => chatRefsByEntity[id] || [],
    aiState,
    interfaceGlyph: (id) => (ifaceById.get(id)?.type === 'page' ? 'page' : 'interface'),
    // PER-PANEL, read-only from the body's side: `descOf` reads THIS panel's `descStates` map.
    // Not hoisted — two panels can show the same entity, each with its own uncommitted text.
    descOf,
  };
  // Sections in render order — refilled by entityReadBody on every render, read by renderSecNav,
  // so the chip strip can never drift from the body it labels.
  const secList: { slug: string; label: string }[] = [];
  /** A fresh snapshot of THIS panel's transient description state, for one render. */
  const viewState = (): EntityViewState => ({ descEdit, descTab, descEditAi, sections: secList });
  /** The header's icon (title row + crumbs) must be the same glyph the body's rows use. */
  const kindIcon = (e: SchemaEntity) => entityKindIcon(e, bodyCtx);

  function renderBody(e: SchemaEntity): string {
    secList.length = 0;
    // Q4 — automation / interface panels render the shared body in whichever MODE this entity is
    // in, merged with any uncommitted draft so a re-render never loses what is typed.
    if (e.kind === 'automation') { const a = autoById.get(e.id); return a ? automationReadBody(draftObj(a) as never, readCtx) : ''; }
    if (e.kind === 'interface') {
      const i = ifaceById.get(e.id);
      if (!i) return '';
      const pages = i.type === 'interface'
        ? ifaceList.filter((p) => p.type === 'page' && p.parentId === i.id && p.status !== 'removed').map((p) => ({ id: p.id, name: p.name }))
        : [];
      return interfaceReadBody({ ...(draftObj(i) as never), pages } as never, readCtx);
    }
    return entityReadBody(e, bodyCtx, viewState());
  }

  // Progressive section-nav: only worth a jump strip on a genuinely LONG panel — a large formula or a
  // long paragraph makes the body tall enough that scrolling is a chore. Gate on REAL scroll overflow
  // (measured post-render), not just the section count, so an ordinary few-section panel gets nothing.
  // Populates the header rail (above the border, part of the fixed header). Chips are legible pills
  // (muted label · primary-tinted active); the strip scrolls horizontally with a fade when it overflows.
  const secNavEl = root.querySelector<HTMLElement>('[data-ep-secnav-rail]')!;
  // "Long" is a CONTENT property, not a viewport one (rendered height is capped by the sheet + inner
  // scrolls, so it never overflows on a tall screen): show the jump-nav ONLY on a panel with a LARGE
  // formula or a LONG paragraph description — the cases that genuinely make the panel a chore to read.
  const isLongPanel = (e: SchemaEntity) => {
    const bigFormula = !!e.formula && (e.formula.length > 140 || (e.referencedFieldIds || []).length >= 8);
    const longDesc = [e.airtableDescription, e.userDescription, e.aiDescription, e.aiTechnicalDescription]
      .some((d) => (d || '').length > 400);
    return bigFormula || longDesc;
  };
  function renderSecNav(e: SchemaEntity) {
    const longEnough = secList.length >= 3 && isLongPanel(e);
    if (!longEnough) { secNavEl.innerHTML = ''; secNavEl.hidden = true; secNavEl.classList.remove('ep-secnav-scroll'); return; }
    secNavEl.innerHTML = secList
      .map((s) => `<button type="button" class="ep-secnav-chip" data-ep-secnav="ep-sec-${s.slug}">${esc(s.label)}</button>`)
      .join('');
    secNavEl.hidden = false;
    // Fade the edges only when the strip actually overflows (so it's clear it scrolls). Measured
    // after layout.
    requestAnimationFrame(() => secNavEl.classList.toggle('ep-secnav-scroll', secNavEl.scrollWidth > secNavEl.clientWidth + 1));
  }

  // Structural path of an entity: Base ▸ Table ▸ Field (base leads).
  function structuralPath(e: SchemaEntity): SchemaEntity[] {
    const out: SchemaEntity[] = [];
    const space = byId.get(SPACE_ID); if (space && e.kind !== 'space') out.push(space);
    const base = byId.get(e.baseId);
    if (base) out.push(base);
    if (e.kind === 'field') {
      const table = e.tableId ? byId.get(e.tableId) : undefined;
      if (table) out.push(table);
      out.push(e);
    } else if (e.kind === 'table' || e.kind === 'automation' || e.kind === 'interface') {
      out.push(e);
    }
    return out;
  }

  // Structural breadcrumb: base leads, the current entity is the bold tail, and
  // every ancestor is a navigational link. The drawer's own Back button (and Esc)
  // walks the visit history (stack) separately.
  function renderCrumbs() {
    const cur = byId.get(stack[stack.length - 1]);
    if (!cur) { crumbsEl.innerHTML = ''; crumbsEl.hidden = true; idChipEl.hidden = true; crumbRowEl.hidden = true; viewatEl.hidden = true; headIcEl.innerHTML = ''; headTitleEl.innerHTML = ''; backBtn.hidden = true; return; }
    // Drawer canon v2: the entity's icon + name live in the header title row; the crumbs
    // sub-row shows only its ANCESTORS (the current node is the header title, not a crumb).
    headIcEl.innerHTML = kindIcon(cur);
    // pattern-panel-edit-mode: the NAME is edited where it is read — in the panel title. Same
    // slot, same line; the input is sized to the title so the header row does not change height.
    // (The ID beside it stays a chip in every mode: it is the identity, not a field.)
    if (editIds.has(cur.id)) {
      const o = curObj();
      const nm = (o && (drafts.get(cur.id)?.name as string | undefined)) ?? cur.name;
      headTitleEl.innerHTML = `<input type="text" class="input input-sm ep-head-nameinput" data-ep-f="name" value="${esc(nm)}" aria-label="Name" />`;
    } else {
      headTitleEl.innerHTML = `<span class="ep-head-name">${esc(cur.name)}</span>${cur.isPrimary ? ' <span class="badge badge-sm badge-neutral">Primary</span>' : ''}`;
    }
    // "View … in Airtable" as a header corner icon (tooltip carries the specific label). Same gating and
    // deep-link scheme as the old body button; TODO(engine): backup ids → real Airtable app/tbl/fld ids.
    if (!cur.removed && (cur.kind === 'base' || cur.kind === 'table' || cur.kind === 'field')) {
      const parts = cur.kind === 'base' ? [cur.baseId] : cur.kind === 'table' ? [cur.baseId, cur.id] : [cur.baseId, cur.tableId || '', cur.id];
      viewatEl.href = 'https://airtable.com/' + parts.filter(Boolean).join('/');
      const lbl = `View ${cur.kind} in Airtable`;
      viewatEl.dataset.tip = lbl; viewatEl.setAttribute('aria-label', lbl); viewatEl.hidden = false;
    } else { viewatEl.hidden = true; }
    // Entity id + one-click copy, pulled to the right corner of the crumb row (tooltip-LEFT so the
    // bubble grows inward from the edge). Parity with the Data drawer.
    idChipEl.hidden = false;
    idChipEl.innerHTML = `<span class="ep-idlabel">ID</span><code class="ep-idval">${esc(cur.id)}</code><button type="button" class="ep-copyid tooltip tooltip-left" data-ep-copyid="${esc(cur.id)}" aria-label="Copy ${esc(cur.kind)} id" data-tip="Copy id"><span class="iconify lucide--copy size-3.5" aria-hidden="true"></span></button>`;
    const ancestors = structuralPath(cur).slice(0, -1);
    crumbsEl.hidden = ancestors.length === 0;
    crumbRowEl.hidden = false;
    crumbsEl.innerHTML = locationCrumbs(
      ancestors.map((p) => ({ name: p.name, icon: kindIcon(p), openAttrs: `data-ep-crumb-id="${p.id}"` })),
    );
    // Back appears only when there's somewhere to go back to WITHIN this panel (depth >= 2) — the
    // nav-stack convention (Navattic / Squarespace / Airtable detail panels show only Close at the
    // root, Back once you drill deeper). At depth 1 the × dismisses instead (onClose).
    backBtn.hidden = stack.length <= 1;
  }

  // Wire the progressive section-nav after each body re-render. Scroll-spy is POSITION-based (not an
  // IntersectionObserver): the active section is the LAST one whose top has scrolled past the body top,
  // AND when the body is scrolled to the bottom the LAST section always wins — so a short trailing
  // section (e.g. an empty "Documentation") that can never reach the top still activates when you jump
  // to it. Rebuilt every render (the body innerHTML is replaced on open / drill / refresh); the previous
  // scroll listener is removed first. Chip clicks are handled by the root delegate (below).
  function wireSecNav() {
    if (secNavOff) { secNavOff(); secNavOff = null; }
    const nav = secNavEl; // the section-nav lives in the fixed header (above the border), outside the body scroll
    if (nav.hidden || !nav.children.length) return;
    const chips = Array.from(nav.querySelectorAll<HTMLElement>('[data-ep-secnav]'));
    const secs = chips
      .map((c) => body.querySelector<HTMLElement>('#' + (c.dataset.epSecnav || '')))
      .filter((s): s is HTMLElement => !!s);
    if (!secs.length) return;
    const setActive = (id: string | null) => {
      chips.forEach((c) => {
        const active = c.dataset.epSecnav === id;
        c.classList.toggle('is-active', active);
        if (active) {
          // Keep the active chip visible when the strip has scrolled horizontally (nice-to-have).
          const cr = c.getBoundingClientRect(); const nr = nav.getBoundingClientRect();
          if (cr.left < nr.left || cr.right > nr.right) c.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
      });
    };
    // Position-based: the active section is the last one whose top has scrolled to/above the body top
    // (a small 12px tolerance). Purely from position, so it stays correct however tall the panel is.
    const computeActive = () => {
      const bodyTop = body.getBoundingClientRect().top;
      let activeId = secs[0].id;
      for (const s of secs) {
        if (s.getBoundingClientRect().top - bodyTop <= 12) activeId = s.id; else break;
      }
      setActive(activeId);
    };
    // A chip CLICK is authoritative: it activates that section and locks the spy briefly so the
    // smooth-scroll's own scroll events don't override it — this is what lets a SHORT trailing section
    // (which can never scroll to the top) stay active when you jump to it. After the scroll settles the
    // lock releases (without re-computing), so the next MANUAL scroll takes over normally.
    let raf = 0;
    let clickLock = false;
    let lockTimer = 0;
    const onScroll = () => { if (clickLock || raf) return; raf = requestAnimationFrame(() => { raf = 0; computeActive(); }); };
    const onClick = (ev: Event) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-ep-secnav]');
      if (!btn) return;
      const target = body.querySelector<HTMLElement>('#' + (btn.dataset.epSecnav || ''));
      if (!target) return;
      clickLock = true;
      setActive(btn.dataset.epSecnav || null);
      const delta = target.getBoundingClientRect().top - body.getBoundingClientRect().top;
      body.scrollTo({ top: body.scrollTop + delta - 8, behavior: 'smooth' });
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => { clickLock = false; }, 800);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    nav.addEventListener('click', onClick);
    secNavOff = () => {
      body.removeEventListener('scroll', onScroll);
      nav.removeEventListener('click', onClick);
      window.clearTimeout(lockTimer);
      if (raf) cancelAnimationFrame(raf);
    };
    computeActive();
  }

  // The shared tag picker (a real, wired EntitySearch parked in the page) is MOVED into this
  // panel's Touches section whenever this panel is in edit mode. Moving the live node keeps its
  // wiring across the innerHTML rebuilds the body does on every render; a copy would not.
  const tagPickerEl = document.querySelector<HTMLElement>('[data-ep-tagpicker-home] [data-entity-search]');
  const tagPickerHome = document.querySelector<HTMLElement>('[data-ep-tagpicker-home]');
  function mountTagPicker() {
    if (!tagPickerEl) return;
    const mount = body.querySelector<HTMLElement>('[data-ep-tagmount]');
    if (mount) { mount.appendChild(tagPickerEl); return; }
    // No slot in THIS body. Re-home the node only when it is ORPHANED (a re-render of whichever
    // panel held it destroyed the slot) — never steal it from a panel that is still editing.
    if (!tagPickerEl.isConnected && tagPickerHome) tagPickerHome.appendChild(tagPickerEl);
  }

  /**
   * Deep link from the Changelog TAB: the row names a change id, and the panel must arrive on THAT
   * change, not merely on its Changelog section — otherwise you click a dated row about invalid
   * values and land in a list where you have to find the same row again.
   *
   * Copied from RecordPanel's comment deep link (`pendingFocus` / `pendingComment` →
   * `[data-rp-comment]` → `scrollIntoView({block:'center'})` + a `.rp-cm-hit` class removed after
   * 2400ms): the highlight is a transient CUE, not a selection, because nothing here is selectable
   * and a permanent mark would read as state.
   *
   * Two things differ from RecordPanel and both are deliberate. (1) The mark is applied on a rAF as
   * well as at the end of render(), because the host only re-renders on SOME open paths — opening a
   * change on a panel that is already showing that entity runs no render at all (`panelStack.open`
   * reuse → `cfg.render` is a no-op for this kind), and that is precisely the "click the same change
   * twice" case. (2) It clears itself once applied, so a later ordinary re-render does not re-flash.
   */
  let pendingChange: string | null = null;
  let pendingChangeTimer = 0;
  function applyPendingChange() {
    if (!pendingChange) return;
    const target = body.querySelector<HTMLElement>(`[data-ep-cl-row="${CSS.escape(pendingChange)}"]`);
    if (!target) return; // this entity's section doesn't carry it — leave the panel where it opened
    pendingChange = null;
    target.scrollIntoView({ block: 'center' });
    body.querySelectorAll<HTMLElement>('.ep-cl-hit').forEach((n) => n.classList.remove('ep-cl-hit'));
    target.classList.add('ep-cl-hit');
    window.clearTimeout(pendingChangeTimer);
    pendingChangeTimer = window.setTimeout(() => target.classList.remove('ep-cl-hit'), 2400);
  }

  // ── The keyboard must survive a body re-render (D45 item 1, second order) ────────────────────
  //
  // `panelStack` closed the OPEN and CLOSE ends of the focus contract: opening a sheet moves focus
  // into it, Tab/Shift+Tab cycle within it, Escape hands the keyboard back to the row that opened
  // it. One level down, this file re-opened the same hole. Both re-renders below replace
  // `body.innerHTML` wholesale, so every focusable node the caret could be sitting on is destroyed
  // and `document.activeElement` falls back to `document.body`. panelStack's Tab containment only
  // engages while focus is INSIDE a panel — so the very next Tab restarts at the top of the
  // DOCUMENT and walks the listing this sheet is covering. In-panel Back (`popTo`), Escape out of
  // edit mode (`exitEdit`) and every `refresh()` reached it: the overlay went keyboard-invisible
  // again without ever closing.
  //
  // The fix is the weak, correct one, matching the non-modal contract: if the keyboard WAS in the
  // body before the swap, put it back on the SHEET afterwards. `focusPanel` already stamps
  // `tabindex="-1"` on this root, and sitting on the sheet is "before the first item" to the
  // containment handler, so the next Tab resumes at the top of THIS panel. Deliberately not a
  // specific control: which control is the right one differs per re-render, and every call site
  // that DOES know (the name input, the subscriber field, the tag field) focuses it after this runs
  // and simply wins.
  //
  // Guarded on "was it in the body", never unconditional. Clicking the page behind a non-modal
  // sheet is a real exit; a re-render that yanked the caret back would make the surface stickier
  // than a modal, which is the opposite of what `aria-modal="false"` promises.
  const kbWasInBody = () => { const a = document.activeElement; return !!a && body.contains(a); };
  function returnKbToSheet(was: boolean) {
    if (!was) return;
    const a = document.activeElement;
    if (a && body.contains(a)) return; // a call site already claimed a control — leave it there
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    // `preventScroll` for the same reason panelStack uses it: the sheet does its own scroll work
    // two lines below, and letting focus scroll as well fought it.
    try { root.focus({ preventScroll: true }); } catch { root.focus(); }
  }

  function render(swap = true) {
    const e = byId.get(stack[stack.length - 1]);
    if (!e) return;
    const heldKb = kbWasInBody();
    // Expose the current entity id + stack depth on the sheet so the controller / tests can read
    // which entity each panel holds and how deep its back-stack is, without reaching into JS state.
    root.dataset.epCur = e.id;
    root.dataset.epKind = e.kind;
    root.dataset.epDepth = String(stack.length);
    commitOpenEdit();
    descEdit = null; descTab = 'airtable'; descEditAi = false;
    body.innerHTML = renderBody(e);
    if (activeChildId) body.querySelector<HTMLElement>('[data-ep-push="' + activeChildId + '"]')?.classList.add('ep-row-active');
    renderCrumbs();
    mountTagPicker();
    renderSecNav(e);
    wireSecNav();
    if (swap) { body.classList.remove('ep-swap'); void body.offsetWidth; body.classList.add('ep-swap'); }
    body.scrollTop = 0;
    applyPendingChange();
    returnKbToSheet(heldKb);
  }
  // In-place re-render for description / edit-mode actions — no swap animation, keeps scroll.
  function refresh() {
    const e = byId.get(stack[stack.length - 1]);
    if (!e) return;
    const heldKb = kbWasInBody();
    const top = body.scrollTop;
    body.innerHTML = renderBody(e);
    if (activeChildId) body.querySelector<HTMLElement>('[data-ep-push="' + activeChildId + '"]')?.classList.add('ep-row-active');
    mountTagPicker();
    renderSecNav(e);
    wireSecNav();
    body.scrollTop = top;
    returnKbToSheet(heldKb);
  }

  // Leaving an entity while an edit is open KEEPS it (per-entity draft): drilling into a tagged
  // field to check something, then coming back, must not cost you the note you were writing.
  // Nothing is silently discarded, and nothing blocks the navigation with a confirm.
  async function hydrateDocsFor(id: string) {
    const spaceId =
      document.querySelector<HTMLElement>('[data-schema-docs]')?.dataset.spaceId ||
      document.querySelector<HTMLElement>('[data-ep-space]')?.dataset.epSpace;
    const ent = byId.get(id);
    if (!spaceId || !ent || ent.kind === 'space' || ent.kind === 'automation' || ent.kind === 'interface') return;
    const targetType = ent.kind;
    try {
      const res = await fetch(
        `/api/spaces/${encodeURIComponent(spaceId)}/docs-by-entity?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(id)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { documents?: { documentId: string; title: string }[] };
      const list = data.documents ?? [];
      for (const d of list) {
        if (!docs.some((x) => x.id === d.documentId)) docs.push({ id: d.documentId, title: d.title });
      }
      ent.docIds = list.map((d) => d.documentId);
      if (stack[stack.length - 1] === id) refresh();
    } catch {
      /* network — Documentation section stays empty */
    }
  }
  function open(id: string, resetStack = true) {
    if (!byId.has(id)) return;
    harvestEdit();
    if (resetStack || stack.length === 0) stack = [id];
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('ep-in'));
    render(true);
    void hydrateDocsFor(id);
  }
  function push(id: string) {
    if (!byId.has(id)) return;
    harvestEdit();
    // Miller rule: if this id is already deeper in the trail, jump to it; else append.
    const at = stack.indexOf(id);
    stack = at >= 0 ? stack.slice(0, at + 1) : [...stack, id];
    render(true);
    void hydrateDocsFor(id);
  }
  function popTo(i: number) { harvestEdit(); stack = stack.slice(0, i + 1); render(true); }
  function doClose(instant = false) {
    harvestEdit();
    commitOpenEdit();
    document.removeEventListener('keydown', onKeydown);
    root.classList.remove('ep-in');
    window.setTimeout(() => { root.hidden = true; stack = []; delete root.dataset.epCur; delete root.dataset.epDepth; }, instant ? 0 : 220);
  }

  // Per-panel click handling (scoped to THIS sheet). schema:openEntity + data-entity-open live on
  // the controller (they always target the anchor), so they are not wired here.
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    // Copy the entity id → clipboard, with a green check-pop then fade (parity with the Data drawer).
    const copyId = t.closest<HTMLElement>('[data-ep-copyid]');
    if (copyId) {
      ev.preventDefault(); ev.stopPropagation();
      navigator.clipboard?.writeText(copyId.dataset.epCopyid!);
      const ci = copyId.querySelector<HTMLElement>('.iconify');
      if (ci) { copyId.classList.add('ep-copied'); ci.className = 'iconify lucide--check size-3.5'; setTimeout(() => { copyId.classList.remove('ep-copied'); ci.className = 'iconify lucide--copy size-3.5'; }, 1100); }
      return;
    }
    // × / (former scrim) → the controller decides: × on focus closes just the focus, × on anchor
    // closes both.
    if (t.closest('[data-ep-close]')) { opts.onClose(); return; }
    // ── Panel Read/Edit mode (pattern-panel-edit-mode) ────────────────────────────────────────
    // The segmented switch in the identity line. Read is the default; Edit turns each Baseout-owned
    // value into an input where it already sat. Read/Cancel/Escape all mean the same thing —
    // leave edit mode, discard the draft — so there is no fourth, hidden state.
    const modeBtn = t.closest<HTMLElement>('[data-ep-mode]');
    if (modeBtn) {
      const o = curObj();
      if (!o) return;
      if (modeBtn.dataset.epMode === 'edit') {
        if (!editIds.has(o.id)) { editIds.add(o.id); refresh(); renderCrumbs(); headTitleEl.querySelector<HTMLInputElement>('[data-ep-f="name"]')?.focus(); }
      } else exitEdit(o.id);
      return;
    }
    if (t.closest('[data-ep-cancel]')) { const o = curObj(); if (o) exitEdit(o.id); return; }
    const saveBtn = t.closest<HTMLElement>('[data-ep-save]');
    if (saveBtn) {
      harvestEdit();
      const o = curObj();
      if (!o) return;
      const kind = saveBtn.dataset.epReadKind === 'interface' ? 'interface' : 'automation';
      const d = drafts.get(o.id) || {};
      // Empty text is ABSENCE, not an empty string — the read slot's empty state ("No internal
      // note yet.") only shows for undefined, and a stored "" would render as a blank section.
      for (const [k, v] of Object.entries(d)) o[k] = typeof v === 'string' && !v.trim() ? undefined : v;
      const pe = byId.get(o.id); if (pe && typeof o.name === 'string') pe.name = o.name;
      editIds.delete(o.id); drafts.delete(o.id);
      // The tab owns the listing row; it re-renders it from the saved record.
      document.dispatchEvent(new CustomEvent(kind === 'interface' ? 'schema:interfaceSaved' : 'schema:automationSaved', { detail: { rec: { ...o } } }));
      render(false); renderCrumbs();
      announce('Saved');
      return;
    }
    // Remove a MANUALLY tagged table/field from the Touches section (derived touches have no ×).
    const tagX = t.closest<HTMLElement>('[data-ep-tagx]');
    if (tagX) {
      const o = curObj();
      if (o && editIds.has(o.id)) {
        harvestEdit();
        const cur0 = (drafts.get(o.id)!.tags ?? o.tags ?? []) as { entityId: string; source?: string }[];
        drafts.get(o.id)!.tags = cur0.filter((x) => x.entityId !== tagX.dataset.epTagx);
        refresh();
      }
      return;
    }
    // Remove a subscriber chip.
    const subX = t.closest<HTMLElement>('[data-ep-subx]');
    if (subX) {
      const o = curObj();
      if (o && editIds.has(o.id)) {
        harvestEdit();
        const cur0 = (drafts.get(o.id)!.subscribers ?? o.subscribers ?? []) as string[];
        drafts.get(o.id)!.subscribers = cur0.filter((e) => e !== subX.dataset.epSubx);
        refresh();
      }
      return;
    }
    // Q4 — automation/interface panel footer: Delete soft-deletes on the tab and closes this panel.
    const readDel = t.closest<HTMLElement>('[data-ep-read-delete]');
    if (readDel) { const kind = readDel.dataset.epReadKind; opts.onClose(); document.dispatchEvent(new CustomEvent(kind === 'interface' ? 'schema:deleteInterface' : 'schema:deleteAutomation', { detail: { id: readDel.dataset.epReadDelete } })); return; }
    // Section-nav chip clicks are handled in wireSecNav (click-authoritative + scroll-spy lock).
    if (t.closest('[data-ep-secnav]')) return;
    // Back walks THIS panel's stack; once exhausted the controller decides (a focus panel closes
    // back to the single anchor; the anchor's Back button is hidden at stack length 1).
    if (t.closest('[data-ep-back]')) { if (stack.length > 1) popTo(stack.length - 2); else opts.onExhaustedBack(); return; }
    const crumb = t.closest<HTMLElement>('[data-ep-crumb-id]');
    if (crumb) { push(crumb.dataset.epCrumbId!); return; }
    // Independent-panels model: a plain reference click DRILLS IN PLACE within this panel;
    // The visible hover ⧉ "open beside" button (a sibling of the row) — same as ⌘/Ctrl-click.
    const besideEl = t.closest<HTMLElement>('[data-ep-beside]');
    if (besideEl) { opts.onOpenBeside(besideEl.dataset.epBeside!); return; }
    // ⌘/Ctrl-click opens that entity in a NEW panel beside (routed through the controller).
    const pushEl = t.closest<HTMLElement>('[data-ep-push]');
    if (pushEl) { if ((ev as MouseEvent).metaKey || (ev as MouseEvent).ctrlKey) opts.onOpenBeside(pushEl.dataset.epPush!); else push(pushEl.dataset.epPush!); return; }
    // Cross-tab handoffs leave the schema panels entirely → close BOTH, then dispatch.
    const docEl = t.closest<HTMLElement>('[data-ep-doc]');
    if (docEl) { opts.onCloseAll(); document.dispatchEvent(new CustomEvent('schema:openDoc', { detail: { id: docEl.dataset.epDoc } })); return; }
    // "Referenced by" → the automation / interface now opens as a stacking panel beside (Q4),
    // consistent with every other reference; no tab jump, no closeAll.
    const refAuto = t.closest<HTMLElement>('[data-ep-ref-auto]');
    if (refAuto) { opts.onOpenBeside(refAuto.dataset.epRefAuto!); return; }
    const refIface = t.closest<HTMLElement>('[data-ep-ref-iface]');
    if (refIface) { opts.onOpenBeside(refIface.dataset.epRefIface!); return; }
    // "Referenced by" → Chats: jump to the Chat tab and open that thread.
    const refChat = t.closest<HTMLElement>('[data-ep-chat]');
    if (refChat) { opts.onCloseAll(); document.querySelector<HTMLElement>('[data-tab="chat"]')?.click(); document.dispatchEvent(new CustomEvent('schema:openChat', { detail: { id: refChat.dataset.epChat } })); return; }

    // Switch description source tab (Airtable ↔ Internal). Commit any open edit first so
    // typed text isn't lost, then re-render the active panel (descTab persists the choice).
    const tabBtn = t.closest<HTMLElement>('[data-ep-desc-tab]');
    if (tabBtn) {
      const next = tabBtn.dataset.epDescTab as 'airtable' | 'extended';
      if (next !== descTab) { commitOpenEdit(); descEdit = null; descTab = next; refresh(); }
      return;
    }

    // — Descriptions (the Internal note only; the Airtable half is a read mirror) —
    const cur = () => byId.get(stack[stack.length - 1]);
    // Click the value box (read mode) to edit it in place — caret lands where you clicked.
    const zoneEl = t.closest<HTMLElement>('[data-ep-desc-editzone]');
    if (zoneEl) {
      const e = cur(); if (e) { const field = zoneEl.dataset.epDescEditzone as 'airtable' | 'extended'; descEditCaret = caretOffsetAt(zoneEl, ev.clientX, ev.clientY); descEditAi = false; descEdit = { id: e.id, field }; descTab = field; refresh(); focusDescInput(); }
      return;
    }
    const genEl = t.closest<HTMLElement>('[data-ep-desc-gen]');
    if (genEl) {
      const e = cur(); if (!e) return;
      const field = genEl.dataset.epDescGen as 'airtable' | 'extended';
      // Generate belongs to the Internal note ONLY — a generated Airtable description could never
      // be delivered. The more-technical draft falls back to the public text in this faked harness
      // when no distinct technical draft is seeded.
      const ai = e.aiTechnicalDescription || e.aiDescription || '';
      // Generate seeds the editor with AI text and flags it so the AI disclaimer shows.
      descEditAi = true; descEdit = { id: e.id, field }; descTab = field; refresh();
      const ta = descInput(); if (ta) { ta.value = ai; focusDescInput(); }
      return;
    }
    const saveEl = t.closest<HTMLElement>('[data-ep-desc-save]');
    if (saveEl) {
      const e = cur();
      if (e) {
        // Phase 13 Slice 1: no description_override write API yet (web-schema-round3-shell
        // deferred). Keep the note in the panel session so editing is not a silent no-op,
        // but do not claim it persisted.
        commitField(e.id, descInput()?.value ?? '');
        descEdit = null;
        descTab = 'extended';
        refresh();
        focusDescEdit('extended');
        announce('Kept on this page only — Internal notes don’t persist until the annotations API ships');
      }
      return;
    }
    if (t.closest('[data-ep-desc-cancel]')) { descEdit = null; refresh(); return; }
  });
  // Middle-click a reference row → open that entity in a new panel beside (browser-tab convention).
  root.addEventListener('auxclick', (ev) => {
    if ((ev as MouseEvent).button !== 1) return;
    const pushEl = (ev.target as HTMLElement).closest<HTMLElement>('[data-ep-push]');
    if (pushEl) { ev.preventDefault(); opts.onOpenBeside(pushEl.dataset.epPush!); }
  });
  // A3 — filter the rows of a long child list in place.
  root.addEventListener('input', (ev) => {
    const inp = (ev.target as HTMLElement).closest<HTMLInputElement>('[data-ep-filter]');
    if (!inp) return;
    const q = inp.value.trim().toLowerCase();
    const sec = inp.closest('.ep-sec');
    sec?.querySelectorAll<HTMLElement>('[data-ep-rows] .ep-row').forEach((r) => {
      const name = (r.querySelector('.ep-row-name')?.textContent || '').toLowerCase();
      r.style.display = !q || name.includes(q) ? '' : 'none';
    });
  });
  const onKeydown = (ev: KeyboardEvent) => {
    if (root.hidden) return;
    // D1 — route keys to the panel the user is actually IN: edit shortcuts (save / cancel / enter-edit)
    // act on whichever panel is being edited or holds keyboard focus, even if it's not the "active"
    // panel; only Esc-to-close/back is reserved for the active panel. stopImmediatePropagation keeps
    // the sibling panel's identical listener from double-acting. (Both panels listen on document.)
    const editingHere = !!descEdit;
    const focusedHere = root.contains(document.activeElement);
    if (!editingHere && !focusedHere && !panelActive) return;
    // Cmd/Ctrl+Enter commits the open editor (power-user save).
    if (descEdit && (ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
      ev.stopImmediatePropagation();
      const id = descEdit.id; commitField(id, descInput()?.value ?? ''); descEdit = null; descTab = 'extended'; refresh(); focusDescEdit('extended');
      announce('Internal note saved');
      return;
    }
    // Enter on a focused value box (read mode) enters edit — the keyboard mirror of clicking it.
    if (!descEdit && ev.key === 'Enter') {
      const zone = (document.activeElement as HTMLElement | null)?.closest?.('[data-ep-desc-editzone]') as HTMLElement | null;
      if (zone && root.contains(zone)) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        const e = byId.get(stack[stack.length - 1]); if (!e) return;
        const field = zone.dataset.epDescEditzone as 'airtable' | 'extended';
        descEditCaret = null; descEditAi = false; descEdit = { id: e.id, field }; descTab = field; refresh(); focusDescInput();
        return;
      }
    }
    // Add a subscriber from the chip-box input (Enter or comma), like the register form's chips.
    if ((ev.key === 'Enter' || ev.key === ',')) {
      const add = (document.activeElement as HTMLElement | null)?.closest?.('[data-ep-subadd]') as HTMLInputElement | null;
      if (add && root.contains(add)) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        const o = curObj();
        const v = add.value.trim().replace(/,$/, '').toLowerCase();
        if (!o || !editIds.has(o.id) || !v) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { add.setCustomValidity('Enter a valid email'); add.reportValidity(); return; }
        add.setCustomValidity(''); add.value = '';
        harvestEdit();
        const cur0 = (drafts.get(o.id)!.subscribers ?? o.subscribers ?? []) as string[];
        if (!cur0.includes(v)) drafts.get(o.id)!.subscribers = [...cur0, v];
        refresh();
        body.querySelector<HTMLInputElement>('[data-ep-subadd]')?.focus();
        return;
      }
    }
  };
  document.addEventListener('keydown', onKeydown);

  // Escape is NOT part of `onKeydown` any more — it is an `escapeStack` entry, so only one surface
  // in the app answers a press. The guards that opened `onKeydown` are repeated here verbatim, and
  // the `stopImmediatePropagation()` calls are gone: the sibling panel's identical entry is a
  // separate stack frame that simply never runs once this one returns `true`.
  pushEscape({
    label: 'entityPanel',
    onEscape: () => {
      if (root.hidden) return false;
      const editingHere = !!descEdit;
      const focusedHere = root.contains(document.activeElement);
      if (!editingHere && !focusedHere && !panelActive) return false;
      // Before the panel's own Escape (back / close): an open editor must swallow it, or
      // pressing Escape to abandon an edit would close the panel and take the edit with it.
      const curId = stack[stack.length - 1];
      // …but the tag typeahead owns Escape while its own field has focus (it clears the query).
      const inPicker = !!(document.activeElement as HTMLElement | null)?.closest?.('[data-entity-search]');
      if (!inPicker && curId && editIds.has(curId)) { exitEdit(curId); return true; }
      if (descEdit) { descEdit = null; refresh(); return true; }
      if (!panelActive) return false; // closing/back is the active panel's job
      // Back within this panel, else hand to the controller (focus → close focus; anchor → close all).
      if (stack.length > 1) popTo(stack.length - 2); else opts.onClose();
      return true;
    },
  });

  // The listing row's pencil is a shortcut into this panel's edit mode (it opens the panel first,
  // then fires this). Only the panel actually showing that entity reacts.
  document.addEventListener('schema:panelEditMode', (ev) => {
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (!id || stack[stack.length - 1] !== id || editIds.has(id)) return;
    editIds.add(id);
    refresh(); renderCrumbs();
    headTitleEl.querySelector<HTMLInputElement>('[data-ep-f="name"]')?.focus();
  });

  // The borrowed tag picker fires this. Only the panel currently HOLDING the picker reacts —
  // the node can only be in one place, so "who is editing" is answered by the DOM, not a flag.
  document.addEventListener('schema:epTagAdd', (ev) => {
    if (!tagPickerEl || !body.contains(tagPickerEl)) return;
    const o = curObj();
    const id = (ev as CustomEvent).detail?.id as string | undefined;
    if (!o || !id || !editIds.has(o.id)) return;
    harvestEdit();
    const cur0 = (drafts.get(o.id)!.tags ?? o.tags ?? []) as { entityId: string; source?: string }[];
    if (cur0.some((x) => x.entityId === id)) return;
    // Added by a human ⇒ source 'manual' ⇒ removable. A derived touch is never authored here.
    drafts.get(o.id)!.tags = [...cur0, { entityId: id, source: 'manual' }];
    refresh();
    body.querySelector<HTMLInputElement>('[data-ep-tagmount] [data-es-field]')?.focus();
  });

  return {
    el: root,
    open,
    push,
    popTo,
    doClose,
    setActive: (b: boolean) => { panelActive = b; },
    setWidth: (px: number | null) => { if (px == null) root.style.removeProperty('--panel-w'); else root.style.setProperty('--panel-w', px + 'px'); },
    currentId: () => stack[stack.length - 1] || null,
    /** Land this panel on ONE change (Changelog-tab deep link). See `applyPendingChange`. */
    focusChange: (changeId: string | null) => {
      if (!changeId) return;
      pendingChange = changeId;
      applyPendingChange();
      requestAnimationFrame(() => applyPendingChange());
    },
    getStack: () => stack.slice(),
    // Master-detail: mark (or clear) the reference row whose child is open on the right.
    setActiveChild: (id: string | null) => {
      activeChildId = id;
      body.querySelectorAll<HTMLElement>('.ep-row-active').forEach((r) => r.classList.remove('ep-row-active'));
      if (id) body.querySelector<HTMLElement>('[data-ep-push="' + id + '"]')?.classList.add('ep-row-active');
    },
    // Replace this panel's whole visit-stack (used to promote a focus into the anchor and to undo a
    // focus replacement). Invalid ids are dropped; an empty result is a no-op.
    setStack: (arr: string[]) => { const valid = arr.filter((id) => byId.has(id)); if (!valid.length) return; harvestEdit(); stack = valid; render(true); },
  };
}
