/**
 * Wires the docs-rail chat panel (`components/PageSidebar.astro`) to the shared conversation.
 *
 * Everything about conversation state lives in `chat-core.ts`; this file owns the drawer's
 * open/close, the page chip, and the starter questions. Extracted from the component because `astro check` does not walk `.astro`
 * `<script>` blocks — logic left inside one is invisible to every type gate we own.
 *
 * OPEN/CLOSED IS A DOCUMENT-LEVEL FLAG — `html[data-chat='open']` — and THIS FILE IS THE ONLY
 * THING THAT SETS IT. There used to be an inline `<head>` script setting it before paint, back when
 * opening the chat narrowed `--sl-content-width` and a restore would render the wide layout for one
 * frame and snap. The drawer takes part in no layout now, so that bought nothing — and it cost a
 * genuine failure mode: the flag went up before the module did, so anything that stopped this
 * script from running (a stale tab whose hashed bundle no longer exists after a rebuild, most
 * likely) left the drawer open with no listeners on it. Open, covering the page, and impossible to
 * close. Now the panel cannot open unless the code that closes it is already running.
 *
 * THE CHIP IS THE SCOPE. Kept, the question is scoped to the page being read; dismissed, the scope
 * is the whole corpus and the starter questions appear in its place — the two are mutually
 * exclusive by construction, which is why one function drives both.
 */
import { isOpen, setOpen, wireChat, writeDraft } from './chat-core';
import {
  PLATFORM_IDS,
  currentPlatforms,
  onPlatformsChange,
  samePlatforms,
} from './platforms';
import { pickerIsOpen } from './platform-picker';
import { OPEN_CHAT_EVENT } from './rows';
import { wireResize } from './chat-resize';

export function wirePanel(): void {
  const panel = document.querySelector<HTMLElement>('[data-chat-panel]');
  if (!panel) return; // A page without a table of contents has no rail — the splash landing.

  const q = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel);
  const messages = q('[data-chat-messages]');
  const form = q<HTMLFormElement>('[data-chat-form]');
  const input = q<HTMLInputElement>('[data-chat-input]');
  const gate = q('[data-chat-gate]');
  const left = q('[data-chat-left]');
  if (!messages || !form || !input || !gate || !left) return;

  /* The exit to a person. Optional in `ChatEls` and optional here: the drawer is the only surface
     that renders it today, and a chat wired without one must still wire. */
  const escalate = q('[data-chat-escalate]') ?? undefined;
  const foot = q('[data-chat-foot]') ?? undefined;
  const why = q('[data-chat-why]') ?? undefined;

  const chip = q('[data-chat-chip]');
  const starters = q('[data-chat-starters]');
  const budget = Number(panel.dataset.budget ?? '5');

  /* Read at SEND time, not at wire time, so dismissing the chip takes effect immediately. An
     absent chip (the splash landing) and a dismissed one are deliberately the same state. */
  const context = () => (chip && !chip.hidden ? panel.dataset.context || undefined : undefined);

  const syncScope = () => {
    const scoped = !!chip && !chip.hidden;
    if (starters) starters.hidden = scoped;
    input.placeholder = scoped ? 'Ask about this page…' : 'Ask a question…';
  };

  /* ── The platform scope, shared with the sidebar and the search modal ──────────────────────
     The CONTROL is `components/PlatformPicker.astro` and it owns its pressed state, its keyboard
     and the rule that the last platform does not turn off. What this file needs is the value, read
     at SEND time through `platformFilter` so a scope changed mid-conversation applies to the next
     question rather than to the one already asked. Missing means everything, which is what a reader
     who has never chosen expects. */
  let platforms = currentPlatforms();

  /** Everything selected is not a filter, so nothing is sent — see `searchDocs`. */
  const platformFilter = (): string[] | undefined =>
    platforms.size === PLATFORM_IDS.length ? undefined : [...platforms];

  onPlatformsChange((next) => {
    if (samePlatforms(next, platforms)) return;
    platforms = next;
  });

  wireChat({ messages, form, input, gate, left, escalate, foot, why }, budget, context, platformFilter);
  syncScope();

  q('[data-chat-chip-clear]')?.addEventListener('click', () => {
    if (chip) chip.hidden = true;
    syncScope();
    input.focus();
  });

  /* A starter fills the composer rather than sending it. The budget is five messages — spending
     one because a suggestion was clicked would be taking it without being asked, the same reason
     an ask row prefills instead of submitting. */
  for (const b of panel.querySelectorAll<HTMLButtonElement>('[data-chat-starter]')) {
    b.addEventListener('click', () => {
      input.value = b.textContent?.trim() ?? '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }

  const launchers = document.querySelectorAll<HTMLButtonElement>('[data-chat-open]');

  /* `hidden` comes OFF for good once this runs. It exists only to keep the drawer out of the
     accessibility tree before hydration; from here the open/closed state is the document flag,
     because `hidden` is `display: none` and a display change cannot be transitioned — leaving it
     in charge would have meant no animation at all. */
  /* MOVE THE DRAWER TO <body> BEFORE ANYTHING ELSE.
     Starlight renders `Banner` — and therefore this panel — inside `main`, and puts
     `isolation: isolate` on `.main-pane`. That is a stacking context, so the drawer's `z-index`
     was sealed inside it and `.main-pane` competed as a whole against Starlight's own header and
     `.sidebar-pane`. Measured consequences, both reported: the header's menu button sat ON TOP of
     the drawer's close button and swallowed the click, and expanding the mobile menu dropped a
     full-width opaque pane over the composer so nothing could be typed. No z-index on this element
     could ever have fixed either — the number was being applied in the wrong context. As a direct
     child of `body` the drawer stacks against the page, which is what `position: fixed` already
     implied it did. */
  if (panel.parentElement !== document.body) document.body.appendChild(panel);

  panel.hidden = false;

  const grip = q('[data-chat-grip]');
  if (grip) wireResize(panel, grip);

  /* ── THE DRAWER IS A DIALOG ON A PHONE AND A DOCKED PANEL EVERYWHERE ELSE ─────────────────────
     `aria-modal="false"` in the markup is the honest value for the shape this thing has on a
     desktop: it sits beside the reading column, the column stays visible, and trapping a screen
     reader inside a side panel the reader can still see past would be wrong.
     Below 30rem `ChatDock.astro` makes it a full-bleed sheet — 100% wide, `100dvh` tall, nothing of
     the page left on screen. The same `false` there means a screen reader or a Tab key walks
     straight out of the sheet into an article that is completely covered, with no way to tell it has
     left. `inert` on the page behind is what makes "you cannot see it" and "you cannot reach it"
     the same statement.

     THE BOUNDARY MOVED TO 1279.98px ON 2026-08-26, with the reservation it belongs to. It used to
     be 30rem, matching the width where the drawer goes full-bleed; that was right while everything
     between 30rem and the desktop DOCKED, because a docked panel leaves the article beside it live
     and readable. It no longer docks there — `styles/support.css` stops reserving its width below
     1280, since pushing the article aside left the manual 40 characters a line at 1024 — so in that
     band the drawer floats over the page and covers 352px of a 692px column. Every line of prose is
     cut vertically. Modality follows the geometry: where the panel is over the page rather than
     beside it, "you cannot read it" and "you cannot reach it" have to be the same statement.

     READ AT OPEN TIME rather than cached: the drawer survives navigation, and a rotation is a real
     width change under it.

     SIBLINGS OF THE PANEL, not `<body>`: the drawer is moved to be a direct child of body a few
     lines above, so inerting body would inert the drawer with it. */
  const SHEET = '(max-width: 1279.98px)';

  const apply = (open: boolean) => {
    document.documentElement.dataset.chat = open ? 'open' : 'closed';
    for (const l of launchers) l.setAttribute('aria-expanded', String(open));

    const sheet = open && window.matchMedia(SHEET).matches;
    panel.setAttribute('aria-modal', String(sheet));
    for (const el of document.body.children) {
      if (el === panel || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      (el as HTMLElement).inert = sheet;
    }

    setOpen(open);
  };

  /* Restore the previous state. `data-chat-boot` suppresses the transition for the first two
     frames, so a panel that was already open comes back in place instead of sliding in on every
     single navigation — the animation is for the ACT of opening, not for arriving somewhere. */
  const restoring = isOpen();
  if (restoring) document.documentElement.setAttribute('data-chat-boot', '');
  apply(restoring);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.documentElement.removeAttribute('data-chat-boot')),
  );

  for (const l of launchers) {
    l.addEventListener('click', () => {
      /* Never two full-screen layers at once: on a phone Starlight's expanded nav and this drawer
         both fill the viewport, and whichever lost would be invisible but still clickable. */
      const menu = document.querySelector<HTMLElement>('starlight-menu-button');
      if (menu?.getAttribute('aria-expanded') === 'true') {
        menu.querySelector('button')?.click();
      }
      apply(true);
      input.focus();
    });
  }

  /* THE ONE WAY IN, for anything that is not the header button: the search modal's ask rows, the
     landing's card, and anything added later. A question may travel with it, and it is PREFILLED
     rather than sent — the budget is five messages and spending one on a click nobody confirmed
     would be taking it unasked, the same rule the starter questions follow. */
  document.addEventListener(OPEN_CHAT_EVENT, (e) => {
    const q = (e as CustomEvent<{ q?: string }>).detail?.q?.trim();
    apply(true);
    if (q) {
      input.value = q;
      writeDraft(q);
      input.setSelectionRange(q.length, q.length);
    }
    input.focus();
  });

  const close = () => {
    apply(false);
    launchers[0]?.focus();
  };

  panel.querySelector('[data-chat-close]')?.addEventListener('click', close);

  /* ── TAPPING THE DIMMED PAGE CLOSES IT ─────────────────────────────────────────────────────────
     ON `document`, AND THE FIRST VERSION WAS ON THE PANEL AND WAS DEAD ON ARRIVAL. It tested
     `e.target === panel`, which was right while the scrim was `.cd::before` — a pseudo-element
     hit-tests to its host. The scrim had to move to `body::before` (a `transform` on `.cd` made it
     the containing block for its own `position: fixed` child, so `inset: 0` meant the drawer's own
     368px box), and with it went every click the handler was written to catch. Measured: tapping the
     dimmed page left `html[data-chat]` on `open`.

     The scrim is `pointer-events: none` and the page under it is `inert`, so neither can be a click
     target and the press lands on `<body>`. Only `document` sees all of them.

     ONLY WHERE IT IS MODAL. Above the boundary the drawer docks beside a live page, and closing it
     because somebody clicked the article they are reading would be taking the panel away mid-
     sentence.

     AND NOT THE PRESS THAT OPENED IT. A launcher click reaches `document` after its own handler has
     already flipped the state, so without this guard the drawer would open and shut on one press. */
  document.addEventListener('click', (e) => {
    if (!isOpen() || !window.matchMedia(SHEET).matches) return;
    const t = e.target as HTMLElement | null;
    if (!t || panel.contains(t) || t.closest?.('[data-chat-open]')) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    /* Innermost first. The page-contents popover lives inside the same Escape, and closing the whole
       conversation because someone dismissed a heading list would be the wrong layer to act on —
       the same rule the product applies to its own panel stack. The platform picker's open list is
       the second occupant of that layer, and it belongs here for the same reason: it also stops the
       key at its own root, so this guard is the second of two locks on one door rather than the
       only one. Two, because the ordering between an element listener and this document listener is
       a property of where the key was pressed, and a click that left focus on the trigger would put
       it outside the picker's own subtree. */
    if (document.querySelector('[data-toc-root][data-toc-open]')) return;
    if (pickerIsOpen()) return;
    close();
  });
}
