/**
 * The `/handoff` page's controls: the sticky section nav and the per-flow collapse.
 *
 * THE WIDTH CONTROL WENT WITH THE IFRAMES (2026-08-21). `Fit / 30rem / 50rem / 72rem` set
 * `grid-auto-columns` on a comparison row so one live cell could be held at a portal breakpoint and
 * measured. The comparison is four text cards now — the frames were removed because the element
 * they were meant to show sat below the fold of every cell, and because two of the four surfaces do
 * not answer to `?platform=` at all — and resizing a paragraph measures nothing. So `TRACKS` and
 * `wireWidths()` are deleted rather than left driving a control that no longer controls anything.
 *
 * THE COPY BUTTON WENT WITH THE REBUILD (2026-08-21). The page no longer prints a URL beside every
 * state — a state is a link on its own name — so there was nothing left to copy and `wireCopy` was
 * the only reader of `data-hf-copy`. Copying a link is a native right-click, and a button that
 * duplicates one is a control to maintain for nothing.
 *
 * IT LIVES IN A `.ts` FILE FOR THE ORDINARY REASON: `astro check` walks the frontmatter and the
 * template but not the body of an inline `<script>`, so logic left inside one is invisible to every
 * type gate this repo owns. The page imports this and calls it, which is the same shape every other
 * controller in `apps/support` uses.
 *
 * NOTHING HERE RENDERS A ROW. The page is server-rendered whole — a static build cannot vary on a
 * query parameter, and a handoff index that built its own rows in the browser would be the thing it
 * documents. Every control below only annotates or reveals markup that already shipped: two custom
 * properties are set, an `aria-current` moves, and `<details open>` is toggled on
 * elements the server already wrote. With this module missing the page still renders every flow,
 * every anchor still jumps, and every flow still opens — it just does not mark where you are.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   THE SECTION NAV AND THE COLLAPSE. Three controls, all of them progressive:
   the page is readable and navigable with this module missing. `<details>` is
   native, the nav entries are ordinary in-page anchors, and everything below
   only ADDS — a current-section mark, a way to open every flow at once, and the
   two corrections that a sticky bar makes necessary.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The bar's own height, published as a custom property.
 *
 * WITHOUT THIS EVERY ANCHOR LANDS UNDERNEATH IT. `scroll-margin-top` has to equal the height of the
 * sticky element, and that height is not a constant: the label set differs per surface, the actions
 * are hidden below 30rem, and the chip row's scrollbar is a platform decision. Measuring is the only
 * honest source. The CSS carries a real fallback rather than 0, so a failure here is a slightly
 * wrong offset and never a heading hidden behind the bar.
 */
function publishNavHeight(rail: HTMLElement): void {
  const set = (): void => {
    /* A RAIL COVERS NOTHING, SO IT OWES AN ANCHOR NOTHING. Publishing its measured height here would
       be publishing most of the viewport, and every `scroll-margin-top` on the page would push its
       heading a screen too far down. The bar is the only mode that overlays content. */
    const px = navMode(rail) === 'rail' ? 0 : Math.round(rail.offsetHeight);
    document.documentElement.style.setProperty('--hf-nav-h', `${px}px`);
  };
  set();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(set).observe(rail);
  window.addEventListener('resize', set, { passive: true });
}

/**
 * Rail or bar, ASKED OF THE STYLESHEET rather than re-derived from a width.
 *
 * The breakpoint lives in one place — the media query that swaps the layout — and this reads the
 * answer out of `--hf-nav-mode`. A `matchMedia('(max-width: 1160px)')` here would be a second copy of
 * that number, and the copy that goes stale is always the one nobody is looking at.
 */
function navMode(rail: HTMLElement): 'rail' | 'bar' {
  return getComputedStyle(rail).getPropertyValue('--hf-nav-mode').trim() === 'bar' ? 'bar' : 'rail';
}

/**
 * Marks the section the reader is in, and keeps its chip in view.
 *
 * WHY A SCROLL LISTENER AND NOT `IntersectionObserver` ALONE. The question is not "which sections
 * intersect the viewport" — on this page several always do, and a twenty-flow section can be taller
 * than the screen so that NONE of its edges intersect anything. The answer wanted is "which section
 * heading did the reader most recently pass", which is a position comparison. So: an observer is
 * used only as the cheap trigger, and the decision is made by reading the tops. `requestAnimation-
 * Frame` coalesces bursts, because a scroll event fires far more often than a section changes.
 */
function wireSpy(nav: HTMLElement): void {
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-hf-nav-a]'));
  const list = nav.closest<HTMLElement>('.hf-rail')?.querySelector<HTMLElement>('.hf-toc') ?? nav;
  const targets = links
    .map((a) => ({ a, el: document.getElementById(a.dataset.hfNavA ?? '') }))
    .filter((t): t is { a: HTMLAnchorElement; el: HTMLElement } => t.el !== null);
  if (!targets.length) return;

  let current: HTMLAnchorElement | null = null;
  let queued = false;

  const paint = (): void => {
    queued = false;
    /* The line the reader is actually reading at, not the top of the window: anything above the bar
       is covered by the bar. One pixel past it is the first thing they can see. */
    /* `--hf-nav-h` is the one number that says how much of the top of the viewport is covered, and
       `publishNavHeight` has already decided it for both modes. Reading the nav's own bottom edge
       was right only while the nav was a bar across the top; as a rail its bottom is near the FOOT
       of the viewport, which would mark whichever section happens to end down there. */
    const covered =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hf-nav-h')) || 0;
    const line = covered + 1;
    let hit = targets[0];
    for (const t of targets) {
      if (t.el.getBoundingClientRect().top <= line) hit = t;
    }
    if (hit.a === current) return;
    for (const { a } of targets) a.removeAttribute('aria-current');
    hit.a.setAttribute('aria-current', 'true');
    current = hit.a;
    /* A marked chip the reader cannot see is not a mark. The row is its own scroller, so the active
       chip is brought into it — `nearest` on both axes, or the page itself jumps. */
    const scrolls =
      (list && list.scrollWidth > list.clientWidth) || nav.scrollHeight > nav.clientHeight + 1;
    if (scrolls) {
      hit.a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const schedule = (): void => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(paint);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  paint();
}

/** `Open all` / `Close all`, over every flow on the page. */
function wireExpand(root: Document | HTMLElement): void {
  const flows = (): HTMLDetailsElement[] =>
    Array.from(root.querySelectorAll<HTMLDetailsElement>('[data-hf-flow]'));
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-hf-expand]')) {
    btn.addEventListener('click', () => {
      const open = btn.dataset.hfExpand === 'open';
      for (const d of flows()) d.open = open;
    });
  }
}

/**
 * A LINK INTO A CLOSED FLOW HAS TO OPEN IT.
 *
 * Every friction in the cross-cutting section links to a flow by id, and the flow is now a closed
 * `<details>`. Browsers are inconsistent about auto-expanding for a fragment — some do it only for
 * `hidden="until-found"` content, which this is not — so the page does it itself, on load and on
 * every subsequent hash change. The scroll is repeated after opening because the anchor's position
 * is measured before the flow expands, and the number is wrong the moment it does.
 */
function wireHashOpen(): void {
  const reveal = (): void => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const flow = el.closest<HTMLDetailsElement>('[data-hf-flow]');
    if (!flow || flow.open) return;
    flow.open = true;
    el.scrollIntoView({ block: 'start' });
  };
  window.addEventListener('hashchange', reveal);
  reveal();
}

/**
 * The search, and the ruling it implements.
 *
 * IT FILTERS THE PAGE AND THE RAIL, NOT ONE OF THEM. Filtering only the rail is cheaper and leaves
 * the reading position alone, and it was the first answer here — but it produces a rail pointing at
 * twenty flows that are all still on screen, which answers "where is it" and not "show me it". And
 * filtering only the page leaves the rail listing sections that are no longer there. `apps/design`'s
 * own handoff hides both, and it is right: they are two views of one list.
 *
 * WHAT IT MATCHES: the ten section names, the twenty flow labels, the three email templates, and
 * EVERY FLOW ID. The id is in because the audience is developers — somebody arriving from
 * `flow-registry.ts` or from a `#`-anchor in a commit message has the id and not the label, and a
 * search that made them translate it first would be a search they stop using.
 *
 * THE WAY BACK IS EXPLICIT, because this hides content: a count while it is filtering, an empty
 * state that says so in words rather than leaving a blank page, a `clear the search` control inside
 * that empty state, and Escape from the field. `/` focuses it, which the placeholder advertises.
 *
 * A SECTION MATCHED BY ITS OWN NAME KEEPS ALL OF ITS FLOWS. Typing `tickets` means "show me
 * tickets", not "show me the one flow with tickets in its title" — the section is the answer.
 *
 * NOTHING IS DESTROYED. Every row is still in the DOM with an attribute on it, so clearing the field
 * restores the page exactly, including which flows were open.
 */
function wireFilter(rail: HTMLElement): void {
  const input = document.querySelector<HTMLInputElement>('[data-hf-search]');
  if (!input) return;
  const count = document.querySelector<HTMLElement>('[data-hf-count]');
  const empty = document.querySelector<HTMLElement>('[data-hf-empty]');
  const clear = document.querySelector<HTMLButtonElement>('[data-hf-clear]');

  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-hf-row]'));
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-hf-section]'));
  const railItems = Array.from(rail.querySelectorAll<HTMLElement>('[data-hf-item]'));
  const railSubs = Array.from(rail.querySelectorAll<HTMLElement>('[data-hf-sub-item]'));

  const hide = (el: HTMLElement, on: boolean): void => {
    el.dataset.hfHide = on ? 'true' : 'false';
  };

  const apply = (): void => {
    const q = input.value.trim().toLowerCase();

    if (!q) {
      for (const el of [...rows, ...sections, ...railItems]) hide(el, false);
      /* Sub-rows are a filtering affordance, not a permanent second level: at rest the rail is the
         ten sections, which is a list you can take in at a glance. */
      for (const el of railSubs) hide(el, true);
      if (count) hide(count, true);
      if (empty) hide(empty, true);
      return;
    }

    let shown = 0;
    for (const section of sections) {
      const own = (section.dataset.hfName ?? '').includes(q);
      const inside = rows.filter((r) => section.contains(r));
      let hits = 0;
      for (const row of inside) {
        const hit = own || (row.dataset.hfName ?? '').includes(q);
        hide(row, !hit);
        if (hit) hits++;
      }
      const live = own || hits > 0;
      hide(section, !live);
      shown += hits;

      const item = railItems.find((i) => i.dataset.hfFor === section.id);
      if (item) hide(item, !live);
    }

    for (const sub of railSubs) {
      const row = sub.dataset.hfFor ? document.getElementById(sub.dataset.hfFor) : null;
      hide(sub, !row || row.dataset.hfHide === 'true');
    }

    if (count) {
      count.textContent = `${shown}`;
      hide(count, false);
    }
    if (empty) hide(empty, shown === 0 && !sections.some((x) => x.dataset.hfHide === 'false'));
  };

  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    input.value = '';
    apply();
  });
  clear?.addEventListener('click', () => {
    input.value = '';
    apply();
    input.focus();
  });

  /* `/` FOCUSES THE FIELD, and it must not steal the key from someone typing into something else —
     including this field, where `/` is an ordinary character. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
    if (el instanceof HTMLElement && el.isContentEditable) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  apply();
}

export function mountHandoff(): void {
  wireExpand(document);
  wireHashOpen();
  const rail = document.querySelector<HTMLElement>('.hf-rail');
  const nav = document.querySelector<HTMLElement>('[data-hf-nav]');
  if (rail) {
    publishNavHeight(rail);
    wireFilter(rail);
  }
  if (nav) wireSpy(nav);
}
