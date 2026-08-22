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
  FILTER_EVENT,
  readPlatformPreference,
  writePlatformPreference,
  type PlatformId,
} from './platforms';
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
     One stored preference read through one function, so the three chip rows cannot drift apart.
     Missing means everything, which is what a reader who has never chosen expects. */
  const platChips = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-chat-platform]'));
  let platforms = readPlatformPreference() ?? new Set<PlatformId>(PLATFORM_IDS);

  const paintPlatforms = () => {
    for (const c of platChips) {
      const id = c.dataset.chatPlatform;
      c.setAttribute('aria-pressed', String(!!id && platforms.has(id as PlatformId)));
    }
  };

  /** Everything selected is not a filter, so nothing is sent — see `searchDocs`. */
  const platformFilter = (): string[] | undefined =>
    platforms.size === PLATFORM_IDS.length ? undefined : [...platforms];

  for (const c of platChips) {
    c.addEventListener('click', () => {
      const id = c.dataset.chatPlatform as PlatformId | undefined;
      if (!id) return;
      const next = new Set(platforms);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      /* The last one cannot be turned off: a scope of nothing can only ever cite platform-neutral
         pages, which is not a state anybody means to ask for. Same rule as the other two rows. */
      if (!next.size) return;
      platforms = next;
      paintPlatforms();
      writePlatformPreference(platforms);
    });
  }

  document.addEventListener(FILTER_EVENT, (e) => {
    const ids = (e as CustomEvent<string[]>).detail;
    if (!Array.isArray(ids) || !ids.length) return;
    platforms = new Set(ids.filter((v): v is PlatformId => (PLATFORM_IDS as string[]).includes(v)));
    paintPlatforms();
  });

  paintPlatforms();

  wireChat({ messages, form, input, gate, left }, budget, context, platformFilter);
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

  const apply = (open: boolean) => {
    document.documentElement.dataset.chat = open ? 'open' : 'closed';
    for (const l of launchers) l.setAttribute('aria-expanded', String(open));
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    /* Innermost first. The page-contents popover lives inside the same Escape, and closing the whole
       conversation because someone dismissed a heading list would be the wrong layer to act on —
       the same rule the product applies to its own panel stack. */
    if (document.querySelector('[data-toc-root][data-toc-open]')) return;
    close();
  });
}
