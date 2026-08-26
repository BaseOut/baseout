/**
 * The platform picker's controller — one behaviour for every surface that asks "which platforms".
 *
 * IN A `.ts` FILE, NOT AN INLINE `<script>`: `astro check` never walks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 *
 * ONE SEMANTICS, TWO OWNERS OF STATE. Every picker is a multi-select over checkboxes. What differs
 * is where the answer is kept.
 *
 *   `state="shared"` reads and writes THE ONE STORED PREFERENCE. Setting it in the sidebar has to
 *     repaint the search modal and the chat live, with no reload, and narrow the sidebar on the next
 *     page opened.
 *   `state="local"` keeps the set on its own element and announces it with a `pk:change` event
 *     carrying the ids that are on. The roadmap is the only caller.
 *
 * WHY THE ROADMAP IS LOCAL. The board draws all five platform IDENTITIES; the documentation
 * surfaces draw only the platforms that have pages, three of the five. If a board click wrote
 * `{smartsheet}` into the shared preference, the docs sidebar would repaint to a filter naming a
 * platform it renders no row for: nothing there could turn Smartsheet back off. A stored,
 * cross-page preference is also the wrong lifetime for "which requests am I reading right now".
 *
 * NOTHING TICKED IS NO FILTER — 2026-08-21, AND IT REPLACED A LOCK. The last surviving platform
 * used to refuse to switch off, because an empty set meant a manual filtered to nothing. Oleh:
 * turn them all on, turn them all off, and we do not need two extra states. So an empty selection
 * now means exactly what it means in every other checkbox filter — nothing narrowed, everything
 * shown — and the inert row, the hint sentence, the `aria-disabled` state and the guard in `commit`
 * that together described the old rule are all gone.
 *
 * THREE STATES IN STORAGE, TWO OF WHICH FILTER IDENTICALLY, and the distinction is worth its cost:
 *
 *   NEVER CHOSEN — no key. Every row is ticked, which is what the server-rendered markup already
 *     says and what a first-time reader should meet: a control whose boxes are full is one you
 *     narrow by unticking, which is the affordance this control wants.
 *   EXPLICITLY NOTHING — the key holds `[]`. Every row is empty, because a reader who pressed
 *     `None` must find their ticks where they left them and not be quietly re-ticked by us.
 *   A NARROWED SET — the key holds those ids.
 *
 * The first two produce the SAME VIEW everywhere: nothing is hidden. They are distinguishable only
 * in this control's own boxes, which is the only place the difference means anything.
 *
 * WHAT THE CONSUMERS SEE IS THE EFFECTIVE SET, NEVER THE EMPTY ONE. `lib/platform-filter.ts`,
 * `lib/search-modal.ts` and `lib/chat-panel.ts` each ask "which platforms may I show", and the
 * honest answer to that question when nothing is ticked is ALL OF THEM. So an empty selection is
 * broadcast to them as `PLATFORM_IDS`, and every "is a filter active" test they already own —
 * `on.size === PLATFORM_IDS.length` in the sidebar, which governs both the `Show all` reset and the
 * per-page notice — reads inactive without a line changing in any of those files. `[]` in storage
 * reaches them the same way: `readPlatformPreference` already coalesces an empty stored array to
 * null and `currentPlatforms` already turns null into every id.
 *
 * WHICH IS WHY THIS FILE READS STORAGE ITSELF rather than through `currentPlatforms()`. That helper
 * answers the consumers' question, and it is right to flatten "none" into "all" for them. This
 * control needs the finer reading — one key, two readers, no second stored truth.
 *
 * AND WHY THE SHARED PICKERS SYNC THROUGH THIS MODULE rather than through `FILTER_EVENT`. The event
 * carries the EFFECTIVE set, so a picker listening to it would repaint an explicit "none" as "all"
 * the moment it was set. The module keeps the selection, the pickers repaint from the module, and
 * the event stays what it has always been: what the rest of the site should show. A foreign write
 * (the sidebar's `Show all`, the search modal's clear, `platform-start.ts`) still arrives through
 * `onPlatformsChange` and still moves every picker.
 *
 * `?platform=` IS UNCHANGED AND CANNOT EXPRESS "EXPLICITLY NONE". It does not need to: a URL
 * carries a VIEW, and the view for an empty selection is the unnarrowed one, which a link with no
 * `platform` parameter already says — and `mirrorUrl` in `lib/platform-filter.ts` already deletes
 * the parameter whenever the effective set is everything. What a URL cannot carry is where the
 * recipient's ticks should sit, which is a fact about the sender's control and not about the page.
 *
 * A MOUSEDOWN IN THE LIST THAT IS NOT ON THE INPUT HAS ITS DEFAULT PREVENTED, and that one line is
 * what made the whole row clickable. The row is a `<label>` wrapping the input, so the markup was
 * always correct and a synthetic `.click()` on the name always toggled it. A TRUSTED click did not.
 * A label is not focusable, so a real mousedown on the name or the glyph moved focus off the
 * checkbox `openList` had focused, out to `<body>`; that fired `focusout` with a null
 * `relatedTarget`; the guard below read it as "the reader tabbed away" and hid the list BETWEEN
 * mousedown and mouseup. There was then no label under the pointer to forward anything, so the
 * click landed on whatever the popover had been covering and nothing toggled. Preventing the
 * default keeps focus where it is, so no `focusout` fires and the label forwards its click. It is
 * also what lets `All` and `None` act without closing the list under the pointer that pressed them.
 *
 * THE LIST IS NOT A `popover` AND NOT A `<dialog>`. Both put the element in the top layer, which
 * would solve clipping for free — and both take the Escape key through the platform's close-request
 * path, which this control cannot afford: one of its homes is INSIDE the search `<dialog>` and
 * another is inside a chat drawer that closes itself on Escape from a `document` listener. So
 * Escape is handled here, explicitly, and stopped from travelling: `preventDefault` is what keeps
 * the dialog open, `stopPropagation` is what keeps the chat open, and `chat-panel.ts` carries a
 * matching guard for the same reason it already carries one for the page-contents popover.
 */
import {
  FILTER_EVENT,
  FILTER_KEY,
  PLATFORMS,
  PLATFORM_IDS,
  onPlatformsChange,
  samePlatforms,
  writePlatformPreference,
  type PlatformId,
} from './platforms';

/**
 * A per-document counter for instance ids. It has to live in a module: an `.astro` frontmatter
 * block re-executes for every instance, so a counter declared beside the markup resets each time
 * and hands out `1` forever. Same trap, same fix, as `nextMarkToken` in `lib/platforms.ts`.
 */
let seq = 0;
export const nextPickerToken = (): string => String(++seq);

/** Above this many selected, the trigger stops drawing marks and lets the count carry the state. */
const MAX_TRIGGER_MARKS = 4;

/**
 * Fired on the picker's own root, and bubbling, when a `state="local"` picker changes. `detail` is
 * the array of platform ids that are ON, in catalogue order, AND IT CAN NOW BE EMPTY — which means
 * no filter, not "nothing matches". `lib/board.ts` reads it that way (`plat.length === 0` is its
 * `anyPlat`), the same test it already applied to "all of them".
 */
export const PICKER_EVENT = 'pk:change';

const isPlatform = (v: string): v is PlatformId => (PLATFORM_IDS as string[]).includes(v);

const nameOf = (id: string): string => PLATFORMS.find((p) => p.id === id)?.name ?? id;

/** "Airtable", "Airtable and Notion", "Airtable, ClickUp and Notion". */
function listNames(ids: string[]): string {
  const names = ids.map(nameOf);
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/* ── The shared selection ─────────────────────────────────────────────────────────────────────
   One value for every `state="shared"` picker on the page. `null` is "never chosen"; an empty Set
   is "explicitly nothing", and the two are different ticks and the same view. See the header. */

let sharedSel: Set<PlatformId> | null | undefined;
const sharedPickers = new Set<() => void>();
/** True while this module is the one dispatching, so its own broadcast is not read back in. */
let selfWrite = false;

function readSharedSelection(): Set<PlatformId> | null {
  /* `?platform=` BEATS STORAGE, the precedence `lib/platforms.ts` sets and for its reason: a link
     that names its platforms is somebody sending a colleague to a specific view. */
  const fromUrl = new URLSearchParams(window.location.search).get('platform');
  if (fromUrl) {
    const ids = fromUrl
      .split(',')
      .map((s) => s.trim())
      .filter(isPlatform);
    if (ids.length) return new Set(ids);
  }
  try {
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    /* NOT COALESCED TO NULL, and that is the whole difference from `readPlatformPreference`: an
       empty array here is the reader having pressed `None`, which is a choice and not an absence. */
    return new Set(parsed.filter((v): v is PlatformId => typeof v === 'string' && isPlatform(v)));
  } catch {
    return null;
  }
}

function sharedSelection(): Set<PlatformId> | null {
  if (sharedSel === undefined) sharedSel = readSharedSelection();
  return sharedSel;
}

function setSharedSelection(next: Set<PlatformId>): void {
  sharedSel = next;
  selfWrite = true;
  try {
    /* Stores the truth. When it is empty this also dispatches an empty payload, which
       `onPlatformsChange` drops on the floor by design — so the effective set follows it. */
    writePlatformPreference(next);
    if (!next.size) {
      document.dispatchEvent(
        new CustomEvent(FILTER_EVENT, { detail: [...PLATFORM_IDS] }),
      );
    }
  } finally {
    selfWrite = false;
  }
  for (const repaint of sharedPickers) repaint();
}

export function mountPlatformPickers(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-platform-picker]');
  if (!roots.length) return;

  for (const root of roots) {
    /* Astro hoists a component's `<script>` once per page however many instances render, but a
       surface that is portalled and re-scanned would otherwise be wired twice. */
    if (root.dataset.pkReady === '') continue;
    root.dataset.pkReady = '';
    wireOne(root);
  }

  wireGlobalOnce();
}

function wireOne(root: HTMLElement): void {
  const shared = root.dataset.pkState !== 'local';
  const label = root.dataset.pkLabel ?? 'Platforms';

  const trigger = root.querySelector<HTMLButtonElement>('[data-pk-trigger]');
  const pop = root.querySelector<HTMLElement>('[data-pk-pop]');
  const opts = Array.from(root.querySelectorAll<HTMLInputElement>('[data-pk-opt]'));
  const marks = Array.from(root.querySelectorAll<HTMLElement>('[data-pk-mark]'));
  const stateEl = root.querySelector<HTMLElement>('[data-pk-state]');
  const allBtn = root.querySelector<HTMLButtonElement>('[data-pk-all]');
  const noneBtn = root.querySelector<HTMLButtonElement>('[data-pk-none]');

  /* THE IDS THIS INSTANCE ACTUALLY DREW, taken off the markup rather than off the catalogue. The
     three documentation surfaces draw only the platforms that have pages, so a count or an "all"
     derived from `PLATFORM_IDS` describes rows the reader cannot see — which it once did, and the
     trigger said "4 of 5" after unticking one of three visible rows. */
  const ids: PlatformId[] = opts
    .map((el) => el.dataset.pkOpt ?? '')
    .filter(isPlatform);

  /** A local picker's own selection. Shared pickers read the module instead. */
  let localOn: Set<PlatformId> = new Set(ids);

  /** The ids of THIS control that are currently on. Never null: "never chosen" means all of them. */
  function chosen(): PlatformId[] {
    if (!shared) return ids.filter((id) => localOn.has(id));
    const sel = sharedSelection();
    return sel === null ? [...ids] : ids.filter((id) => sel.has(id));
  }

  function paint(): void {
    const on = chosen();
    /* BOTH ENDS ARE THE SAME VIEW. Everything ticked narrows to nothing, and nothing ticked narrows
       to nothing; the trigger says so with one sentence rather than teaching the reader that "0
       selected" secretly means "all of them". */
    const unfiltered = on.length === 0 || on.length === ids.length;
    const onSet = new Set(on);

    for (const opt of opts) {
      opt.checked = onSet.has((opt.dataset.pkOpt ?? '') as PlatformId);
    }

    /* The end you are already at has nothing to do. Announced rather than removed — see the CSS. */
    allBtn?.toggleAttribute('aria-disabled', on.length === ids.length);
    noneBtn?.toggleAttribute('aria-disabled', on.length === 0);

    /* THE COLLAPSED STATE HAS TO BE LEGIBLE WITHOUT OPENING IT. At rest it says so in words; once
       narrowed the marks carry it, because the mark is what a reader recognises before they read.
       Past four selected the marks stop being a row and start being a smear, so the count takes
       over on its own. */
    const showMarks = !unfiltered && on.length <= MAX_TRIGGER_MARKS;
    for (const m of marks) {
      m.hidden = !showMarks || !onSet.has((m.dataset.pkMark ?? '') as PlatformId);
    }

    const text = unfiltered
      ? 'All platforms'
      : on.length === 1
        ? nameOf(on[0]!)
        : `${on.length} of ${ids.length}`;
    if (stateEl) stateEl.textContent = text;

    /* The accessible name carries what the marks carry, and names them rather than counting them
       while a list is still short enough to be worth hearing. */
    const spoken = unfiltered
      ? `all ${ids.length} platforms`
      : on.length <= 3
        ? listNames(on)
        : `${on.length} of ${ids.length} platforms`;
    trigger?.setAttribute('aria-label', `${label}: ${spoken}`);
  }

  /**
   * Takes this control's next selection and puts it wherever this control's answer lives.
   *
   * A SHARED PICKER MAY NOT SPEAK FOR THE ROWS IT DOES NOT DRAW, so the ids outside its catalogue
   * are carried over from the stored value untouched — except at the two ends, where carrying them
   * would make this control lie about itself.
   *
   *   EVERY ROW OFF is written as the empty set rather than as the remnants. `{smartsheet, monday}`
   *     is not empty, so it would have filtered the sidebar to nothing while the reader looked at
   *     three empty boxes they had just been told mean "no filter".
   *   EVERY ROW ON is written as the whole catalogue rather than as the three documented ids. Those
   *     three ARE everything this reader can be shown — no page carries the other two — so the
   *     states are identical to look at, and only one of them reads as unfiltered to the surfaces
   *     that test `size === PLATFORM_IDS.length`. Writing the narrow one left the sidebar's `Show
   *     all` reset offering a way out of a filter that was hiding nothing.
   */
  function commit(next: Set<PlatformId>): void {
    if (!shared) {
      if (samePlatforms(next, localOn)) return;
      localOn = next;
      paint();
      /* Bubbling, because the consumer is the page rather than this element's parent. `detail` is
         an array and not the Set: a Set in a CustomEvent is fine in the DOM and awkward in a test,
         and catalogue order is a fact the consumer would otherwise have to reconstruct. */
      root.dispatchEvent(
        new CustomEvent(PICKER_EVENT, {
          detail: ids.filter((id) => next.has(id)),
          bubbles: true,
        }),
      );
      return;
    }

    const sel = sharedSelection();
    const merged = sel === null ? new Set<PlatformId>(PLATFORM_IDS) : new Set(sel);
    for (const id of ids) {
      if (next.has(id)) merged.add(id);
      else merged.delete(id);
    }
    const target = !ids.some((id) => merged.has(id))
      ? new Set<PlatformId>()
      : ids.every((id) => merged.has(id))
        ? new Set<PlatformId>(PLATFORM_IDS)
        : merged;
    if (sel !== null && samePlatforms(target, sel)) return;
    setSharedSelection(target);
  }

  /** The selection implied by the boxes as they stand, for a change that toggles exactly one. */
  const currentSet = (): Set<PlatformId> => new Set(chosen());

  if (shared) {
    sharedPickers.add(paint);
  }

  /* The way back to an unfiltered view for a surface that draws its own "show everything" control —
     the board's amber notice does, because the notice is what told the reader they had narrowed.
     It goes through `commit`, so a reset is the same path as a click. */
  SET_ALL.set(root, () => commit(new Set(ids)));

  for (const opt of opts) {
    opt.addEventListener('change', () => {
      const id = opt.dataset.pkOpt;
      if (!id || !isPlatform(id)) return;
      const next = currentSet();
      if (opt.checked) next.add(id);
      else next.delete(id);
      commit(next);
    });
  }

  allBtn?.addEventListener('click', () => commit(new Set(ids)));
  noneBtn?.addEventListener('click', () => commit(new Set<PlatformId>()));

  if (trigger && pop) {
    /* THE LINE THAT MAKES THE ROW CLICKABLE. See the header: without it a trusted mousedown on the
       name, the glyph or the row's padding moves focus to `<body>`, the `focusout` guard below
       closes the list, and the click never reaches the label. The input is excluded so the native
       checkbox keeps its own focus and activation behaviour untouched. */
    pop.addEventListener('mousedown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      e.preventDefault();
    });

    trigger.addEventListener('click', () => {
      if (pop.hidden) openList(root, trigger, pop);
      else closeList(root, trigger, pop, true);
    });

    /* Escape is handled here and stopped from travelling. `preventDefault` is what stops the search
       `<dialog>` closing underneath this list; `stopPropagation` is what stops the chat drawer's
       own `document` listener closing the whole conversation because somebody dismissed a menu. */
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || pop.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      closeList(root, trigger, pop, true);
    });

    /* Tabbing off the end of the list closes it without stealing focus back — the reader is on
       their way somewhere and a control that yanks them back is worse than one left open. */
    root.addEventListener('focusout', (e) => {
      if (pop.hidden) return;
      const next = e.relatedTarget;
      if (next instanceof Node && root.contains(next)) return;
      closeList(root, trigger, pop, false);
    });
  }

  paint();
}

function openList(root: HTMLElement, trigger: HTMLButtonElement, pop: HTMLElement): void {
  pop.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  open.add(root);
  pop.querySelector<HTMLInputElement>('input')?.focus();
}

function closeList(
  root: HTMLElement,
  trigger: HTMLButtonElement,
  pop: HTMLElement,
  refocus: boolean,
): void {
  pop.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  open.delete(root);
  if (refocus) trigger.focus();
}

/** Every open list on the page, so Escape and an outside click have one place to look. */
const open = new Set<HTMLElement>();

/**
 * One "turn everything back on" closure per mounted picker. A `WeakMap` rather than an exported
 * mutable list: the entry dies with the element, so a surface that removes its picker leaves
 * nothing behind to be called against a detached node.
 */
const SET_ALL = new WeakMap<HTMLElement, () => void>();

/**
 * Put a picker back to every platform it draws. For a surface whose own chrome offers a way out of
 * a narrowed view — the board's amber `Show all` — so that route is the picker's own code path
 * rather than a second copy of the rule that would fall out of step with it.
 */
export function resetPickerPlatforms(root: HTMLElement): void {
  SET_ALL.get(root)?.();
}

/** True while any picker on the page has its list open — the chat's Escape layering reads this. */
export const pickerIsOpen = (): boolean => open.size > 0;

let globals = false;

function wireGlobalOnce(): void {
  if (globals) return;
  globals = true;

  /* A FOREIGN WRITE STILL MOVES EVERY PICKER. The sidebar's `Show all`, the search modal's clear
     and `platform-start.ts` all go through `writePlatformPreference`, and none of them can express
     "explicitly nothing" — so whatever arrives here is a real selection and can be taken as one.
     Our own broadcasts are skipped: the effective set we send when nothing is ticked would
     otherwise be read straight back in as "everything is ticked". */
  onPlatformsChange((next) => {
    if (selfWrite) return;
    sharedSel = next;
    for (const repaint of sharedPickers) repaint();
  });

  /* One listener for every list, rather than one per instance, so a page with four pickers still
     costs one. A click INSIDE a picker is that picker's own business — the trigger toggles itself
     and a label toggles its input — so only the ones the click missed are closed. */
  document.addEventListener('click', (e) => {
    if (!open.size) return;
    const target = e.target;
    for (const root of [...open]) {
      if (target instanceof Node && root.contains(target)) continue;
      const trigger = root.querySelector<HTMLButtonElement>('[data-pk-trigger]');
      const pop = root.querySelector<HTMLElement>('[data-pk-pop]');
      if (trigger && pop) closeList(root, trigger, pop, false);
    }
  });
}
