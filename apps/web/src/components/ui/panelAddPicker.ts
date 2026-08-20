/**
 * panelAddPicker — the ONE picker behind the panel host's ＋.
 *
 * WHY IT EXISTS. The ＋ used to delegate to the FOCUSED panel's own picker, so you could only add
 * what you were already looking at: a record panel offered records, a file panel offered files, and
 * there was no route from one to the other. The founder asked to "add any element (Record |
 * Attachment | Comment)" and the same for schema.
 *
 * NO NEW CONTROL. A dropdown or a tab row of kinds would put a second decision in front of every
 * search, and it would list kinds that matched nothing. The two pieces that already shipped combine
 * into exactly the asked-for behaviour:
 *
 *   1. The picker OPENS pre-scoped to the focused panel's kind — the sensible default for this
 *      panel — drawn as the chip strip's ordinary removable chip.
 *   2. REMOVING that chip widens the search to everything. Kind now varies, so kind becomes the
 *      grouping axis (`pickerSearch`'s one rule: group by the axis that VARIES), and each heading
 *      carries its own count and drills. Five kinds as result groups only appear when they actually
 *      matched something — which is why "Automation | Interface — too much?" stops being a worry.
 *
 * So there is one level of grouping more than before, not one control more, and the two levels are
 * the SAME mechanism: `axis` is a function of scope (kind → the scoped source's own axis).
 *
 * THE ONE CONTROL THAT WAS ADDED, AND WHY IT IS NOT THE ONE THAT WAS DELETED (2026-08-07). The
 * scope row's select opens a NARROWING menu (`pickerSearch`'s THE NARROW RULE): every item in it
 * narrows, at every level. A jump variant shipped for a day and was rejected in the browser — the
 * items carry a drill chevron, and a chevron that scrolls instead of drilling reads as a bug.
 * The kind dropdown deleted on 2026-08-06 was a second rendering of a narrowing THE CHIP ROW
 * ALREADY SHOWED; this menu is not, because the chip row no longer exists and because the groups
 * it lists are the ones NOT on screen — the founder's "if this has a ton of table listings … it'd
 * be nice if you could just instantly jump down into this". Landing inside the group answers that
 * too: there is then nothing left to scroll past.
 *
 * THAT MENU IS NOW THE WHOLE NAVIGATOR (2026-08-07, the founder's second recording). It carries
 * its own search (filtering the MENU, not these results), a Back row and a Search-everything row —
 * so the scope row is one select again — and the select is NEVER inert: at a fully narrowed leaf
 * it offers the leaf's SIBLINGS with the current one marked, which is how `Comments › Contacts`
 * reaches `Comments › Orders` without leaving. All of it lives in `pickerSearch.ts`; the only
 * thing this file owes the menu is `menuIcon`, per level, out of the one glyph mapping.
 *
 * THE ROOT LIST IS THE AREA'S OWN ELEMENTS (2026-08-08, Dan). It used to be every source every
 * mounted kind registered, which made it an accident of component mounting rather than a statement
 * about the page: `/schema` offered Records and Comments because RecordPanel is mounted there for
 * the record drawer. It is now declared per area in `AREA_SOURCES` — Schema offers Schema ·
 * Automations · Interfaces, Data offers Records · Comments · Attachments, and Backups is offered
 * nowhere, because a run is not an element of a Space's data but the thing that captured it.
 *
 * A SOURCE IS NOT A PANEL KIND. A kind contributes its rows through `PanelKind.pickerSources`, and
 * it may contribute more than one: `record:` contributes **Records** and **Comments**, because a
 * comment thread lives INSIDE the record panel — picking a comment opens its record with that
 * comment focused (`data:openRecord { commentId, focus: 'comments' }`), which is the route that
 * already existed. Nothing here creates a `comment:` panel kind, and nothing should.
 */
import { createPickerSearch, type PickerRow, type PickerSearch, type ScopeLevel } from './pickerSearch';
import { placePopover } from './popoverPlace';
import { panelKinds } from './panelHostRegistry';
import { entityIconClass } from '../schema/entityIcon';

/** The facet key every source's rows carry, and the picker's outer grouping axis. */
export const SRC_FACET = 'type';

/**
 * SOURCE GLYPHS. `PickerSource` carries no icon — the four files that register sources are not
 * part of this change — so the mapping lives here, and NOTHING in it is new art: every value is
 * either `schema/entityIcon.ts` (the app's one concept-glyph map, which already answers for
 * record / asset / automation / interface) or the glyph the surface itself already wears. A
 * comment and a backup have no entity kind, so they borrow the Data page's own tab glyphs, and
 * `Schema` borrows the `Schema` backup-kind badge. If `entityIcon.ts` ever grows `comment` and
 * `run`, this table should shrink to a single `entityIconClass` call.
 */
const SRC_ICON: Record<string, string> = {
  record: entityIconClass('record'),
  comment: 'lucide--message-square-text', // Data → Comments tab
  asset: entityIconClass('asset'),
  run: 'lucide--history',                 // Data → Changelog tab
  entity: 'lucide--list-tree',            // the `Schema` backup-kind badge
  automation: entityIconClass('automation'),
  interface: entityIconClass('interface'),
};

/**
 * WHAT THE PICKER OPENS ON — the ACTIVE TAB, where the tab has a source of its own (2026-08-07).
 *
 * The opening scope used to be the focused panel's kind, full stop. Internally consistent — on the
 * Comments tab a row opens a RECORD panel, so it offered records — and it answered a question the
 * user did not ask: `/schema?tab=automations` opened on `Schema › Sales CRM`, which makes an
 * automation the one thing that tab cannot reach without clearing the scope first.
 *
 * The rule: THE ACTIVE TAB WINS WHERE IT MAPS TO EXACTLY ONE SOURCE. Otherwise nothing changes and
 * the focused panel still decides.
 *
 * IT IS A TABLE, AND IT HAS TO BE. Tab keys and source keys are two vocabularies that merely happen
 * to share words today — `attachments` → `asset`, `browse` → `record`, and `browse` means something
 * different on each of the two pages, which is why the key is `section/tab` and not `tab`. Fuzzy
 * matching two vocabularies that can drift would open the picker on the wrong population with no
 * error anywhere; here an unmapped tab is a documented no-op, and a mapped tab whose source no kind
 * on this page registers warns instead of silently falling through.
 *
 * The tabs deliberately ABSENT are Schema's Browse · Visualize · Relationships · Health · Docs ·
 * Chat: they all live under the single `entity` source and each shows bases, tables and fields at
 * once, so there is no one source to prefer and the focused panel remains the better guess.
 *
 * BOUNDARY — OPEN ONLY. This is read inside `defaultScope()`, which is called from exactly one
 * place: `open()`'s `pk.reset(...)`. Nothing re-scopes a picker that is already open. A user who
 * cleared the scope to search everything and then switched tabs keeps their choice — a control that
 * overrides an explicit decision is worse than one that guesses badly.
 *
 * BOUNDARY — `pinned` IS UNCHANGED. The levels below are pinned exactly as the old default was, so
 * this is a different VALUE in the same slot, not a new kind of state, and `isOpen()` stays false at
 * rest. Nothing here reads `scope.length`.
 */
const TAB_SOURCE: Record<string, string> = {
  // `${data-ph-section}/${data-tab}` → PickerSource.key
  'schema/automations': 'automation',
  'schema/interfaces': 'interface',
  'data/browse': 'record', // the tab is LABELLED "Records"; its key stayed `browse`
  'data/comments': 'comment',
  'data/attachments': 'asset',
  // `data/changelog` DELIBERATELY MAPS TO NOTHING (2026-08-08). It used to open on `run` — a
  // changelog entry does belong to a backup run — but `run` is `Backups`, and Data no longer OFFERS
  // Backups (see `AREA_SOURCES`). Keeping the mapping alive for this one tab would put Backups back
  // into Data through a side door, which is exactly what the founder asked to remove. So the ＋ on
  // Changelog opens UNSCOPED, which is the honest answer: the area has nothing to prefer here.
};

/**
 * WHAT THE ＋ OFFERS, PER AREA — the DATA ELEMENTS of the area you are standing in (Dan, 2026-08-08:
 * "inside schema I shouldn't see records or comments … this top-level list should be just what's
 * relevant to the area we're in").
 *
 * IT IS A RULE, NOT THREE DELETIONS. `sources()` used to flatMap every kind mounted on the page, so
 * the root list was an accident of which components happened to register — Schema offered records
 * and comments because RecordPanel is mounted there for the record drawer, not because /schema is
 * about records. The rule is: an AREA declares its own elements, and only those are offered; a new
 * area adds one row here rather than a special case in the code below.
 *
 * ORDER IS THE LIST'S ORDER. It replaces "kind-registration order", which was the order the page
 * happened to mount its components in — a second list that could drift from this one.
 *
 * BACKUPS APPEARS IN NO AREA, and that is the point (`run` is the Backups source). A run is not an
 * element of a Space's data; it is the thing that captured it, and it has its own section.
 *
 * AN UNDECLARED SECTION KEEPS TODAY'S BEHAVIOUR — every source it mounts. `/reports` mounts this
 * host too and was not part of this change; a table that silently emptied a picker on a page nobody
 * looked at would be worse than one that only speaks where it was measured.
 *
 * AND THEN A SECOND BAND: WHAT ELSE IS WORTH OPENING FROM HERE (2026-08-08, Dan, the same day's
 * second recording — *"we probably should also include the schema items. Maybe there's a line
 * separator and then it shows schema automations interfaces since those can be open"*). Working on
 * a record, you may want that table's structure open beside it. So the rule is no longer "only the
 * area's own elements"; it is **the area's own elements first, then what else is worth opening from
 * here, separated** — `own` and `also`, drawn with a `divider` between them (`menuBreak`).
 *
 * ONE DIRECTION ONLY, AND DELIBERATELY ASYMMETRIC. Schema entities appear in Data; data elements do
 * NOT appear in Schema. Dan asked for one and said nothing about the other, and the asymmetry holds
 * up on its own: in Data you are working and may want structure as context, in Schema you are
 * inspecting structure and do not need rows. Do not add the reverse for symmetry's sake.
 *
 * `Backups` (`run`) is still offered NOWHERE, in either band.
 */
const AREA_SOURCES: Record<string, { own: string[]; also?: string[] }> = {
  // `data-ph-section` → the PickerSource keys that area offers, in the order they are offered.
  // `own` = this area's own elements. `also` = openable from here, below the separator.
  schema: { own: ['entity', 'automation', 'interface'] },
  data: { own: ['record', 'comment', 'asset'], also: ['entity', 'automation', 'interface'] },
};

/** One searchable population offered by the ＋. */
export interface PickerSource {
  /** Stable key — the facet value, and the namespace its ids are handed back under. */
  key: string;
  /**
   * Heading + chip text, e.g. `Records`. A FUNCTION because a source may have to say how it is
   * already narrowed (the Attachments listing's own filter is a narrowing this picker inherits
   * but does not own, so it names it rather than pretending to offer the whole set).
   */
  label: () => string;
  /**
   * The facet this source groups by ONCE the picker is scoped to it.
   *
   * A FUNCTION when the source has more than one level of its own (2026-08-08). Attachments live
   * inside FIELDS, and that level did not exist: the picker went `root → table → files`, so the
   * only way to reach one field's files was to read every file in the table. It is now
   * `root → table → field → files`, and the "stay at this table" state is not replaced — it IS the
   * table level, which lists every field with its files under it.
   *
   * This is the SAME mechanism `panelAddPicker` already uses one level up (`axis` is a function of
   * scope: kind → the scoped source's axis), applied once more inside a source, rather than a new
   * kind of level.
   */
  axis: string | ((scope: ScopeLevel[]) => string);
  /**
   * Heading for one value of `axis`. `axis` is passed because a source may HAVE more than one (see
   * above) — a source with a constant axis ignores the second argument.
   */
  groupLabel: (value: string, axis: string) => string;
  /** Chip text for a drill on `axis`. Defaults to `groupLabel`. */
  scopeLabel?: (value: string, axis: string) => string;
  /** Explicit order for `axis` values. Omit for first-appearance order. */
  groupOrder?: (a: string, b: string) => number;
  /** Candidate rows. Ids are namespaced by the engine, so they only have to be unique HERE. */
  rows: () => PickerRow[];
  /**
   * The narrowing this source opens with when the ＋ defaults to it — the focused panel's own
   * base. Levels are appended BENEATH the kind chip and are `pinned`, so they read as "where you
   * already are" rather than a filter somebody set, and removing the kind chip drops them with it
   * (`pickerSearch`'s `prune`: a level does not survive the level it hung off).
   *
   * This restores what the record picker had before the ＋ was unified: it opened pinned to the
   * focused panel's base with an `All bases ⇄ this base` toggle. Dropping it left a multi-base
   * Space with no way to scope to a base at all.
   */
  defaultScope?: () => ScopeLevel[];
  /** Open one of this source's rows, beside the focused panel. */
  open: (id: string) => void;
}

export interface PanelAddPicker {
  /** Open, scoped to the focused panel's kind, anchored to the ＋'s viewport rect. */
  open(anchorRect: DOMRect): void;
  close(): void;
  isOpen(): boolean;
}

export function createPanelAddPicker(opts: {
  pop: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  /** The prefix of the kind the ＋ should default to — the focused panel's. */
  focusedKind: () => string | null;
  /** The host's section name (`data-ph-section`), the first half of the `TAB_SOURCE` key. */
  section: string;
}): PanelAddPicker {
  const { pop, input, list, focusedKind, section } = opts;

  /**
   * What the ＋ OFFERS on this page: the area's declared elements (`AREA_SOURCES`), in the order the
   * area declares them, intersected with what is actually registered here. An area that declares a
   * source no kind on this page registers simply does not show it — the area names an intent, the
   * registry answers whether it can be served, and neither has to know about the other.
   */
  const registered = (): PickerSource[] => panelKinds().flatMap((k) => k.pickerSources?.() ?? []);
  /** The area's second band — what else is worth opening from here. Empty for an area with none. */
  const alsoKeys = (): string[] => AREA_SOURCES[section]?.also ?? [];
  const sources = (): PickerSource[] => {
    const all = registered();
    const want = AREA_SOURCES[section];
    if (!want) return all;
    return [...want.own, ...(want.also ?? [])]
      .map((key) => all.find((s) => s.key === key))
      .filter((s): s is PickerSource => !!s);
  };
  const byKey = (key: string) => sources().find((s) => s.key === key) || null;
  /** A source's axis at a given scope — see `PickerSource.axis`. */
  const axisOf = (s: PickerSource, sc: ScopeLevel[]) => (typeof s.axis === 'function' ? s.axis(sc) : s.axis);
  /** The source the picker is currently scoped to, or null while it is searching everything. */
  const scoped = (sc: ScopeLevel[]) => byKey(sc.find((s) => s.key === SRC_FACET)?.value || '');
  /**
   * The active tab's source, or null when this page has no tab bar, no tab is active, or the active
   * tab is not in `TAB_SOURCE`. Read from the DOM, NOT from `?tab=`: `sectionTabs` writes the param
   * only when a tab CHANGES, so on a first load with no query the URL is silent while a
   * server-rendered landing tab is genuinely active — the URL's absence is not the tab's absence.
   * `.sch-tabbar` scopes the query to the SECTION tab bar, so a tab bar inside a panel could never
   * answer for the page.
   */
  const tabSource = (): PickerSource | null => {
    const tab = document.querySelector<HTMLElement>('.sch-tabbar [data-tab].tab-active')?.dataset.tab;
    if (!tab) return null;
    const key = TAB_SOURCE[`${section}/${tab}`];
    if (!key) return null;
    const s = byKey(key);
    // A mismatch is a registration bug on this page — degrade to unscoped rather than warn in prod.
    return s;
  };
  /**
   * The pre-tab default, and still the answer for every tab that maps to no single source.
   *
   * IT GOES THROUGH `byKey`, i.e. through what the area OFFERS (2026-08-08). A run panel focused on
   * `/data` would otherwise open the picker on a `Backups` scope the root list no longer contains —
   * a path naming a place there is no way back to. Unoffered → no default → the picker opens
   * unscoped, which is the same answer Changelog gets from `TAB_SOURCE`.
   */
  const focusedSource = (): PickerSource | null => {
    const pre = focusedKind();
    const s = pre ? panelKinds().find((k) => k.prefix === pre)?.pickerSources?.()[0] : null;
    return (s && byKey(s.key)) || null;
  };
  /**
   * The opening default: the active tab's source where it has one, else the focused panel's kind,
   * plus whatever narrowing that source opens with (its base). Both levels are `pinned` — the
   * picker opened with them, the user did not choose them.
   */
  const defaultScope = (): ScopeLevel[] => {
    const s = tabSource() || focusedSource();
    if (!s) return [];
    return [
      { key: SRC_FACET, value: s.key, label: s.label(), pinned: true },
      ...(s.defaultScope?.() ?? []).map((l) => ({ ...l, pinned: true })),
    ];
  };

  let pk!: PickerSearch;
  const now = () => (pk ? pk.scope() : []);

  pk = createPickerSearch({
    input,
    list,
    // Kind until a kind is chosen, then that source's own axis. ONE engine, two levels.
    axis: (sc) => { const s = scoped(sc); return s ? axisOf(s, sc) : SRC_FACET; },
    emptyText: 'Nothing matches.',
    pickHint: 'open',
    rows: () => {
      // Only the scoped source is asked for rows: the others cannot appear, and a source's `rows()`
      // reads live DOM or a snapshot. Unscoped, every source is asked — which is the point.
      const only = scoped(now());
      const list_ = only ? [only] : sources();
      return list_.flatMap((s) =>
        s.rows().map((r): PickerRow => ({
          ...r,
          id: `${s.key}:${r.id}`,
          facets: { ...r.facets, [SRC_FACET]: s.key },
        })),
      );
    },
    groupLabel: (v) => { const sc = now(); const s = scoped(sc); return s ? s.groupLabel(v, axisOf(s, sc)) : byKey(v)?.label() ?? v; },
    scopeLabel: (v) => {
      const sc = now();
      const s = scoped(sc);
      if (!s) return byKey(v)?.label() ?? v;
      return (s.scopeLabel || s.groupLabel)(v, axisOf(s, sc));
    },
    groupOrder: (a, b) => {
      const s = scoped(now());
      if (s) return s.groupOrder ? s.groupOrder(a, b) : 0;
      // Unscoped the groups ARE the sources, so their order is the order the AREA declares them in
      // (`AREA_SOURCES`) — one list, read here and by `rows()`, rather than a second that could
      // drift from it. Before 2026-08-08 it was the order the page happened to mount its kinds in.
      const keys = sources().map((x) => x.key);
      return keys.indexOf(a) - keys.indexOf(b);
    },
    placeholder: (sc) => {
      const s = scoped(sc);
      if (!s) return 'Search everything…';
      // The DEEPEST level the user actually narrowed to, not "the level keyed on the current axis":
      // once a source has two levels of its own (Attachments' table → field) the current axis names
      // the level BELOW you, which is the one thing you have not chosen yet. `base` is excluded
      // because it is the pinned "where you already are", and it never appeared here.
      const sub = [...sc].reverse().find((x) => x.key !== SRC_FACET && x.key !== 'base');
      const what = s.label().toLowerCase();
      return sub ? `Search ${what} in ${sub.label}…` : `Search ${what}…`;
    },
    // Scope's zero value, and a STATE rather than an absence: the row still reads `IN Everything`
    // with nothing chosen. Its old chevron — which narrowed to `defaultScope()` and said so only
    // in a tooltip — is gone with `zeroScope`; the way back to this panel's own kind is now the
    // menu, which names the kind out loud.
    zeroLabel: () => 'Everything',
    // `lucide--layers` for the zero value, the whole set; otherwise the scoped source's own glyph.
    scopeIcon: (sc) => { const s = scoped(sc); return s ? SRC_ICON[s.key] || 'lucide--circle' : 'lucide--layers'; },
    // Per level: the groups ARE the sources at the top, and inside a source they are values of
    // that source's axis. `kind` values are entity kinds, so the one mapping answers directly;
    // `table` is a table whatever the value; `month` has no concept glyph and gets none.
    menuIcon: (v, sc) => {
      const s = scoped(sc);
      if (!s) return SRC_ICON[v] || 'lucide--circle';
      const a = axisOf(s, sc);
      if (a === 'kind') return entityIconClass(v);
      if (a === 'table') return entityIconClass('table');
      // The field level (Attachments). A file that hangs off NO field is the one honest exception —
      // it borrows the comment glyph the listing's own field grouping gives it, rather than wearing
      // a field icon for a field it does not have.
      if (a === 'field') return v ? entityIconClass('field') : SRC_ICON.comment!;
      return '';
    },
    // The separator between the area's OWN elements and what else is openable from here — only at
    // the root, where the menu's values ARE the sources. Inside a source the values are that
    // source's own axis (tables, fields, months) and there are no bands to draw.
    menuBreak: (v, sc) => !scoped(sc) && alsoKeys().includes(v),
    // The engine's escape hatch out of the opening kind — see `ElsewhereOpts` in pickerSearch.ts.
    // `rows` asks EVERY source, deliberately unlike `rows()` above, which asks only the scoped one:
    // this block exists precisely to see the kinds the scope is hiding.
    elsewhere: {
      key: SRC_FACET,
      rows: () => sources().flatMap((s) =>
        s.rows().map((r): PickerRow => ({ ...r, id: `${s.key}:${r.id}`, facets: { ...r.facets, [SRC_FACET]: s.key } }))),
      label: (v) => byKey(v)?.label() ?? v,
      order: (a, b) => { const keys = sources().map((x) => x.key); return keys.indexOf(a) - keys.indexOf(b); },
    },
    onPick: (wrapped) => {
      const i = wrapped.indexOf(':');
      byKey(wrapped.slice(0, i))?.open(wrapped.slice(i + 1));
      close();
    },
    onEscapeExhausted: () => close(),
  });

  function open(r: DOMRect) {
    // ORDER IS LOAD-BEARING, and it was wrong. Unhide first so the element can be measured — but
    // then RESET, because `reset` repaints the list, and only after that place it. Placing before
    // the repaint measured the PREVIOUS open's content (and nothing at all on the first open),
    // which is the "measure the element, never restate it" rule `placePopover` exists to enforce,
    // broken by ordering rather than by a literal.
    pop.hidden = false;
    pk.reset(defaultScope());
    placePopover(pop, r);
    setTimeout(() => input.focus(), 0);
  }
  function close() { pop.hidden = true; }

  return { open, close, isOpen: () => !pop.hidden };
}
