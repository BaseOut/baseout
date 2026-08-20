/**
 * refineCollapse — fold a toolbar's refinement controls into one "Filter" button, and give the user
 * a DRILL to reach them: a searchable, icon-led list of the facets this surface has, where picking
 * one REPLACES the list with that facet's own editor plus a back arrow. One thing on screen at a
 * time (Twenty's field-filter menu, 2026-08-05).
 *
 * It used to render an ACCORDION — every facet's header stacked in a 320px column, each panel
 * opening in flow underneath. With eight facets on Attachments that is a heap you scroll, and
 * opening two makes it worse. The accordion existed only to dodge a popover inside a popover; it
 * was never a design. The drill answers the same constraint (still no nested popovers — the chosen
 * facet's panel is the WHOLE panel) and reads as one decision at a time.
 *
 * Three shapes, one implementation:
 *  - DRILL   — a 320px popover. Level 1 = search + the facet list; level 2 = one facet's editor.
 *  - WIDE    — above `WIDE_AT` of TOOLBAR width there is room for both, so the list becomes a left
 *              rail and the editor sits beside it, no drill needed (Juicebox's filter modal).
 *  - CHIPS   — the applied filters, as sentences ("Type is Image or Video ×"), at the TOP OF THE
 *              PANEL, above the facet list (Airtable's chip wording; the placement is Oleh's, over
 *              Twenty's row-above-the-table — see the note on `chips` below for the trade).
 *
 * WIDTH IS ASKED OF THE TOOLBAR, NEVER THE VIEWPORT — this app's split view shrinks the content
 * column without moving the window, and every rule that asked the viewport has been wrong here.
 * Same measurement `lib/toolbarFit.ts` makes, same reason.
 *
 * The controls MOVE; they are never duplicated. A second copy would mean two sets of state to keep
 * in step, and these controls own real state (on Data ▸ Records the preset's Save / Discard / Clear
 * read them directly). Their listeners are bound to the elements themselves, so they travel with
 * the node. Styling lives in global.css — Astro's scoped styles never reach DOM built at runtime.
 *
 * What must NOT be passed in: scope pickers. On Records `Sales CRM` and `Orders` answer "what am I
 * looking at", the preset is locked to them, and burying that answer in a drawer leaves a page that
 * cannot say what it is showing. Each call site names its refinements explicitly.
 */
import { refineFacetIcon, refineFacetLabel } from './refineFacetIcons';
import { clampBelow } from '../components/ui/popoverPlace';

/**
 * Two-pane above this much TOOLBAR width, drill below it.
 *
 * Derived from the content the panel has to hold, not from a device tier: the widest facet body in
 * Data is Attachments ▸ Fields, whose `Sales CRM › Companies` headings need ~448px before they
 * ellipsize; the facet rail needs 232px (the same width every `.ff-panel` in the app already uses);
 * plus a 12px gutter and 2×8px padding = 716px of popover.
 *
 * A popover is only a popover while the page still reads as the thing behind it, so cap it at 5/6
 * of the column it hangs in: 716 ÷ (5/6) = 860. Measured against the real layouts — a 1440 laptop
 * with the sidebar expanded gives a 1313px toolbar (wide), and the same 1440 with ONE side panel
 * open gives 793 (drill). At 780 that second case would have squeezed a 716px popover into 793px of
 * column, touching both edges, which is a modal that missed rather than a menu.
 */
const WIDE_AT = 860;

export interface RefineCollapseOptions {
  /** The `.sch-tb` row. */
  toolbar: HTMLElement;
  /** Selectors for the controls to fold, in the order they should appear inside the panel. */
  selectors: string[];
  /** Fold below this toolbar width. Ignored when `always` is set. */
  at?: number;
  /** Fold at every width — the row is ONE Filter button, whatever the room. */
  always?: boolean;
  /** Trigger label. */
  label?: string;
}

/**
 * ── THE DECLARED-STATE ESCAPE (`data-tbf-*`) ───────────────────────────────────────────────────
 *
 * Everything below reads the Astro markup's own markers — `.ff-on`, `[data-facet-badge]`,
 * `.ff-count`. That works because those facets are BUILT by the same components this file was
 * written against. A facet built at RUNTIME by something else — the React Visualize island — has
 * none of them, and would fold into a panel of blank rows and no chips.
 *
 * Rather than teach this file about React, the control DECLARES its state on its own container and
 * the readers prefer the declaration when it is there. It is one generic escape, not a second
 * implementation: any runtime-built facet (a future island, a controller that assembles HTML) can
 * opt in with the same five attributes, and nothing here knows what Visualize is.
 *
 *   data-tbf-key      the facet's key — the icon map, the row and the chip are addressed by it
 *   data-tbf-label    its name, when the control has no readable trigger to borrow one from
 *   data-tbf-active   "1" while the facet is narrowing something; anything else = doing nothing
 *   data-tbf-summary  the human summary, in the wording already used here (`5 of 7`)
 *   data-tbf-reset    present ⇒ the container answers `facetreset`, so Clear and the chip × appear
 *   data-tbf-absent   present ⇒ NOT APPLICABLE right now — see `present()` below
 */

/**
 * A facet the current context does not have at all.
 *
 * Visualize's facet set is REDEFINED by its mode switch (Field types exists on the Data diagram and
 * nowhere else), but the containers are permanent — they have to be, because this file captures its
 * items once and a container that came and went would break that. So an inapplicable container
 * stays and says so, and everything here skips it: no list row, no chip, no contribution to the
 * count. An empty container that still drew a row would be a filter you can open and cannot use.
 */
function present(el: HTMLElement): boolean {
  return !el.hasAttribute('data-tbf-absent');
}

/** Wherever the control keeps its "this filter is doing something" mark. */
function isActive(el: HTMLElement): boolean {
  if (el.hasAttribute('data-tbf-active')) return el.dataset.tbfActive === '1';
  if (el.querySelector('.ff-on')) return true;
  const sel = el.querySelector<HTMLElement>('.ff-selbadge');
  if (sel && !sel.hidden) return true;
  return Array.from(el.querySelectorAll<HTMLElement>('.ff-count')).some((c) => !c.hidden);
}

/** The control's key — what the icon map, the rows and the chips are all addressed by. */
function keyOf(el: HTMLElement): string {
  return el.dataset.tbfKey || el.dataset.facet || el.dataset.dr || '';
}

function labelOf(el: HTMLElement): string {
  const key = keyOf(el);
  if (el.dataset.tbfLabel) return el.dataset.tbfLabel;
  const mapped = refineFacetLabel(key);
  if (mapped) return mapped;
  const trigger = el.querySelector<HTMLElement>('[aria-label]');
  return trigger?.getAttribute('aria-label') || key || 'Filter';
}

/**
 * The right-hand summary on a list row: what this facet is currently doing, in as few words.
 * A facet doing NOTHING says nothing — eight rows all reading "All" is the same wall of noise the
 * accordion was, just narrower. The absence IS the answer (Twenty's list carries no default state).
 */
function summaryOf(el: HTMLElement): string {
  if (!isActive(el)) return '';
  if (el.dataset.tbfSummary) return el.dataset.tbfSummary;
  const dr = el.querySelector<HTMLElement>('[data-dr-label]');
  if (dr) return (dr.textContent || '').trim();

  if (el.matches('.ff[data-facet]')) {
    if (el.dataset.facetSingle) {
      const sel = el.querySelector<HTMLInputElement>('[data-facet-opt]:checked');
      return sel?.dataset.label || 'All';
    }
    const badge = el.querySelector<HTMLElement>('[data-facet-badge]');
    if (badge && !badge.hidden) {
      const [shown, total] = (badge.textContent || '').split('/');
      return `${shown} of ${total}`;
    }
    return 'All';
  }

  // The condition builder / the fields picker keep their own count badge and no value list.
  const count = Array.from(el.querySelectorAll<HTMLElement>('.ff-count')).find((c) => !c.hidden);
  return count?.textContent?.trim() || 'All';
}

/**
 * The chip's text, as a SENTENCE — Airtable's rule: `Project Status is Planning or In Progress`
 * reads; `Project Status: 2/7` is a key and a value that the user has to reassemble. Values are
 * spelled out while there are few enough to fit; past that the count is the honest summary.
 */
function chipValue(el: HTMLElement): string {
  if (el.dataset.tbfSummary) return el.dataset.tbfSummary;
  const dr = el.querySelector<HTMLElement>('[data-dr-label]');
  if (dr) return (dr.textContent || '').trim();

  if (el.matches('.ff[data-facet]')) {
    if (el.dataset.facetSingle) {
      const sel = el.querySelector<HTMLInputElement>('[data-facet-opt]:checked');
      return sel?.dataset.label || '';
    }
    const opts = Array.from(el.querySelectorAll<HTMLInputElement>('[data-facet-opt]'));
    const shown = opts.filter((o) => o.checked);
    if (shown.length > 0 && shown.length <= 3) {
      return shown.map((o) => o.closest('.ff-opt')?.querySelector('.ff-label')?.textContent?.trim() || o.value).join(' or ');
    }
    if (shown.length === 0) return 'nothing';
    return `${shown.length} of ${opts.length}`;
  }

  const count = Array.from(el.querySelectorAll<HTMLElement>('.ff-count')).find((c) => !c.hidden);
  return count?.textContent?.trim() || '';
}

/**
 * Some folded controls (Records' condition builder, its fields picker) own JS-toggled panels that
 * are `hidden` until their own trigger is pressed — and that trigger is exactly what the drill
 * replaces. CSS alone could not be trusted to out-rank the component's own scoped `[hidden]` rule
 * (measured 2026-08-05: `display:none` survived a more specific unlayered selector), so the
 * attribute is lifted while the control is on screen and put back when it leaves. `data-tbf-unhid`
 * marks only what we changed, so a panel the component wants open is never force-closed.
 */
function unhide(el: HTMLElement, on: boolean) {
  el.querySelectorAll<HTMLElement>('.ff-panel, .dropdown-content').forEach((p) => {
    if (on && p.hidden) { p.dataset.tbfUnhid = '1'; p.hidden = false; }
    else if (!on && p.dataset.tbfUnhid) { delete p.dataset.tbfUnhid; p.hidden = true; }
  });
}

/** `facetreset` is understood by FacetFilter AND by DateRangePicker; nothing else answers it. */
function canReset(el: HTMLElement): boolean {
  return el.hasAttribute('data-tbf-reset') || el.matches('.ff[data-facet]') || el.hasAttribute('data-dr');
}

export function mountRefineCollapse(opts: RefineCollapseOptions): void {
  const { toolbar, selectors, at = 960, always = false, label = 'Filter' } = opts;
  if (!toolbar || toolbar.dataset.tbfMounted === '1') return;
  const first = toolbar.querySelector<HTMLElement>(selectors[0]);
  if (!first) return;
  toolbar.dataset.tbfMounted = '1';

  // Captured ONCE, in the authored order, while every control is still a child of the row. The
  // nodes are moved but never replaced, so this array stays the truth about order no matter which
  // container each one is sitting in.
  const items: HTMLElement[] = selectors.flatMap((sel) =>
    Array.from(toolbar.querySelectorAll<HTMLElement>(`:scope > ${sel}`)),
  );
  if (!items.length) return;

  // A marker at the controls' home position, so putting them back cannot guess the order wrong.
  const slot = document.createElement('span');
  slot.className = 'tbf-slot';
  slot.setAttribute('aria-hidden', 'true');
  first.parentNode!.insertBefore(slot, first);

  const dd = document.createElement('div');
  dd.className = 'ff tbf-dd';
  dd.hidden = true;
  dd.innerHTML =
    `<button type="button" class="btn btn-sm gap-1.5 ff-trigger tbf-trigger tooltip tooltip-bottom" data-tbf-toggle aria-expanded="false" aria-label="${label}" data-tip="${label}">` +
      // `tb-word` — the word goes below 1280, the funnel and the active-filter badge stay. This
      // trigger is the one place the rule is safest: it already carries a glyph AND a count, and its
      // `aria-label` / `data-tip` keep the word for anyone who needs it spelled out.
      `<span class="iconify lucide--sliders-horizontal size-3.5" aria-hidden="true"></span><span class="tb-word">${label}</span>` +
      `<span class="badge badge-sm badge-primary ff-count tbf-badge" data-tbf-badge hidden></span>` +
      // NO RESULT COUNT HERE, and it was tried (2026-08-11). Six references put the count on the
      // button that applies the filter — FotMob "Show 60 results", Hyundai Card "검색 (24)" — so this
      // trigger carried `370 of 386` beside the badge that counts ACTIVE FILTERS. Oleh, looking at
      // it: «мені це якось конфьюзить, це нам не потрібно».
      // He is right, and the reference does not transfer for a reason worth naming: in all six, the
      // count is on an APPLY button, where it is the consequence of a choice not yet made. Ours
      // applies live, so the number was describing something already on screen — and it sat next to
      // a second number meaning something else entirely. Two numbers on one control, and the reader
      // has to work out which is which. The badge stays; it answers "is anything filtering this?".
      `<span class="iconify lucide--chevron-down size-3 opacity-55" aria-hidden="true"></span>` +
    `</button>` +
    `<div class="ff-panel tbf-pop" data-tbf-pop hidden>` +
      `<div class="tbf-applied" data-tbf-applied hidden></div>` +
      `<div class="tbf-panes">` +
      `<div class="tbf-l1" data-tbf-l1>` +
        `<div class="tbf-l1head">` +
          `<label class="input input-sm tbf-search">` +
            `<span class="iconify lucide--search size-3.5 opacity-50" aria-hidden="true"></span>` +
            `<input type="text" data-tbf-q placeholder="Search filters" aria-label="Search filters" autocomplete="off" />` +
          `</label>` +
        `</div>` +
        `<div class="tbf-list" data-tbf-list role="list"></div>` +
        `<div class="tbf-nomatch" data-tbf-nomatch hidden>No matches</div>` +
      `</div>` +
      `<div class="tbf-l2" data-tbf-l2>` +
        `<div class="tbf-l2head">` +
          `<button type="button" class="tbf-back" data-tbf-back aria-label="Back to all filters">` +
            `<span class="iconify lucide--chevron-left size-4" aria-hidden="true"></span>` +
          `</button>` +
          `<span class="iconify size-4 tbf-l2icon" data-tbf-l2icon aria-hidden="true"></span>` +
          `<span class="tbf-l2name" data-tbf-l2name></span>` +
          `<span class="tbf-l2spacer"></span>` +
          `<button type="button" class="btn btn-sm btn-ghost text-error gap-1 tbf-l2clear" data-tbf-clear hidden>` +
            `<span class="iconify lucide--x size-3.5" aria-hidden="true"></span>Clear` +
          `</button>` +
        `</div>` +
        `<div class="tbf-l2body" data-tbf-host></div>` +
        `<div class="tbf-l2empty" data-tbf-l2empty>Pick a filter on the left.</div>` +
      `</div>` +
      `</div>` +
    `</div>` +
    `<div class="tbf-stash" data-tbf-stash hidden></div>`;
  slot.parentNode!.insertBefore(dd, slot);

  const toggle = dd.querySelector<HTMLElement>('[data-tbf-toggle]')!;
  const pop = dd.querySelector<HTMLElement>('[data-tbf-pop]')!;
  const stash = dd.querySelector<HTMLElement>('[data-tbf-stash]')!;
  const host = dd.querySelector<HTMLElement>('[data-tbf-host]')!;
  const badge = dd.querySelector<HTMLElement>('[data-tbf-badge]')!;
  const list = dd.querySelector<HTMLElement>('[data-tbf-list]')!;
  const nomatch = dd.querySelector<HTMLElement>('[data-tbf-nomatch]')!;
  const search = dd.querySelector<HTMLInputElement>('[data-tbf-q]')!;
  const l2 = dd.querySelector<HTMLElement>('[data-tbf-l2]')!;
  const l2icon = dd.querySelector<HTMLElement>('[data-tbf-l2icon]')!;
  const l2name = dd.querySelector<HTMLElement>('[data-tbf-l2name]')!;
  const l2clear = dd.querySelector<HTMLElement>('[data-tbf-clear]')!;

  /**
   * The applied-filter chips, at the TOP OF THE PANEL — not on a row above the table.
   *
   * They started above the table (Twenty), which is where a chip row belongs when the page has room
   * for one. Oleh cut that on 2026-08-05: a new band over every Data table is a new UI element on a
   * screen he is trying to quieten, and the chips do their job just as well one click in — open the
   * panel and it tells you what is ON before it offers what you could add.
   *
   * THE COST, accepted deliberately: a person looking at a short table sees only a NUMBER on the
   * Filter button, not which filters shortened it. Diagnosing "why is this list empty" now costs one
   * click. That is a known trade, not a defect — it is why the badge below is load-bearing.
   */
  const chips = dd.querySelector<HTMLElement>('[data-tbf-applied]')!;

  let folded = false;
  let wide = false;
  let picked: HTMLElement | null = null;

  // ── Level 1: the facet list ─────────────────────────────────────────────────────────────────
  items.forEach((el) => {
    const key = keyOf(el);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tbf-row';
    row.dataset.tbfRow = key;
    row.setAttribute('role', 'listitem');
    row.innerHTML =
      `<span class="iconify ${refineFacetIcon(key)} size-4 tbf-rowicon" aria-hidden="true"></span>` +
      `<span class="tbf-rowname"></span>` +
      `<span class="tbf-rowsum" data-tbf-rowsum></span>` +
      `<span class="iconify lucide--chevron-right size-3.5 tbf-rowchev" aria-hidden="true"></span>`;
    row.querySelector('.tbf-rowname')!.textContent = labelOf(el);
    row.addEventListener('click', () => pick(el));
    list.appendChild(row);
  });
  const rowFor = (el: HTMLElement) => list.querySelector<HTMLElement>(`[data-tbf-row="${keyOf(el)}"]`);

  function pick(el: HTMLElement | null, byUser = true) {
    if (picked && picked !== el) { unhide(picked, false); stash.appendChild(picked); }
    picked = el;
    list.querySelectorAll('.tbf-row').forEach((r) => r.classList.remove('tbf-row-on'));
    if (!el) {
      pop.dataset.tbfLevel = '1';
      return;
    }
    host.appendChild(el);
    unhide(el, true);
    rowFor(el)?.classList.add('tbf-row-on');
    l2icon.className = `iconify ${refineFacetIcon(keyOf(el))} size-4 tbf-l2icon`;
    l2name.textContent = labelOf(el);
    l2clear.hidden = !(canReset(el) && isActive(el));
    pop.dataset.tbfLevel = '2';
    // A facet may need more room than the 320px drill pane. It declares that itself, in `data-tbf-w`,
    // because the number belongs to the control that was designed at it — Records' condition builder
    // is 660 wide, and squeezed into 302 its field/operator/value selects wrap the moment you add a
    // second condition. Clamped to the toolbar so a wide facet cannot outgrow the column it sits in.
    const want = Number(el.dataset.tbfW || 0);
    const room = Math.max(320, toolbar.clientWidth - 24);
    pop.style.width = want > 320 ? `${Math.min(want, room)}px` : '';
    clampBelow(pop, dd);   // the width just changed under a panel anchored at `left: 0`
    // The moved control's own search box is the one the user wants next — the list search they just
    // left is behind them. Only when they ASKED for this facet: the wide form auto-fills its right
    // pane on open, and a caret landing in a box nobody pointed at reads as a hijack.
    if (byUser) el.querySelector<HTMLInputElement>('[data-facet-search], [data-dg-fields-search]')?.focus();
  }

  function back() {
    if (picked) { unhide(picked, false); stash.appendChild(picked); }
    picked = null;
    list.querySelectorAll('.tbf-row').forEach((r) => r.classList.remove('tbf-row-on'));
    pop.dataset.tbfLevel = '1';
    pop.style.width = '';   // the list is always the narrow one
    clampBelow(pop, dd);    // …so it may be able to sit back under its trigger
    search.focus();
  }
  dd.querySelector('[data-tbf-back]')!.addEventListener('click', back);
  l2clear.addEventListener('click', () => {
    if (picked) picked.dispatchEvent(new CustomEvent('facetreset', { bubbles: false }));
    refresh();
  });

  /**
   * One place decides which rows are on screen — the search query AND `present()`. They were two
   * loops for one minute and the search promptly un-hid the inapplicable facets it did not know
   * about.
   */
  function applyList() {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    items.forEach((el) => {
      const r = rowFor(el);
      if (!r) return;
      const hit = present(el) && (!q || (r.querySelector('.tbf-rowname')?.textContent || '').toLowerCase().includes(q));
      r.hidden = !hit;
      if (hit) visible++;
    });
    nomatch.hidden = visible > 0;
  }
  search.addEventListener('input', applyList);

  // ── The chips ───────────────────────────────────────────────────────────────────────────────
  function renderChips() {
    chips.textContent = '';
    if (!folded) { chips.hidden = true; return; }
    const on = items.filter((el) => present(el) && isActive(el));
    on.forEach((el) => {
      const chip = document.createElement('span');
      chip.className = 'tbf-chip';
      chip.innerHTML =
        `<button type="button" class="tbf-chip-open" data-tbf-chip>` +
          `<span class="iconify ${refineFacetIcon(keyOf(el))} size-3.5 tbf-chip-ic" aria-hidden="true"></span>` +
          `<span class="tbf-chip-l"></span><span class="tbf-chip-is">is</span><span class="tbf-chip-v"></span>` +
        `</button>` +
        (canReset(el)
          ? `<button type="button" class="tbf-chip-x tooltip tooltip-bottom" data-tbf-chipx data-tip="Remove this filter" aria-label="Remove this filter">` +
              `<span class="iconify lucide--x size-3" aria-hidden="true"></span></button>`
          : '');
      chip.querySelector('.tbf-chip-l')!.textContent = labelOf(el);
      chip.querySelector('.tbf-chip-v')!.textContent = chipValue(el);
      chip.querySelector('[data-tbf-chip]')!.addEventListener('click', () => pick(el));
      chip.querySelector('[data-tbf-chipx]')?.addEventListener('click', () => {
        el.dispatchEvent(new CustomEvent('facetreset', { bubbles: false }));
        refresh();
      });
      chips.appendChild(chip);
    });
    // `+ Add filter` is GONE. It existed to get from a chip row above the table back into the
    // facet list; inside the panel the facet list is the next thing on screen, so the button would
    // have navigated to where the user already is.
    chips.hidden = on.length === 0;
  }

  /**
   * How many FACETS are doing something — which is exactly how many chips are inside the panel.
   * It used to sum each control's own n/total, so hiding 2 of 5 types and picking a size read "3",
   * a number matching nothing the user could see.
   *
   * With the chips moved inside, this number is the ONLY thing on the page that says the list is
   * filtered. It is load-bearing, not decoration: it has to agree with the chips exactly, and it is
   * drawn heavier than a normal count badge (`.tbf-badge` in global.css).
   */
  function syncBadge() {
    const n = items.filter((el) => present(el) && isActive(el)).length;
    badge.hidden = n <= 0;
    badge.textContent = String(n);
    toggle.classList.toggle('ff-on', n > 0);
  }

  function refresh() {
    if (!folded) { chips.hidden = true; return; }
    // The facet on screen may have just stopped applying (Visualize's mode switch replaces the set
    // while the panel is open). Leaving it in level 2 would show an editor for a filter that no
    // longer exists, so retreat to the list — silently, and without stealing focus from a closed
    // panel.
    if (picked && !present(picked)) {
      unhide(picked, false);
      stash.appendChild(picked);
      picked = null;
      list.querySelectorAll('.tbf-row').forEach((r) => r.classList.remove('tbf-row-on'));
      pop.dataset.tbfLevel = '1';
      pop.style.width = '';
      if (!pop.hidden && !wide) search.focus();
    }
    if (wide && !pop.hidden && !picked) pick(items.find(present) ?? null, false);
    items.forEach((el) => {
      const sum = rowFor(el)?.querySelector<HTMLElement>('[data-tbf-rowsum]');
      if (sum) sum.textContent = summaryOf(el);
      rowFor(el)?.classList.toggle('tbf-row-active', isActive(el));
    });
    applyList();
    if (picked) l2clear.hidden = !(canReset(picked) && isActive(picked));
    syncBadge();
    renderChips();
  }

  function open(on: boolean) {
    pop.hidden = !on;
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) return;
    refresh();
    // Wide shows both panes, so something has to be in the right one; the drill starts at the list.
    if (wide && !picked) pick(items.find(present) ?? null, false);
    if (!wide) { pop.dataset.tbfLevel = picked ? '2' : '1'; }
    clampBelow(pop, dd);
  }

  function setFolded(on: boolean) {
    if (on === folded) return;
    folded = on;
    if (on) items.forEach((el) => stash.appendChild(el));
    else {
      picked = null;
      items.forEach((el) => slot.parentNode!.insertBefore(el, slot));
    }
    dd.hidden = !on;
    if (!on) open(false);
    refresh();
  }

  function setWide(on: boolean) {
    if (on === wide) return;
    wide = on;
    pop.dataset.tbfMode = on ? 'wide' : 'drill';
    if (on && !pop.hidden && !picked) pick(items.find(present) ?? null, false);
    if (!on && !pop.hidden) pop.dataset.tbfLevel = picked ? '2' : '1';
  }
  pop.dataset.tbfMode = 'drill';
  pop.dataset.tbfLevel = '1';

  toggle.addEventListener('click', (e) => { e.stopPropagation(); open(pop.hidden); });
  document.addEventListener('click', (e) => {
    const t = e.target as Node;
    if (pop.hidden || dd.contains(t)) return;
    open(false);
  });
  pop.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Escape') { if (!wide && picked) back(); else open(false); } });

  // Every control announces itself differently (facetchange · daterangechange · nothing at all for
  // the condition builder), so the refresh is hung off the interaction instead of off N event
  // names — one rAF after anything inside the panel is touched, which is also after the control's
  // own handler has run.
  let queuedRefresh = 0;
  const nudge = () => {
    if (queuedRefresh) return;
    queuedRefresh = requestAnimationFrame(() => {
      queuedRefresh = 0;
      // The component may have re-hidden its own panel on the way past (its outside-click handler
      // does not know it is inside a menu now) — put it back before repainting the summaries.
      if (picked) unhide(picked, true);
      refresh();
    });
  };
  toolbar.addEventListener('facetchange', nudge);
  toolbar.addEventListener('daterangechange', nudge);
  pop.addEventListener('click', nudge);
  pop.addEventListener('change', nudge);

  let queued = 0;
  const measure = () => {
    const w = toolbar.clientWidth;
    // A hidden tab measures 0 — that is not "narrow", it is "unknown", so the width-driven answers
    // wait for it to be shown. `always` needs no measurement and can settle straight away.
    if (always) setFolded(true);
    else if (w > 0) setFolded(w < at);
    if (w > 0) setWide(w >= WIDE_AT);
    refresh();
  };
  new ResizeObserver(() => {
    if (queued) return;
    queued = requestAnimationFrame(() => { queued = 0; measure(); });
  }).observe(toolbar);
  measure();
}
