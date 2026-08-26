/**
 * The client controller for `/requests/` — tabs, the signed-out lock, and the first-ever empty state.
 *
 * ── WHY ANY OF THIS IS CLIENT-SIDE ─────────────────────────────────────────────────────────────
 * `apps/support` declares no `output` and no adapter: it is a fully STATIC build, so a query
 * parameter cannot change what the server renders. Every state below is therefore rendered INTO the
 * page and selected by an attribute, exactly as `lib/shot-switch.ts` does on the landing. That is
 * also why the visible/hidden decision is made in CSS rather than by removing nodes: a scoped Astro
 * style never reaches DOM this file could build, so this file builds none.
 *
 * ── THE THREE AXES, AND THEY ARE GENUINELY THREE ───────────────────────────────────────────────
 *   session   `in` | `out`   — whether there is a person behind the page. DEFAULT `in` since
 *                              2026-08-21: there is still no auth here, so neither state is the
 *                              "real" one, and the portal is a demo of the finished product — a
 *                              reviewer opening this page to see the ticket design should meet the
 *                              ticket design. `?session=out` renders the LOCKED capability in
 *                              place; it is never a redirect and never an empty list.
 *   tab       `open` | `closed` | `all` — the lane. DEFAULT `open`: a customer opens this page to
 *                              find the one that moved, and a closed case did not move.
 *   tickets   `some` | `none` — whether this account has ever written in. It exists so the
 *                              first-ever empty state is REACHABLE. An empty branch you can only
 *                              reach by deleting the fixture is a branch nobody ever looks at.
 *
 * ── THE URL IS THE ONLY SOURCE, AND NOTHING IS STORED ──────────────────────────────────────────
 * `shot-switch` persists its choice because it is comparing two designs across a browsing session.
 * These three are not preferences — one of them is a claim about who you are. Writing "signed in" to
 * `localStorage` would make a review state follow somebody into a page that is about authentication,
 * which is the one place a sticky lie is expensive. So: read the URL, stamp the attribute, and when a
 * tab is clicked, rewrite the URL with `replaceState` so the state is shareable and the back button
 * is not filled with tab presses.
 *
 * ── THE COUNTS ARE RECOMPUTED, NEVER TRUSTED FROM THE MARKUP ───────────────────────────────────
 * The server printed the counts for the full fixture. Under `?tickets=none` those numbers would be a
 * page saying "Open 3" above a sentence saying nobody has ever written in. The controller writes the
 * count text from the rows actually present, so the two can never disagree.
 *
 * IN A `.ts` FILE, NOT AN INLINE `<script>`: `astro check` never type-checks a script block inside an
 * `.astro` file, so anything written there is unchecked by every gate this repo owns.
 */
import { TABS, type TicketTab } from './ticket-status';
import { readSession } from './portal-session';

export type Population = 'some' | 'none';

const isTab = (v: string | null): v is TicketTab => TABS.some((t) => t.key === v);
const isPopulation = (v: string | null): v is Population => v === 'some' || v === 'none';

export function wireRequestsList(): void {
  const root = document.querySelector<HTMLElement>('[data-requests]');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);

  const session = readSession();
  const population: Population = isPopulation(params.get('tickets'))
    ? (params.get('tickets') as Population)
    : 'some';
  let tab: TicketTab = isTab(params.get('tab')) ? (params.get('tab') as TicketTab) : 'open';

  root.dataset.session = session;
  root.dataset.tickets = population;

  /* ONE KEY PER TICKET, NOT PER ELEMENT. `data-ticket-status` is carried by three nodes for every
   ticket — the list item, the card inside it and the badge inside that — so counting it counted
   each ticket three times and OVERWROTE the correct server-printed totals with them: five tickets
   rendered as `All 15`. The row is the thing being counted, so the row carries the key. */
const rows = [...root.querySelectorAll<HTMLElement>('[data-ticket-row]')];

  /** Which lane a stored status belongs to. Mirrors `inTab` in `lib/ticket-status.ts` — and it has
   *  to, because the counts and the rows are drawn from this one predicate on both sides. */
  const inLane = (status: string, lane: TicketTab): boolean =>
    lane === 'all' ? true : lane === 'closed' ? status === 'closed' : status !== 'closed';

  function paintCounts(): void {
    for (const { key } of TABS) {
      const el = root!.querySelector<HTMLElement>(`[data-count="${key}"]`);
      if (!el) continue;
      const n =
        population === 'none' ? 0 : rows.filter((r) => inLane(r.dataset.ticketStatus ?? '', key)).length;
      el.textContent = String(n);
    }
  }

  function paint(): void {
    root!.dataset.tab = tab;

    for (const btn of root!.querySelectorAll<HTMLButtonElement>('[data-tab-btn]')) {
      btn.setAttribute('aria-selected', String(btn.dataset.tabBtn === tab));
    }

    let shown = 0;
    for (const row of rows) {
      const visible = population !== 'none' && inLane(row.dataset.ticketStatus ?? '', tab);
      row.hidden = !visible;
      if (visible) shown += 1;
    }

    /* WHICH EMPTY SENTENCE, and they are not the same sentence. "No open cases" is a fact about a
       lane; "you have never written to us" is a fact about the account, and only the second one has
       anywhere useful to point. `none` wins over the lane, because a lane being empty is not
       interesting news to somebody who has never written in at all. */
    root!.dataset.empty = population === 'none' ? 'never' : shown === 0 ? 'lane' : 'no';
  }

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-tab-btn]')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.tabBtn;
      if (!isTab(next ?? null)) return;
      tab = next as TicketTab;

      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url);

      paint();
    });
  }

  paintCounts();
  paint();
}
