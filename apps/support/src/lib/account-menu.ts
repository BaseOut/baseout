/**
 * The header's account menu: open, close, and the three ways a popover gets closing wrong.
 *
 * ── IT MIRRORS `platform-picker.ts` RATHER THAN INVENTING A SECOND WAY ─────────────────────────
 * That control is the same shape (a trigger and a panel in a header row) and it has already paid for
 * every mistake below. Read its header before changing anything here; what follows is the same
 * reasoning applied to a second instance, not a fresh design.
 *
 * ── 1 · `mousedown` IS PREVENTED, AND THAT IS THE LINE THAT MAKES THE PANEL USABLE ─────────────
 * A panel that closes on `focusout` destroys itself BETWEEN a real mousedown and the mouseup that
 * would have completed the click: pressing on a row's padding moves focus to `<body>`, `focusout`
 * fires with a null `relatedTarget`, the panel hides, and there is nothing under the pointer to
 * receive the mouseup. `preventDefault` on mousedown keeps focus where it is, so no `focusout`
 * fires and the click lands.
 *
 * A SYNTHETIC `.click()` NEVER REPRODUCES THIS. It dispatches one event with no focus change, so a
 * test that clicks programmatically passes on the broken code. This repo has been bitten by exactly
 * that once already; only a trusted click proves a click here.
 *
 * ── 2 · ESCAPE IS HANDLED LOCALLY AND STOPPED FROM TRAVELLING ──────────────────────────────────
 * The portal has other things listening for Escape on `document` — the search dialog and the chat
 * drawer both close on it. An Escape meant for this panel must not also close the surface behind it,
 * so it is caught here and `stopPropagation` keeps it from reaching them.
 *
 * ── 3 · THE OUTSIDE CLICK IS ONE DOCUMENT LISTENER, NOT ONE PER INSTANCE ───────────────────────
 * Two instances exist in the DOM at once (the header and, at narrow widths, the mobile menu), and a
 * listener per instance means N handlers all deciding independently whether a click was "outside".
 * One listener that closes every panel not containing the target is the version that cannot
 * disagree with itself.
 */
const OPEN_ATTR = 'data-open';

/* ── 4 · THE PANEL LOSES A STACKING FIGHT IT CANNOT WIN FROM WHERE IT SITS ─────────────────────
 * `.header` is `z-index: 10` and `.right-sidebar-container` is `z-index: 30` (the reason is in
 * `styles/support.css`, and it is load bearing: the folded table-of-contents popover renders under
 * the prose without it). A `z-index` on the panel competes only INSIDE the header's stacking
 * context, so 40 there loses to a 30 outside it, forever. Measured: the panel rendered at
 * 1196,54 with all four rows, correct colours, and the contents card drawn straight over it.
 *
 * THE HEADER IS RAISED, AND ONLY WHILE THE PANEL IS OPEN. Editing the z-index ladder itself was the
 * other option and it is the one to avoid: three separate incidents are written up around those two
 * numbers, and `--sl-z-index-skiplink` sits between them, so moving the navbar above the rail
 * permanently would put the header over the skip link. An attribute on `<html>` that exists for the
 * lifetime of one open panel cannot affect anything while it is closed. */
const HTML_OPEN_ATTR = 'data-account-open';

function panels(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-account-menu]')];
}

function close(menu: HTMLElement): void {
  const trigger = menu.querySelector<HTMLButtonElement>('[data-account-trigger]');
  const pop = menu.querySelector<HTMLElement>('[data-account-pop]');
  if (!trigger || !pop) return;
  menu.removeAttribute(OPEN_ATTR);
  pop.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (!document.querySelector(`[data-account-menu][${OPEN_ATTR}]`)) {
    document.documentElement.removeAttribute(HTML_OPEN_ATTR);
  }
}

function open(menu: HTMLElement): void {
  for (const other of panels()) if (other !== menu) close(other);
  const trigger = menu.querySelector<HTMLButtonElement>('[data-account-trigger]');
  const pop = menu.querySelector<HTMLElement>('[data-account-pop]');
  if (!trigger || !pop) return;
  menu.setAttribute(OPEN_ATTR, '');
  pop.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  document.documentElement.setAttribute(HTML_OPEN_ATTR, '');
}

export function wireAccountMenu(): void {
  const menus = panels();
  if (!menus.length) return;

  for (const menu of menus) {
    const trigger = menu.querySelector<HTMLButtonElement>('[data-account-trigger]');
    const pop = menu.querySelector<HTMLElement>('[data-account-pop]');
    if (!trigger || !pop) continue;

    trigger.addEventListener('click', () => {
      if (menu.hasAttribute(OPEN_ATTR)) close(menu);
      else open(menu);
    });

    /* See 1 in the header. Without this, pressing on a row's padding closes the panel before the
       click completes, and the row reads as dead. */
    pop.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    /* See 2. `stopPropagation` is what keeps the search dialog and the chat drawer open behind it. */
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !menu.hasAttribute(OPEN_ATTR)) return;
      e.stopPropagation();
      close(menu);
      trigger.focus();
    });
  }

  /* See 3. One listener, every panel. */
  document.addEventListener('click', (e) => {
    const target = e.target as Node;
    for (const menu of panels()) {
      if (!menu.contains(target)) close(menu);
    }
  });
}
