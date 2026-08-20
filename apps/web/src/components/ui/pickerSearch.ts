/**
 * pickerSearch — one search engine for every ＋ picker, and for the shared
 * `EntitySearch` typeahead behind it.
 *
 * WHY IT EXISTS. Every picker in the app used to answer "there are 4,000 of
 * these" by rendering the first 40 and saying nothing (`EntitySearch` cut at
 * 40, `RecordPanel` and `MediaPanel` at 60, `DataChangelog` not at all). A
 * silent cut is the one failure a list cannot recover from: the user cannot
 * tell 40-of-3,966 from "this is everything", so they trust a wrong answer.
 *
 * THE RULE, and it is the only one: **group by the axis that actually VARIES,
 * never by one that is constant.** It is the app's glyph law generalised — name
 * what differs, never what the container already implies. That single rule
 * produces four different pickers out of one engine:
 *
 *   entity  → axis `kind`   (it holds bases, tables, fields and views)
 *   record  → axis `table`  (records only; kind is constant, table varies)
 *   run     → axis `month`  (runs only; a run is not IN a base — see below)
 *   asset   → axis `table`  (files only; format is already a facet elsewhere)
 *
 * A "Records" heading over a list that is entirely records prints one heading
 * over everything, which is the failure this rule exists to prevent.
 *
 * NARROWING, NOT LENGTHENING. A group header carries its own total and is a
 * DRILL target: clicking it scopes the search to that group instead of adding
 * rows. At 10,000 rows "show 50 more" is 200 clicks; narrowing is navigation.
 * "Show 50 more" survives, but only INSIDE an already-narrowed group, where the
 * click count is sane — the founder's own "add more … another 50", and the same
 * shape as `pattern-node-showmore`.
 *
 * SCOPE IS ONE ROW, AND "ALL" IS ITS ZERO VALUE (Oleh, 2026-08-04). Every
 * narrowing used to show as a removable chip; with nothing chosen the row did
 * not vanish, it read `IN [All bases]` — `zeroLabel()`. That replaced a second,
 * parallel statement of the same fact: each host used to draw its own
 * `This base / All bases` pill in the popover head, so scope existed in two
 * models that could disagree.
 *
 * THE ROW IS ONE SELECT, AND THE MENU IS THE NAVIGATOR (2026-08-07,
 * `pattern-scoped-picker`). `in [Records ×] [Sales CRM ×]` spent more of the row
 * on where you have BEEN the deeper you went. It collapsed first to a select
 * plus two glyph buttons beside it; the founder's recording moved those two
 * INSIDE the menu, because that is where they can act without the popover
 * closing. What is left on the row is ONE control: a SELECT carrying the whole
 * PATH (`Records › Sales CRM`). The zero value stays visible as `Everything`;
 * what went with the chips is the zero chip's chevron, which NARROWED to the
 * host's default and said so only in a tooltip: the one control that read "you
 * are seeing everything" was a button that quietly stopped you seeing
 * everything, and it rendered nothing at all when the host had no default.
 * `zeroScope` went with it.
 *
 * INSIDE THE MENU, IN THIS ORDER: a SEARCH that filters the MENU'S OWN ITEMS —
 * never the picker's results, which is the distinction the founder drew himself
 * ("searching these things, not the underlying item") · then BACK and CLEAR
 * SIDE BY SIDE ON ONE ROW · then the level's groups, with the current one MARKED
 * SELECTED. Back and clear re-open the menu at the level they land on, which is
 * what makes "the modal stays open and it goes up a level" true of the menu as
 * well as of the popover.
 *
 * THE WORD IS `Clear`, NOT `Search everything` (2026-08-08). Two reasons, both
 * arriving with the same change. Half a row is 71px of text where the old label
 * needed 96, so it truncated to "Search ever…" with no tooltip — breaking, one
 * row above it, the rule this file sets for the list below. And once the root
 * list became THE AREA'S OWN ELEMENTS, "everything" stopped being true: the
 * widest this control reaches is everything in Schema, or everything in Data. A
 * label that was honest when written and false after the data under it moved is
 * the defect this whole audit is about, and it does not stop being that because
 * we wrote it ourselves. Dan supplied the replacement in the same recording:
 * "if you just had back and clear or something, or reset".
 *
 * AND `Clear` CLEARS BOTH HALVES — the scope AND the query (2026-08-08, second
 * pass). It dropped only the scope, and that single gap produced Dan's entire
 * third paragraph: after typing `created`, Clear went to `Everything` with
 * `created` still filtering, so Attachments and Interfaces read as MISSING
 * (nothing in them is named that) and "only one table is showing up". Nothing
 * was wrong with the population; the control did less than its word. Renaming it
 * a third time in two days was the rejected alternative — the word is right.
 *
 * `Back` DOES NOT. It keeps what you typed, and the asymmetry is the point: going
 * up a level is asking the SAME question of a wider population, so a Back that
 * dropped the term would leave nothing that widens a search. Each row says which
 * it is in its own tooltip, because one word over a glyph cannot.
 *
 * AT THE TOP LEVEL BACK AND CLEAR RENDER DISABLED, NOT ABSENT. A control that
 * vanishes teaches nothing about where you are; a greyed one says "this is the
 * top" without a word.
 *
 * THE SELECT IS NEVER DISABLED. A first pass made it inert once a level had
 * nothing left to narrow BY, and the founder rejected it on sight — "see how
 * this isn't clickable? I think it should still be clickable". At a fully
 * narrowed leaf the menu shows the SIBLINGS of the current level with the
 * current one marked, so `Comments › Contacts` reaches `Comments › Orders`
 * without leaving and re-entering. That is lateral movement, which no other
 * control in this picker offers, and it is not the 2026-08-06 dropdown: that one
 * re-rendered the level you were already in as a second way to set it.
 *
 * THE NARROW RULE (2026-08-07, and it replaces the jump rule that shipped for
 * one day). EVERY MENU ITEM NARROWS — at every level, including `Everything`.
 * One rule, no split, no axis test.
 *
 * A jump-without-narrowing variant was built and rejected in the browser by the
 * designer using it: picking a group scrolled that heading to the top and
 * changed nothing else, and it read as broken. It IS broken, and the markup
 * says why — every menu item carries a DRILL CHEVRON, and a chevron promises
 * depth. An affordance that points inwards and delivers sideways is a defect no
 * documentation fixes. The scroll problem the menu exists to solve is solved by
 * narrowing anyway: land inside the group and there is nothing left to scroll
 * past, and getting back out is `back` and `clear` — which this same change
 * made visible controls for the first time.
 *
 * A kind dropdown WAS deliberately deleted on 2026-08-06 for being a SECOND way
 * to set a narrowing the row already stated, and that objection still stands.
 * This menu is not that control: the chip chain is gone, replaced by one select,
 * and the menu is the only way to reach a group that is not on screen. At
 * `VIEWS 116` the alternative is scrolling past every table above it. Navigation
 * over a list you cannot see is not duplication.
 *
 * The menu and the group headings therefore do the same thing by two routes, and
 * that is intended: the headings work on what is ON SCREEN, the menu reaches what
 * is not. Both go through `drill()` — there is exactly ONE narrowing path, so
 * `prune()` drops stale axis levels and `pinned` defaults identically either way.
 * Where a level is already flat (`narrowed()`) the menu offers the level's
 * SIBLINGS instead — same `drill()`, same `prune()`, one step sideways rather
 * than one step down.
 *
 * THE LIST SCROLLS VERTICALLY, AND ONLY VERTICALLY (2026-08-08). Dan asked whether the horizontal
 * scrollbar under the list was right. It is not, and the reason is not volume: a list of CHOICES
 * whose labels are cut off cannot be scanned, and a keyboard user moving with ↑/↓ never triggers a
 * sideways scroll at all — so the count and the drill chevron pinned to the right of every heading
 * were invisible forever, however few rows there were. It was a layout bug wearing an affordance,
 * and it came from `overflow-y: auto` alone: once one axis is not `visible`, the other computes to
 * `auto` too, so the scroller was never asked for.
 *
 * The fix is the rule this catalog already learned on `pattern-audit-table`: the LABEL truncates
 * with an ellipsis and carries its full text on a `tooltip`, the count and the chevron are pinned
 * right, and the container is `overflow-x: hidden`. The `data-tip` is on the truncating SPAN, not
 * on the button around it — `tooltip.ts` suppresses a hint that merely repeats a label it can read
 * on screen, and the one exception it makes is `scrollWidth > clientWidth`, which is true of the
 * span and false of the button. So the bubble appears exactly when the name is actually cut off.
 * AND A CAP IS NOT PROOF IT FITS: measure `scrollWidth` against `clientWidth` with a long name in
 * view, because three waves shipped the same overflow behind a `max-width` that looked sufficient.
 *
 * IT APPLIES TO EVERY SCROLLER IN THE POPOVER, and the first pass proved why that has to be said
 * out loud: it fixed `.pk-pop-list` and left `.pk-mlist` — the SCOPE MENU's list, the identical
 * container one layer up — on `overflow-y: auto` alone. Nothing overflowed in the harness, so the
 * gap survived a whole wave with every gate green. A rule stated for one element is not a rule.
 *
 * THE `elsewhere` BLOCK IS A FOOTER, NEVER A HEADER (2026-08-08, Dan). It rendered above the
 * results, on the reasoning that a list which LOOKS like it worked will never be scrolled to the
 * bottom — true of the EMPTY case, and wrongly applied to both. Scoped to `Schema › Fields` and
 * searching `created`, the two matching fields rendered UNDER `RECORDS 44` and `COMMENTS 65`: the
 * thing asked for sat beneath two offers to go somewhere else. A block that says "also, elsewhere"
 * cannot precede the "here" it qualifies — the word `Also` had already conceded that.
 *
 * A SCOPE THAT HIDES WHAT YOU JUST NAMED IS THE ENGINE'S PROBLEM (2026-08-05). Every picker here
 * opens pre-narrowed, so every picker can hide the very thing the user typed. The repair —
 * `Found under Comments — 7`, the engine's own drill buttons under the empty line or above the
 * results — was built once inside the `/schema` A/B variant, where only that variant could
 * inherit it. It is `ElsewhereOpts` below now: one implementation, one set of rules, every host.
 *
 * THE SERVER SEAM. `rows()` and `total()` are functions, not arrays, and the
 * engine never assumes it can see the whole set: `total()` may report more than
 * `rows()` returns, and the footer prints exactly what it is told. When search
 * moves server-side, a host swaps those two callbacks for something async and
 * calls `render()` again — the grouping, chips, drill, chunking and keyboard do
 * not change. Nothing here filters "the whole index" as a precondition.
 */

export interface PickerRow {
  /** Opaque to the engine — handed straight back to `onPick`. */
  id: string;
  /** facet key → value. The axis key decides which group the row lands in. */
  facets: Record<string, string>;
  /** Pre-rendered inner markup for the option row (host owns its own naming). */
  html: string;
  /** Lowercased substring haystack. */
  hay: string;
  /**
   * The row's NAME, lowercased — the part of `hay` the user would recognise as "what this is
   * called", without the parent path or the body text folded in. Used by one thing only: the
   * `elsewhere` repair below, whose quiet case must fire when the user typed something's NAME and
   * never on a path coincidence. Defaults to `hay`, which makes the repair fire more often rather
   * than less — a host that cares supplies it.
   */
  nameHay?: string;
  /** Already-open rows stay listed but inert — a row that vanishes reads as gone. */
  disabled?: boolean;
}

/**
 * THE COST OF A SCOPE THAT CAN HIDE WHAT YOU JUST NAMED — and the engine's answer to it.
 *
 * Every picker here opens pre-narrowed (the focused panel's kind, the page you are on). That
 * default is right nearly always, and when it is wrong it fails in two shapes:
 *
 *   LOUD — focused on a record, type a filename: `Nothing matches.` while Attachments held 3.
 *   QUIET, AND WORSE — scoped `Records`, type a comment author: some record coincidentally
 *   matches, so it READS as a working search, and the comments you meant are invisible.
 *
 * Both are answered in place, with the engine's OWN drill buttons, so the right answer is one
 * click away and there is no second model of the scope. Two rules, both measured on `/schema`
 * before this moved into the engine:
 *
 *   1. the quiet case fires on a **name** match only. A path match makes every field OF a table
 *      look like a match for the table, which would interrupt a working search constantly.
 *   2. the buttons stay **out of the ↑/↓ ring** whenever results exist behind them. With them in,
 *      `↓ ↵` drilled into a kind instead of opening the top result.
 *
 * They are `<button>`s, so Tab reaches them, and the engine answers Enter/Space on a focused
 * button (`onListKey`) — the list's own activation is `mousedown`, which no keyboard ever sends.
 */
export interface ElsewhereOpts {
  /** The scope key this repair watches — the level that narrows by kind/type. */
  key: string;
  /**
   * Candidate rows across EVERY value of `key`, scope-free and query-free. Separate from
   * `rows()` because a host may legitimately only ASK the scoped source for rows (the ＋ picker
   * does), and this block exists precisely to see past that.
   */
  rows: () => PickerRow[];
  /** Heading text for one value of `key`. */
  label: (value: string) => string;
  /** Explicit order for `key` values. Omit for first-appearance order. */
  order?: (a: string, b: string) => number;
}

export interface ScopeLevel {
  key: string;
  value: string;
  /** What the chip says. */
  label: string;
  /**
   * True for a narrowing the picker OPENED with rather than one the user chose —
   * the focused panel's base. It is removable like any other and it is drawn like
   * any other, but it does not by itself count as "the user has drilled", so an
   * empty query with only a pinned level still reads as the picker's resting
   * state (`isOpen()` stays false, which is what keeps EntitySearch's dropdown
   * shut until there is something to say).
   */
  pinned?: boolean;
}

export interface PickerSearchOpts {
  input: HTMLInputElement;
  /** The scrolling results container. The engine injects a chip strip before it and a footer after it. */
  list: HTMLElement;
  /**
   * The facet key to group by — "the axis that VARIES". A function when what varies DEPENDS on
   * where the user already is: the ＋ picker groups by KIND until a kind is chosen, and from
   * inside `Records` the kind is constant again so the axis becomes the record's table. One
   * engine, one rule, applied twice — rather than a second picker for the second level.
   * It is read at every use (render · drill · `narrowed`), never captured, so the axis and the
   * scope it is derived from can never be one repaint out of step.
   */
  axis: string | ((scope: ScopeLevel[]) => string);
  /** All candidate rows, already scope-free and query-free. */
  rows: () => PickerRow[];
  /**
   * How many rows exist behind `rows()` for the current scope + query. Defaults to
   * the filtered length. A server-backed host overrides this and may report more.
   */
  total?: (filtered: PickerRow[]) => number;
  /** Heading text for one axis value. */
  groupLabel: (value: string, rows: PickerRow[]) => string;
  /** Chip text for a drill on the axis. Defaults to `groupLabel`. */
  scopeLabel?: (value: string, rows: PickerRow[]) => string;
  /** Explicit axis-value order. Omit for first-appearance order. */
  groupOrder?: (a: string, b: string) => number;
  onPick: (id: string) => void;
  /** Fired on every scope change so a host pill can follow. */
  onScope?: (scope: ScopeLevel[]) => void;
  /** Fired when Esc had nothing left to un-narrow. The host closes. */
  onEscapeExhausted?: (ev: KeyboardEvent) => void;
  /** Ran after every paint — a host that shows/hides its popover hangs that off here. */
  afterRender?: (open: boolean) => void;
  emptyText?: string;
  /** Rows shown per group before the drill is offered. */
  perGroup?: number;
  /** The "another 50". */
  chunk?: number;
  /** The ↵ verb in the footer. */
  pickHint?: string;
  /** Recomputed placeholder after every scope change. */
  placeholder?: (scope: ScopeLevel[]) => string;
  /**
   * What the scope row reads when nothing is chosen — scope's ZERO VALUE, e.g.
   * `Everything`. Omit (or return '') and the row hides itself until the user narrows.
   */
  zeroLabel?: () => string;
  /**
   * Iconify class(es) for the select's leading glyph, asked of the WHOLE current scope
   * (`[]` included, which is the zero value). Take them from the app's one glyph mapping —
   * `schema/entityIcon.ts` — rather than inventing a set here. Omit and no glyph is drawn.
   */
  scopeIcon?: (scope: ScopeLevel[]) => string;
  /**
   * Iconify class(es) for one jump-menu item — an axis value at the CURRENT scope, so the
   * host can answer differently per level (a kind at the top, that kind's own axis inside it).
   * Return '' for a level whose values have no glyph in the one mapping; a menu of months
   * without icons is honest, a menu of months wearing an invented icon is not.
   */
  menuIcon?: (value: string, scope: ScopeLevel[]) => string;
  /**
   * WHICH BAND a menu value belongs to — `false` for the first band, `true` for the second.
   * The engine draws a daisyUI `divider` wherever the answer CHANGES between two adjacent
   * items, and nowhere else (2026-08-08, Dan: "maybe there's a line separator and then it shows
   * schema automations interfaces").
   *
   * It is a PREDICATE, not an index, and that is what makes it survive the two things that move
   * under it: a source with no rows renders no item at all, and the menu's own search filters
   * items out — either can empty the first band entirely, and a "separator before item 4" rule
   * would then draw a line above the first row or below the last. Asking per item means the line
   * only ever appears BETWEEN two items that actually differ.
   *
   * Omit it and no menu ever draws one; there is no default band.
   */
  menuBreak?: (value: string, scope: ScopeLevel[]) => boolean;
  /** See `ElsewhereOpts`. Omit and the block never appears. */
  elsewhere?: ElsewhereOpts;
}

export interface PickerSearch {
  render(): void;
  /** Clears the query + every drill, keeping only the levels passed in. */
  reset(scope?: ScopeLevel[]): void;
  setScope(scope: ScopeLevel[]): void;
  scope(): ScopeLevel[];
  /** True once there is a query or a user drill — i.e. the list has something to say. */
  isOpen(): boolean;
  /** Un-narrow one level. Returns false when there was nothing to walk back to. */
  back(): boolean;
  destroy(): void;
}

const AMP = /[&<>"]/g;
const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const pkEsc = (s: string) => String(s ?? '').replace(AMP, (c) => ENT[c]!);
const num = (n: number) => n.toLocaleString();

export function createPickerSearch(opts: PickerSearchOpts): PickerSearch {
  const {
    input, list, rows, groupLabel, onPick,
    perGroup = 6, chunk = 50, emptyText = 'Nothing matches.', pickHint = 'open',
  } = opts;
  /**
   * The axis, asked at the moment it is used, and for a PROSPECTIVE scope when we are about to
   * change one. See `PickerSearchOpts.axis`.
   */
  const axisOf = (sc: ScopeLevel[] = scope) => (typeof opts.axis === 'function' ? opts.axis(sc) : opts.axis);

  // The engine owns the chip strip and the footer, so a host only has to give it a
  // list container. Four hand-written copies of the same two elements is exactly the
  // duplication this module exists to end.
  const strip = document.createElement('div');
  strip.className = 'pk-scope';
  strip.hidden = true;
  /**
   * ABOVE THE SEARCH, not between the search and the list (Oleh, 2026-08-07).
   *
   * The scope row answers "where am I" — it is context, and context belongs with the popover's
   * title. The search filters the RESULTS, so it belongs against the results; sitting between them
   * separated a control from the thing it acts on. The reading order is now honest — where am I →
   * what am I looking for → results — instead of teaching a person about the narrowing only AFTER
   * they had started typing.
   *
   * It matters more since the scope select grew its own search: on top, the two fields sat two rows
   * apart filtering different things. Split by job, the popover reads navigation above, work below.
   *
   * Anchored on the input's wrapper rather than the input so the host may wrap it (a daisyUI
   * `label.input` here) without the engine knowing.
   */
  const searchAnchor = (input.closest('label') as HTMLElement | null) ?? input;
  searchAnchor.parentElement?.insertBefore(strip, searchAnchor);

  /**
   * The jump menu. A sibling of the list rather than a child of the strip, because `announceScope`
   * repaints the strip's innerHTML and would otherwise destroy it mid-gesture. It is `position:
   * fixed` (see `placeMenu`), so it takes no layout space wherever it sits.
   */
  const menu = document.createElement('div');
  menu.className = 'pk-menu';
  menu.hidden = true;
  list.parentElement?.insertBefore(menu, list);

  const foot = document.createElement('div');
  foot.className = 'pk-foot';
  // `←→ level` is the first time the picker admits levels exist — Escape has always walked back
  // and nothing ever walked forward. The row is allowed to wrap again (`.pk-foot`) because this
  // hint does not fit beside the count in a 360px popover, and clipping it would be worse.
  foot.innerHTML =
    `<span class="pk-count" data-pk-count></span>` +
    `<span class="pk-keys"><kbd class="kbd kbd-sm">↑</kbd><kbd class="kbd kbd-sm">↓</kbd> move` +
    ` · <kbd class="kbd kbd-sm">←</kbd><kbd class="kbd kbd-sm">→</kbd> level` +
    ` · <kbd class="kbd kbd-sm">↵</kbd> ${pkEsc(pickHint)}` +
    ` · <kbd class="kbd kbd-sm">esc</kbd> close</span>`;
  list.parentElement?.insertBefore(foot, list.nextSibling);
  const countEl = foot.querySelector<HTMLElement>('[data-pk-count]')!;

  let scope: ScopeLevel[] = [];
  let extra = 0;
  let active = -1;

  const q = () => input.value.trim().toLowerCase();
  const inScope = (r: PickerRow) => scope.every((s) => r.facets[s.key] === s.value);
  const matches = (r: PickerRow, query: string) => !query || r.hay.includes(query);
  const filtered = () => { const query = q(); return rows().filter((r) => inScope(r) && matches(r, query)); };
  /** Narrowed = the user has drilled ON THE AXIS. Only then does "show N more" appear. */
  const narrowed = () => { const a = axisOf(); return scope.some((s) => s.key === a); };
  const isOpen = () => !!q() || scope.some((s) => !s.pinned);

  /**
   * THE PATH, NOT THE LEAF (Oleh, 2026-08-07). `Comments › Contacts`, because a picker that
   * cannot say what it is showing is the defect the Data presets were fixed for. Empty scope
   * falls back to the zero value — a state, not an absence.
   */
  const pathText = () => (scope.length ? scope.map((s) => s.label).join(' › ') : opts.zeroLabel?.() || '');

  /**
   * The scope row: ONE select carrying the path. Back and clear used to sit beside it and now
   * live INSIDE the menu — see the file header — so this row has a single control again.
   */
  function announceScope() {
    closeMenu();
    const path = pathText();
    strip.hidden = !path;
    if (path) {
      const ico = opts.scopeIcon?.(scope) || '';
      strip.innerHTML =
        `<span class="pk-scope-lbl">in</span>` +
        `<button type="button" class="pk-sel" data-pk-menu aria-haspopup="menu" aria-expanded="false"` +
        ` aria-label="Searching in ${pkEsc(path)} — open the scope menu">` +
        (ico ? `<span class="iconify ${ico} size-3.5 pk-sel-ic" aria-hidden="true"></span>` : '') +
        `<span class="pk-sel-path">${pkEsc(path)}</span>` +
        `<span class="iconify lucide--chevron-down size-3.5 pk-sel-caret" aria-hidden="true"></span></button>`;
    } else {
      strip.innerHTML = '';
    }
    if (opts.placeholder) input.placeholder = opts.placeholder(scope);
    opts.onScope?.(scope.slice());
  }

  /**
   * Bucket a PROSPECTIVE scope. The menu at a flat level has to count the SIBLINGS, which live
   * one level up, and both `filtered()` and `buckets()` read the module-level `scope` — the same
   * swap `drill()` already does to name a chip against the scope it lands on.
   */
  function groupsUnder(sc: ScopeLevel[]): [string, PickerRow[]][] {
    const prev = scope;
    scope = sc;
    try { return buckets(filtered()); } finally { scope = prev; }
  }

  /**
   * What the menu offers at this level. Not narrowed → the groups the list is showing. NARROWED
   * (the list is one group's rows with no headings at all) → that group's SIBLINGS, computed
   * under the parent scope, with the current one marked by `currentValue()`. The select is never
   * inert, so this never has to answer "nothing".
   */
  const menuGroups = (): [string, PickerRow[]][] => {
    const a = axisOf();
    const lvl = scope.find((s) => s.key === a);
    return groupsUnder(lvl ? scope.filter((s) => s !== lvl) : scope);
  };
  /** The axis value the scope is currently sitting on, or '' — the menu's "selected" mark. */
  const currentValue = (): string => scope.find((s) => s.key === axisOf())?.value ?? '';

  /**
   * The `elsewhere` repair — see `ElsewhereOpts`. Returns the block's markup, or ''.
   *
   * TWO NUMBERS, AND ONLY ONE OF THEM IS PRINTED. Whether a value APPEARS is a name-match test
   * (rule 1 — a path coincidence must not interrupt a working search); what is PRINTED is the
   * count the drill actually lands on, which is the full-haystack count under the same scope the
   * drill will leave behind. Printing the name count was a lie of exactly the kind this picker
   * spent the week removing: `Tables 1` opening a footer of 3.
   * With NOTHING matched there is no working search to protect, so the appearance test widens to
   * the haystack too — we owe a complete explanation, and there the two counts coincide.
   */
  function elsewhereHtml(empty: boolean): string {
    const e = opts.elsewhere;
    if (!e) return '';
    const lvl = scope.find((s) => s.key === e.key);
    if (!lvl) return '';
    const query = q();
    if (!empty && !query) return '';
    const rest = without(e.key);
    const hay = new Map<string, number>();
    const named = new Set<string>();
    for (const r of e.rows()) {
      const v = r.facets[e.key] ?? '';
      if (!v || v === lvl.value) continue;
      if (!rest.every((s) => r.facets[s.key] === s.value)) continue;
      if (query && !r.hay.includes(query)) continue;
      hay.set(v, (hay.get(v) || 0) + 1);
      if (query && (r.nameHay ?? r.hay).includes(query)) named.add(v);
    }
    let keys = [...hay.keys()].filter((v) => (empty ? true : named.has(v)));
    if (!keys.length) return '';
    if (e.order) keys.sort(e.order);
    return `<div class="pk-elsewhere">${empty ? 'Found' : 'Also'} under other types</div>` + keys.map((v) => {
      const label = e.label(v);
      const n = num(hay.get(v) || 0);
      // Rule 2: `data-pk-nav` (the ↑/↓ ring) ONLY when nothing else matched. With results behind
      // it, taking the first keyboard slot puts this between the user and the top result —
      // measured: ↓↵ drilled here instead of opening the first row. Tab still reaches it, and
      // `onListKey` below is what makes Enter and Space work once it has focus.
      return `<button type="button" class="pk-group"${empty ? ' data-pk-nav' : ''}` +
        ` data-pk-drill="${pkEsc(v)}" data-pk-drillkey="${pkEsc(e.key)}"` +
        ` aria-label="Look in ${pkEsc(label)} instead — ${n}">` +
        `<span class="pk-group-lbl" data-tip="${pkEsc(label)}">${pkEsc(label)}</span>` +
        `<span class="pk-n">${n}</span>` +
        `<span class="iconify lucide--chevron-right size-3.5 pk-drill" aria-hidden="true"></span></button>`;
    }).join('');
  }

  /**
   * The empty line NAMES the narrowing it looked in when there is one. A bare `Nothing matches.`
   * under a `Records` chip is technically true and practically a dead end: it does not say that
   * the scope is why, and it is one word away from saying so.
   */
  function emptyLine(): string {
    const lvl = opts.elsewhere ? scope.find((s) => s.key === opts.elsewhere!.key) : null;
    if (!lvl) return pkEsc(emptyText);
    const word = pkEsc(lvl.label.toLowerCase());
    const typed = input.value.trim();
    return typed ? `No ${word} match “${pkEsc(typed)}”.` : `No ${word} in this scope.`;
  }

  /**
   * The current level's groups, in render order. ONE bucketing, shared by the list and by the
   * menu, so a menu count can never disagree with the heading naming the same group — the rule
   * that a printed number is the number the gesture lands on, applied to a second surface.
   */
  function buckets(all: PickerRow[]): [string, PickerRow[]][] {
    const m = new Map<string, PickerRow[]>();
    const a = axisOf();
    for (const r of all) {
      const v = r.facets[a] ?? '';
      const b = m.get(v);
      if (b) b.push(r); else m.set(v, [r]);
    }
    const keys = [...m.keys()];
    if (opts.groupOrder) keys.sort(opts.groupOrder);
    return keys.map((v): [string, PickerRow[]] => [v, m.get(v)!]);
  }

  function render() {
    closeMenu();
    const all = filtered();
    const grand = opts.total ? opts.total(all) : all.length;
    let html = '';
    let shown = 0;

    if (!all.length) {
      html = `<div class="pk-empty">${emptyLine()}</div>`;
    } else if (narrowed()) {
      // Already inside one group → a plain list with the founder's "another 50".
      const lim = perGroup * 3 + extra;
      for (const r of all.slice(0, lim)) { html += optHtml(r); shown++; }
      const left = all.length - lim;
      if (left > 0) html += `<button type="button" class="pk-more" data-pk-nav data-pk-more>Show ${num(Math.min(chunk, left))} more — ${num(left)} left</button>`;
    } else {
      // Group by the axis. Each heading carries its OWN total and is a drill target.
      for (const [v, g] of buckets(all)) {
        // The drill affordance is a CHEVRON, not the words "narrow to these". The prototype's
        // wording needed ~90px, which in a 300px popover pushed the heading onto a second line —
        // and the heading is the part that has to be read. The glyph is ALWAYS laid out and only
        // changes opacity on hover/keyboard, so neither the label nor the count ever moves.
        const label = groupLabel(v, g);
        html += `<button type="button" class="pk-group" data-pk-nav data-pk-drill="${pkEsc(v)}"` +
          ` aria-label="Narrow to ${pkEsc(label)} — ${num(g.length)}">` +
          `<span class="pk-group-lbl" data-tip="${pkEsc(label)}">${pkEsc(label)}</span>` +
          `<span class="pk-n">${num(g.length)}</span>` +
          `<span class="iconify lucide--chevron-right size-3.5 pk-drill" aria-hidden="true"></span></button>`;
        for (const r of g.slice(0, perGroup)) { html += optHtml(r); shown++; }
      }
    }

    // ALWAYS A FOOTER — under the results, never above them (2026-08-08, Dan: "these are fields, so
    // these are the results that should be at the top, underneath it, if there's other types that
    // it matches"). It shipped above, on the reasoning that a list which LOOKS like it worked will
    // never be scrolled to the bottom. That reasoning was about the EMPTY case and it was applied to
    // both: scoped to `Schema › Fields` and searching `created`, the two matching fields — the exact
    // thing asked for — rendered BELOW `RECORDS 44` and `COMMENTS 65`, so the answer sat under two
    // rows offering to go somewhere else. A block that says "also, elsewhere" cannot precede the
    // "here" it is qualifying; the word `Also` had already admitted that and the order contradicted
    // it. The empty case is unchanged and always was a footer — there `html` is one line, the block
    // is immediately visible, and its label says `Found` rather than `Also`.
    const els = elsewhereHtml(!all.length);
    list.innerHTML = html + els;
    countEl.innerHTML = `<b>${num(shown)}</b> of <b>${num(grand)}</b>`;
    active = -1;
    opts.afterRender?.(isOpen());
  }

  const optHtml = (r: PickerRow) =>
    `<div class="pk-opt${r.disabled ? ' pk-opt-off' : ''}" role="option" aria-selected="false"` +
    `${r.disabled ? '' : ' data-pk-nav'} data-pk-pick="${pkEsc(r.id)}">${r.html}</div>`;

  const navItems = () => Array.from(list.querySelectorAll<HTMLElement>('[data-pk-nav]'));
  function setActive(i: number) {
    const items = navItems();
    if (!items.length) { active = -1; return; }
    active = (i + items.length) % items.length;
    items.forEach((el, k) => {
      const on = k === active;
      el.classList.toggle('pk-active', on);
      if (el.classList.contains('pk-opt')) el.setAttribute('aria-selected', String(on));
    });
    items[active]?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * A LEVEL DOES NOT SURVIVE THE LEVEL IT HUNG OFF (2026-08-05).
   *
   * `axis` may be a function of scope, so choosing a kind is what DECIDES the next axis: scoped to
   * `Records` the axis is `table`, and a drill there adds `table:tblX`. Remove the kind chip and
   * the axis reverts to kind — but `table:tblX` was still filtering, so `Everything` silently
   * excluded Backups forever, because a run carries no `table` facet.
   *
   * The test is the axis itself, which needs no new declaration from the host: if removing a level
   * CHANGES what the axis is, the level being removed is the one that decided it, so every level
   * keyed on the old axis went with it. Pinned levels go too — a pin is a default the departing
   * value opened with (the focused panel's base), not a narrowing the user chose.
   * Where the axis is a constant (`EntitySearch`), this can never fire.
   */
  function prune(next: ScopeLevel[], axisBefore: string): ScopeLevel[] {
    if (axisOf(next) === axisBefore) return next;
    return next.filter((s) => s.key !== axisBefore && !s.pinned);
  }

  /**
   * The scope a drill on `key` LEAVES BEHIND, before the new level is appended. One function,
   * because the `elsewhere` block counts against exactly the scope its own drill will apply — that
   * is what keeps `Tables 1` from opening a list of 3.
   */
  function without(key: string): ScopeLevel[] {
    const a = axisOf();
    const next = scope.filter((s) => s.key !== key);
    return key === a ? next : prune(next, a);
  }

  /**
   * Narrow to one value. `key` defaults to the current axis — the ordinary group-heading drill.
   * The `elsewhere` block passes its OWN key, because it drills across the axis rather than along
   * it, and that is exactly the case `prune` above exists for.
   */
  function drill(value: string, key?: string) {
    // The axis is resolved BEFORE the scope changes — this drill is on the axis the user was
    // just looking at, and appending the level is what makes the NEXT axis a different question.
    const k = key || axisOf();
    const next = without(k);
    // The label is read against the scope the drill LANDS on, not the one it left: from inside
    // `Records`, `scopeLabel('comment')` asked of the old scope would run the record source's
    // table namer over a kind value and answer `Unknown table`.
    scope = next;
    const g = filtered().filter((r) => (r.facets[k] ?? '') === value);
    const label = (opts.scopeLabel || groupLabel)(value, g);
    scope = [...next, { key: k, value, label }];
    extra = 0;
    announceScope(); render();
  }

  function back(): boolean {
    if (scope.length) { scope = prune(scope.slice(0, -1), axisOf()); extra = 0; announceScope(); render(); return true; }
    if (input.value) { input.value = ''; extra = 0; render(); return true; }
    return false;
  }

  // ── The narrowing menu ───────────────────────────────────────────────────────────────────
  // See THE NARROW RULE in the file header. Every item here goes through `drill` — the same
  // path a group heading takes — so there is exactly one narrowing path and `prune` applies once.

  /** Gap to the control, and the margin the menu keeps from any hard edge. `placePopover`'s two. */
  const MENU_GAP = 4;
  const MENU_EDGE = 12;
  /** Below this a menu is not worth flipping FOR — a search field and two rows and nothing else. */
  const MENU_MIN_H = 120;
  /** The documented cap (`.pk-menu { max-height: 40vh }`), restated only as a ceiling for the clamp. */
  const MENU_VH = 0.4;
  /**
   * SEPARATELY CLAMPED, and that is the point. `placePopover` clamps the POPOVER to the `<main>`
   * content column; a menu hanging off a control near that popover's right edge is a different
   * rectangle and inherits none of it. Same rule, applied again, and measured after the repaint
   * for the same reason placement is measured at all.
   *
   * THE FLIP THRESHOLD IS MEASURED, NOT ASSUMED, and it had to be re-measured when the menu grew a
   * search field and two rows (2026-08-07): the same list that fitted below the anchor yesterday
   * is ~76px taller today. So the height is taken with the inline cap CLEARED, the side is chosen
   * from the two spaces, and the cap is then written to the space the chosen side actually has —
   * which is what stops a flipped menu running off the top of the viewport instead of scrolling.
   */
  function placeMenu(anchor: HTMLElement) {
    const r = anchor.getBoundingClientRect();
    menu.style.maxHeight = '';
    const { width: W, height: natural } = menu.getBoundingClientRect();
    const roomBelow = window.innerHeight - MENU_EDGE - (r.bottom + MENU_GAP);
    const roomAbove = r.top - MENU_GAP - MENU_EDGE;
    const flip = natural > roomBelow && roomAbove > roomBelow;
    const room = flip ? roomAbove : roomBelow;
    menu.style.maxHeight = Math.max(MENU_MIN_H, Math.min(window.innerHeight * MENU_VH, room)) + 'px';
    const H = menu.getBoundingClientRect().height;
    const main = document.querySelector('main') || document.body;
    const minLeft = Math.max(MENU_EDGE, Math.round(main.getBoundingClientRect().left) + MENU_GAP);
    menu.style.left = Math.max(minLeft, Math.min(r.left, window.innerWidth - W - MENU_EDGE)) + 'px';
    menu.style.top = (flip ? Math.max(MENU_EDGE, r.top - H - MENU_GAP) : r.bottom + MENU_GAP) + 'px';
  }

  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    strip.querySelector('[data-pk-menu]')?.setAttribute('aria-expanded', 'false');
  }

  /**
   * The MENU'S OWN query. It filters the menu's items and nothing else — the founder's "an omni,
   * always a search that's searching these things, not the underlying item". It is deliberately
   * NOT the picker's query: two inputs in one popover only work while the difference is visible,
   * and the results list must not move while you are choosing where to look.
   */
  let mq = '';

  /**
   * One nav row. `off` renders it DISABLED, never absent — see the file header.
   *
   * IT CARRIES A `data-tip` AS WELL AS AN `aria-label` (2026-08-08, Oleh). Both rows are one word
   * over a glyph, and one word is not enough to say what they touch — a screen reader heard the
   * long form and a sighted person read five letters and guessed. That was survivable while `Clear`
   * only reset the scope; it stops being survivable the moment it also drops the query, which is
   * what this same change makes it do. The two tips are also where the ASYMMETRY between them is
   * stated: `Back` keeps what you typed, `Clear` does not, and nothing else on screen says so.
   *
   * The tip and the aria name are the same sentence and are BOTH emitted — `data-tip` is not an
   * accessible name, and a control whose bubble and whose announced name disagree is worse than one
   * with only the name. `tooltip.ts` suppresses a hint that merely ECHOES its trigger's visible
   * text; "Clear" is a strict prefix of the tip and the remainder is words rather than a count, so
   * the echo test returns false and the bubble is painted. That is measured, not assumed.
   *
   * `tooltip-bottom`, and WITHOUT daisyUI's `tooltip` class — that class sets
   * `display: inline-block`, which would break the `flex: 1 1 0` that splits this row in half. The
   * painter reads the placement class on its own. BOTTOM because these rows sit directly under the
   * menu's own search field: the default `top` opens the bubble over an input that still holds the
   * caret, and covering the field a person just typed in is worse than covering the first row of a
   * list they are not reading yet. The painter flips it back to `top` if the bottom has no room.
   *
   * `cls` carries the ONE difference between the two rows — see `text-error` on Clear below. Size,
   * shape, glyph slot, truncation, disabled treatment and tooltip side are all fixed here, because
   * the pair has to keep reading as a pair.
   */
  const navRow = (attr: string, ico: string, label: string, aria: string, off: boolean, cls = '') =>
    `<button type="button" class="pk-mi pk-mnav tooltip-bottom${cls ? ` ${cls}` : ''}" ${attr}${off ? ' disabled' : ''}` +
    ` data-tip="${pkEsc(aria)}" aria-label="${pkEsc(aria)}">` +
    `<span class="iconify ${ico} size-3.5" aria-hidden="true"></span>` +
    `<span class="truncate">${pkEsc(label)}</span></button>`;

  /**
   * The head: the menu's search, then Back and Clear ON ONE ROW. It sits OUTSIDE the
   * scroller so a 116-group level cannot push the two controls that get you out of it off the top.
   *
   * ONE ROW, NOT TWO (2026-08-08, Dan: "I wonder if you could even get these on the same row just to
   * save a little bit"). They were two full-width `<li>`s in a `menu`, and the height they spent is
   * height the list needs — the menu is capped at 40vh and the head is subtracted from it, so every
   * pixel here is a pixel of groups. Side by side they still read as the pair they are: same size,
   * same order, same disabled treatment. The `<ul class="menu">` went with the second row — two
   * buttons in a flex row are not a list, and daisyUI's `menu` was only ever giving them width.
   *
   * `scope.length` here is a LEVEL test, not the resting-state test `isOpen()` makes: a pinned
   * level is still a level you can walk out of, so it counts. Nothing about `pinned` is derived.
   *
   * THE TWO ROWS NO LONGER GREY OUT TOGETHER (2026-08-08). They did while both were level-only
   * controls. Now that `Clear` also drops the query they answer two different questions — `Back`
   * asks "is there a level above this?" and `Clear` asks "is there ANYTHING to clear?" — and at the
   * root with a query typed those answers differ. Keeping one flag would have rendered the button
   * that clears the search inert on the only screen where the search is the only thing left to
   * clear, which is the same shape of defect as the label that promised more than it did.
   */
  const menuHeadHtml = () => {
    const atTop = scope.length === 0;
    const clearOff = nothingToClear();
    return `<div class="pk-mhead">` +
      `<input type="search" class="input input-sm pk-msearch" data-pk-msearch autocomplete="off"` +
      ` spellcheck="false" placeholder="Filter this list…" aria-label="Filter this menu">` +
      `<div class="pk-mnavrow">` +
      // `Back` KEEPS THE QUERY, and its tip is where that is said. Going up a level is asking the
      // same question of a wider population — you typed a term and you want it looked for in more
      // places — so dropping the term would make the one control for widening a search useless for
      // widening a search. It is also the pair's whole distinction from `Clear`, so the two tips
      // read against each other rather than each on its own.
      navRow('data-pk-mback', 'lucide--corner-up-left', 'Back', 'Up one level, keeping the search', atTop) +
      // `Clear`, NOT `Search everything` — two reasons, both from this same change.
      // 1. Half a row is 71px of text and `Search everything` needs 96, so it truncated to
      //    "Search ever…" with no tooltip, breaking the rule THIS wave wrote for the list below it.
      // 2. Once the root list became the AREA's own elements, "everything" stopped being true —
      //    the widest this control can reach is everything in Schema, or everything in Data.
      // Dan supplied the word himself: "if you just had back and clear or something, or reset".
      //
      // AND IT CLEARS BOTH HALVES (2026-08-08, Dan's third paragraph). It used to drop the scope and
      // leave the typed query behind, which produced every symptom he reported and none of them were
      // the population: pressing Clear after typing `created` went to `Everything` with `created`
      // still filtering, so Attachments and Interfaces were "missing" (nothing in them is named
      // that) and "only one table is showing up". Nothing was broken in the data — the control did
      // less than its word. The rejected alternative was renaming it a THIRD time in two days to
      // something narrower; the word is right and the behaviour was short of it, and his own
      // phrasing when he asked for the button was "back and clear or something, or reset".
      //
      // RED, AND IT IS THE APP'S EXISTING CLEAR TREATMENT — not a new one for this menu.
      // `btn-ghost text-error` + `lucide--x` is what the five filter toolbars already draw:
      // DateRangePicker.astro:61 · BaseSelectionTable.astro:457 · SchemaChangelog.astro:290 ·
      // SchemaRelationships.astro:330 · SchemaAutomations.astro:194. `text-error` tints the WHOLE
      // control, glyph and word together, in all five — so it does here. A version where only the
      // cross is red would be a SIXTH way of drawing one control, which is the variance every wave
      // of this audit exists to remove; "less variance, not less code" cuts against the half
      // measure even though the half measure is closer to the literal request. `Back` stays neutral:
      // it is navigation and this is a reset, and that weight difference is the signal.
      navRow('data-pk-mclear', 'lucide--x', 'Clear', 'Clear the search and the scope', clearOff, 'text-error') +
      `</div></div>`;
  };

  /** The level's groups, filtered by `mq`, with the current one marked. */
  function menuItemsHtml(): string {
    const cur = currentValue();
    const groups = menuGroups().filter(([v, g]) => !mq || groupLabel(v, g).toLowerCase().includes(mq));
    if (!groups.length) {
      return `<li class="pk-mnone">${mq ? `No group matches “${pkEsc(mq)}”.` : 'No groups at this level.'}</li>`;
    }
    // The band of the item BEFORE this one — `null` until the first is drawn, so a separator can
    // never be the menu's first element. See `menuBreak`.
    let band: boolean | null = null;
    return groups.map(([v, g]) => {
      // `groupLabel`, never `scopeLabel`: the menu lists the HEADINGS of the level, and it is the
      // heading's own wording the user is choosing between. `drill` computes the chip text.
      const label = groupLabel(v, g);
      const ico = opts.menuIcon?.(v, scope) || '';
      const on = v === cur;
      const b = opts.menuBreak?.(v, scope) ?? false;
      // A HAIRLINE, NOT daisyUI's `divider` (2026-08-08, Dan: "чому такий товстий"). The first pass
      // used `divider` on the reasoning that the app should own one separator element. It is the
      // wrong instrument here: `divider` separates page SECTIONS — it is a flex row whose ::before
      // and ::after are 2px each, sized to sit between blocks of content and to carry optional text
      // between them. Dropped into a menu whose rows are 12px it reads as a filled bar, not a line.
      // A menu separator is one hairline. Same reasoning as "an icon sized by font-size is not type":
      // reusing the catalog element matters, but only where the element is actually for this job.
      const sep = band !== null && b !== band
        ? `<li class="pk-msep" role="separator" aria-hidden="true"></li>` : '';
      band = b;
      return sep + `<li><button type="button" role="menuitem" class="justify-between pk-mi${on ? ' pk-mi-on' : ''}"` +
        ` data-pk-go="${pkEsc(v)}"${on ? ' aria-current="true"' : ''}` +
        ` aria-label="${on ? 'Currently showing' : 'Narrow to'} ${pkEsc(label)} — ${num(g.length)}">` +
        `<span class="flex min-w-0 items-center gap-2">` +
        (ico ? `<span class="iconify ${ico} size-3.5" aria-hidden="true"></span>` : '') +
        `<span class="truncate" data-tip="${pkEsc(label)}">${pkEsc(label)}</span></span>` +
        `<span class="pk-mi-n flex items-center gap-1">` +
        (on ? `<span class="iconify lucide--check size-3.5 pk-mi-chk" aria-hidden="true"></span>` : '') +
        `${num(g.length)}<span class="iconify lucide--chevron-right size-3" aria-hidden="true"></span>` +
        `</span></button></li>`;
    }).join('');
  }

  /** Repaint ONLY the items — the search field keeps its value and its focus. */
  function paintMenuItems() {
    const ul = menu.querySelector<HTMLElement>('[data-pk-mlist]');
    if (!ul) return;
    ul.innerHTML = menuItemsHtml();
    // Filtering changes the height, so the flip decision is re-taken rather than left stale.
    const anchor = strip.querySelector<HTMLElement>('[data-pk-menu]');
    if (anchor) placeMenu(anchor);
  }

  function openMenu() {
    const anchor = strip.querySelector<HTMLElement>('[data-pk-menu]');
    if (!anchor) return;
    mq = '';
    menu.innerHTML = menuHeadHtml() +
      `<ul class="menu menu-sm w-full p-0 pk-mlist" data-pk-mlist role="menu">${menuItemsHtml()}</ul>`;
    // Unhide, REPAINT, then place — `placePopover`'s order, for the same reason: a hidden or
    // stale element measures the previous open.
    menu.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    placeMenu(anchor);
    // The SEARCH takes focus, not the first item: the founder asked for this menu because the
    // level can be long, and typing is how you get through a long one.
    menu.querySelector<HTMLInputElement>('[data-pk-msearch]')?.focus();
  }

  /**
   * A menu pick. It NARROWS — always, at every level, `Everything` included — and it does so by
   * calling the group heading's own `drill`, not a second path beside it. That is what keeps a
   * level keyed to an old axis, and the `pinned` defaults, dropped identically from either route.
   *
   * AND THE MENU STAYS OPEN WHILE THERE IS SOMEWHERE DEEPER TO GO — AND CLOSES WHEN THERE IS NOT
   * (2026-08-08, Dan, refining the same day's first answer).
   *
   * The morning's rule was that EVERY narrowing keeps the menu open ("most likely people are going
   * to want to drill down"). That half was right and this replaces only the other half: *"if it's
   * the lowest item, and it doesn't update, then I think the menu should close … once I click on
   * that, it should disappear."* A menu still sitting there after a click that changed nothing
   * reads as a control that failed, which is the whole complaint.
   *
   * THE TEST IS THE RESULT OF THE CLICK, NOT WHICH ROW WAS CLICKED — one line, no special cases.
   * Appending a level either opens a NEW axis to narrow by or it does not, and `axisOf` is already
   * a function of scope, so "is there anything under this?" is exactly "did the axis change?".
   * It answers both of Dan's cases with the same question:
   *
   *   1. A LEAF. Inside `Records` the axis is `table` at every depth, so drilling into a table
   *      leaves the axis where it was: there is nothing below a table here. Close.
   *   2. THE ALREADY-SELECTED SIBLING — the row marked ✓, which is the one he demonstrated. A menu
   *      only offers siblings once the level is FLAT, i.e. a level keyed on the current axis is
   *      already in scope; re-picking it rebuilds the identical scope, so the axis cannot have
   *      moved. Close. (Picking a DIFFERENT sibling is the same shape — it updates the list but
   *      there is still nothing under it — and closing there is case 1, not an exception.)
   *
   * Focus goes back to the input, because the row that was pressed is inside the element being
   * hidden and a focused node inside a hidden subtree drops the keyboard to the body.
   *
   * `reopenMenu`, never `openMenu`: it MUTATES the head instead of rebuilding it, which is what
   * keeps the node the pointer is still on attached — see that function.
   */
  function narrowTo(value: string) {
    const axisBefore = axisOf();
    drill(value);
    if (axisOf() === axisBefore) { closeMenu(); input.focus(); return; }
    reopenMenu();
  }

  /**
   * CLEAR IS A RESET — the scope AND the query (2026-08-08, Dan). Straight to the zero value on
   * both halves. `prune` is not needed and would be wrong: there is no level left for a stale one
   * to hang off.
   *
   * `input.value` is cleared BEFORE `render()`, which reads it through `q()`; the two lines are not
   * reorderable. This is deliberately the same body as `reset([])` minus the scope argument, and it
   * is written out rather than delegated because `reset` also re-announces a caller-supplied scope.
   */
  function clearScope() {
    scope = []; extra = 0; input.value = '';
    announceScope(); render();
  }

  /**
   * Is there anything for `Clear` to clear? Asked once and used in the two places that must agree —
   * the head's first paint and `reopenMenu`'s in-place toggle. It is NOT `atTop`: `Back` is a level
   * control and greys out on levels alone, while `Clear` now also owns the query, so at the root
   * with a term typed one is dead and the other is not. Deriving both from `scope.length` is what
   * would put the button that clears the search out of action on the one screen where the search is
   * all there is to clear.
   */
  const nothingToClear = () => scope.length === 0 && !input.value;

  /**
   * Put the menu back after a nav row moved a level, WITHOUT rebuilding it — and that distinction
   * is the whole reason this is not `openMenu()`.
   *
   * The rows activate on `mousedown`; the host's outside-click test runs on the `click` that
   * follows and asks `closest('[data-ph-pop]')` about the pressed node. Replacing `menu.innerHTML`
   * in between DETACHES that node, the test is answered by an orphan, and the picker closes on the
   * very gesture meant to navigate it — the chip ✕ bug, one control later. So the head is MUTATED
   * in place (two `disabled` toggles) and only the items list, which holds no pressed node, is
   * repainted. `announceScope` has already hidden the menu, because it repaints the anchor.
   */
  function reopenMenu() {
    const anchor = strip.querySelector<HTMLElement>('[data-pk-menu]');
    if (!anchor) return; // no path to state (a host with no zeroLabel) → no select to hang off
    const atTop = scope.length === 0;
    menu.querySelector('[data-pk-mback]')?.toggleAttribute('disabled', atTop);
    // Its OWN test — see `nothingToClear`. Sharing `atTop` here would silently reintroduce the
    // dead-Clear-with-a-query case on every repaint even once the first paint got it right.
    menu.querySelector('[data-pk-mclear]')?.toggleAttribute('disabled', nothingToClear());
    const s = menu.querySelector<HTMLInputElement>('[data-pk-msearch]');
    if (s) s.value = '';
    mq = '';
    menu.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    paintMenuItems();
    // Focus lands on the search, never on the row just pressed: one press of Back can DISABLE that
    // row, and a disabled element drops focus to the body, which loses the keyboard entirely.
    s?.focus();
  }

  /**
   * A press on a menu row. The two nav rows move a level and leave the menu OPEN on the level they
   * land on — the founder's "the modal stays open and it goes up a level", true of the menu as
   * well as of the popover, which is what makes climbing two levels one gesture per level.
   */
  function menuActivate(el: HTMLElement) {
    if (el.hasAttribute('disabled')) return;
    if (el.dataset.pkGo !== undefined) { narrowTo(el.dataset.pkGo!); return; }
    if (el.dataset.pkMback !== undefined) { back(); reopenMenu(); return; }
    if (el.dataset.pkMclear !== undefined) { clearScope(); reopenMenu(); }
  }

  /** Activate whatever the keyboard is sitting on: a group drills, `more` extends, a row picks. */
  function activate(el: HTMLElement) {
    if (el.dataset.pkDrill !== undefined) { drill(el.dataset.pkDrill!, el.dataset.pkDrillkey || undefined); return; }
    if (el.dataset.pkMore !== undefined) { extra += chunk; render(); return; }
    if (el.dataset.pkPick !== undefined) onPick(el.dataset.pkPick!);
  }

  const onInput = () => { extra = 0; render(); };
  const onKey = (ev: KeyboardEvent) => {
    // PAINTED, not "has rows": a host may keep the last result set in the DOM behind a
    // hidden popover, and arrowing through a list nobody can see is worse than inert.
    const painted = list.offsetParent !== null || list.getClientRects().length > 0;
    if (!painted && ev.key !== 'Escape') return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(active + 1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); return; }
    // ←/→ ARE LEVELS, but the caret owns them first. This handler sits on a text input: hijacking
    // an arrow that still has characters to walk past would break typing to fix a typo, which is
    // the commonest thing anyone does in a search box. So each direction only becomes a level move
    // at its own end of the value — always true while the box is empty, which is Dan's whole flow.
    if (ev.key === 'ArrowRight') {
      const end = input.value.length;
      if (input.selectionStart !== end || input.selectionEnd !== end) return;
      const el = navItems()[active];
      if (el && el.dataset.pkDrill !== undefined) { ev.preventDefault(); activate(el); }
      return;
    }
    if (ev.key === 'ArrowLeft') {
      if (input.selectionStart !== 0 || input.selectionEnd !== 0) return;
      if (back()) ev.preventDefault();
      return;
    }
    if (ev.key === 'Enter') {
      const el = navItems()[active];
      if (el) { ev.preventDefault(); activate(el); }
      return;
    }
    if (ev.key === 'Escape') {
      if (!menu.hidden) { ev.preventDefault(); ev.stopPropagation(); closeMenu(); input.focus(); return; }
      // Esc walks BACK one level of narrowing before it closes anything. stopPropagation
      // matters: the host's own document-level Escape handler would otherwise close the
      // popover in the same keystroke that un-narrowed it.
      if (back()) { ev.preventDefault(); ev.stopPropagation(); return; }
      opts.onEscapeExhausted?.(ev);
    }
  };
  const onListClick = (ev: MouseEvent) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-pk-drill],[data-pk-more],[data-pk-pick]');
    if (!el || el.classList.contains('pk-opt-off')) return;
    ev.preventDefault();
    activate(el);
  };
  /**
   * THE LIST ACTIVATES ON `mousedown`, AND NO KEYBOARD EVER SENDS ONE.
   *
   * `mousedown` is deliberate — it fires before the input loses focus, so a host's "clicked
   * outside?" listener never sees the popover close underneath the click. The cost, which was a
   * real defect: anything in the list that Tab can reach but ↑/↓ cannot (the `elsewhere` buttons,
   * kept out of the ring on purpose) was reachable and then completely inert. Keyboard activation
   * of a focused button fires `click`, never `mousedown`. So the engine answers Enter/Space HERE,
   * on the element that actually has focus. ↑/↓ + Enter still run through the input's own handler;
   * these two paths never overlap, because focus is in exactly one of the two places.
   */
  const onListKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-pk-drill],[data-pk-more],[data-pk-pick]');
    if (!el || el.classList.contains('pk-opt-off')) return;
    ev.preventDefault();
    activate(el);
  };
  /**
   * EVERY STRIP AND MENU CONTROL STOPS PROPAGATION BEFORE IT RE-RENDERS, and that ordering is
   * load-bearing. Anything that repaints the strip DETACHES the node that was pressed — a host's
   * document-level "clicked outside?" listener then asks `root.contains(target)` about an orphan,
   * is told no, and closes the popover on the very gesture meant to use it. It cost the chip ✕ a
   * bug; every control since inherits the fix rather than rediscover it.
   */
  const onStripClick = (ev: MouseEvent) => {
    // The select opens on `mousedown` (below) so it matches the group headings beside it. A
    // KEYBOARD activation of the same button fires `click` and never `mousedown` — `detail === 0`
    // is how the two are told apart, and without it Enter would open and then immediately re-close.
    if (!(ev.target as HTMLElement).closest('[data-pk-menu]')) return;
    ev.preventDefault(); ev.stopPropagation();
    if (ev.detail === 0) { if (menu.hidden) openMenu(); else closeMenu(); }
  };
  /** Trap 4: the headings drill on `mousedown`, so the select must open on one too. */
  const onStripDown = (ev: MouseEvent) => {
    if (!(ev.target as HTMLElement).closest('[data-pk-menu]')) return;
    ev.preventDefault(); ev.stopPropagation();
    if (menu.hidden) openMenu(); else { closeMenu(); input.focus(); }
  };
  const MENU_ROW = '[data-pk-go],[data-pk-mback],[data-pk-mclear]';
  const onMenuDown = (ev: MouseEvent) => {
    // The search field is the one thing in here that must keep its native mousedown — it has to
    // take focus and place a caret. Everything else activates on mousedown, matching the group
    // headings, and stops the event before anything repaints.
    const el = (ev.target as HTMLElement).closest<HTMLElement>(MENU_ROW);
    if (!el) return;
    ev.preventDefault(); ev.stopPropagation();
    menuActivate(el);
  };
  /**
   * The menu owns its own keyboard while it is open, and it owns it in TWO places: the search
   * field (where ↓ hands off to the rows and ↵ takes the first one) and a focused row. Every
   * branch stops propagation — the picker's input handler must never see a keystroke aimed at the
   * menu, and Escape in particular must close the MENU without also walking a scope level.
   */
  const onMenuKey = (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement;
    const inSearch = !!t.closest('[data-pk-msearch]');
    // Disabled rows are not in the ring; they are still rendered, which is the whole point.
    const items = Array.from(menu.querySelectorAll<HTMLElement>('.pk-mi:not([disabled])'));
    if (ev.key === 'Escape') {
      // Closes the MENU and nothing else — the picker's own Escape (a level back, then the host)
      // must not fire in the same keystroke that dismissed a menu.
      ev.preventDefault(); ev.stopPropagation();
      closeMenu(); input.focus();
      return;
    }
    if (inSearch) {
      // Typing stays here. Without this the host's own key handling sees a search it does not own.
      ev.stopPropagation();
      if (ev.key === 'ArrowDown') { ev.preventDefault(); items[0]?.focus(); return; }
      if (ev.key === 'Enter') {
        const first = menu.querySelector<HTMLElement>('.pk-mlist [data-pk-go]');
        if (first) { ev.preventDefault(); menuActivate(first); }
      }
      return;
    }
    const at = items.indexOf(t);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!items.length) return;
      ev.preventDefault(); ev.stopPropagation();
      items[(at + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      const el = t.closest<HTMLElement>(MENU_ROW);
      if (!el) return;
      ev.preventDefault(); ev.stopPropagation();
      menuActivate(el);
    }
  };
  /** The menu's search filters the MENU. It must never reach the picker's own input. */
  const onMenuInput = (ev: Event) => {
    const el = (ev.target as HTMLElement).closest<HTMLInputElement>('[data-pk-msearch]');
    if (!el) return;
    ev.stopPropagation();
    mq = el.value.trim().toLowerCase();
    paintMenuItems();
  };
  /** A press anywhere else dismisses the menu — including elsewhere inside the popover. */
  const onDocDown = (ev: MouseEvent) => {
    if (menu.hidden) return;
    const t = ev.target as HTMLElement;
    if (menu.contains(t) || t.closest?.('[data-pk-menu]')) return;
    closeMenu();
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);
  list.addEventListener('mousedown', onListClick);
  list.addEventListener('keydown', onListKey);
  strip.addEventListener('click', onStripClick);
  strip.addEventListener('mousedown', onStripDown);
  menu.addEventListener('mousedown', onMenuDown);
  menu.addEventListener('keydown', onMenuKey);
  menu.addEventListener('input', onMenuInput);
  document.addEventListener('mousedown', onDocDown, true);

  return {
    render,
    reset(next) { input.value = ''; extra = 0; scope = (next || []).slice(); announceScope(); render(); },
    setScope(next) { scope = next.slice(); extra = 0; announceScope(); render(); },
    scope: () => scope.slice(),
    isOpen,
    back,
    destroy() {
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKey);
      list.removeEventListener('mousedown', onListClick);
      list.removeEventListener('keydown', onListKey);
      strip.removeEventListener('click', onStripClick);
      strip.removeEventListener('mousedown', onStripDown);
      menu.removeEventListener('mousedown', onMenuDown);
      menu.removeEventListener('keydown', onMenuKey);
      menu.removeEventListener('input', onMenuInput);
      document.removeEventListener('mousedown', onDocDown, true);
      strip.remove(); foot.remove(); menu.remove();
    },
  };
}
