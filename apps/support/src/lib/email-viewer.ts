/**
 * The viewer's controls: which email, which width, and keeping both in the URL.
 *
 * ── THE PAGE IS A STATIC BUILD, SO ALL THREE EMAILS SHIP AND THE QUERY PICKS ONE ───────────────
 * `apps/support` has no adapter and no server, so a query parameter cannot change what was served.
 * Every other query-driven surface in this portal works the same way — both landing variants ship
 * and a class picks one, both session halves ship and `data-portal-session` picks one — and this is
 * the third. The consequence is worth stating: `pnpm smoke-support` requesting
 * `?email=reply&width=mobile` proves the ROUTE serves, never that the variant renders. Only a
 * browser can prove the second, and this file is what a browser would be testing.
 *
 * ── THE URL IS THE STATE, AND IT IS REPLACED RATHER THAN PUSHED ────────────────────────────────
 * Both controls write back to the address bar, so the link in the bar always produces what is on
 * screen — the rule the rest of this portal holds. `replaceState`, not `pushState`: pushing would
 * make the browser's Back button walk backwards through toggle presses instead of leaving the page,
 * and a viewer you cannot leave with Back is a trap. The cost is that Back does not undo a toggle,
 * which is not a thing anyone asks Back to do.
 *
 * ── UNKNOWN VALUES FALL BACK, THEY DO NOT BLANK ────────────────────────────────────────────────
 * `?email=nonsense` shows the first email rather than an empty grey field. A viewer whose failure
 * mode is a blank page cannot be told apart from a viewer that is broken.
 */

import { fitEmailFrame, setEmailScheme, watchEmailFrame } from './email-frame';

/** The two widths. The argument for each is in `pages/handoff/emails.astro`. */
export const WIDTHS = { desktop: 600, mobile: 375 } as const;
export type WidthKey = keyof typeof WIDTHS;

/** The two palettes. Both are solved in `emails/partials/head.mjml`; this only chooses which one to
 *  show, and `setEmailScheme` reads the choice back out of the email's own stylesheet. */
export type SchemeKey = 'light' | 'dark';

/** The two drawings. Both ship for every email, which is what lets the control be a shared toggle
 *  rather than a fourth entry in the picker. */
export type StyleKey = 'one' | 'two';

const isWidth = (v: string | null): v is WidthKey => v === 'desktop' || v === 'mobile';
const isScheme = (v: string | null): v is SchemeKey => v === 'light' || v === 'dark';
const isStyle = (v: string | null): v is StyleKey => v === 'one' || v === 'two';

export function wireEmailViewer(): void {
  const root = document.querySelector<HTMLElement>('[data-viewer]');
  if (!root) return;

  /* KEYED `slug|style`, because the page now holds two frames per email and both have to be
     addressable: the palette is applied to every one of them, not only the visible one. */
  const frames = new Map<string, HTMLIFrameElement>();
  for (const f of root.querySelectorAll<HTMLIFrameElement>('[data-em-frame]')) {
    if (f.dataset.emFrame) frames.set(f.dataset.emFrame, f);
  }
  const slugs = [...new Set([...frames.keys()].map((k) => k.split('|')[0]!))];
  if (!slugs.length) return;

  const params = new URLSearchParams(window.location.search);
  const wanted = params.get('email');
  let email = wanted && slugs.includes(wanted) ? wanted : slugs[0]!;
  let style: StyleKey = isStyle(params.get('style')) ? (params.get('style') as StyleKey) : 'one';
  let width: WidthKey = isWidth(params.get('width')) ? (params.get('width') as WidthKey) : 'desktop';
  let scheme: SchemeKey = isScheme(params.get('scheme')) ? (params.get('scheme') as SchemeKey) : 'light';

  const paint = (): void => {
    root.dataset.email = email;
    root.dataset.style = style;
    root.dataset.width = width;
    root.dataset.scheme = scheme;

    /* THE WIDTH BEING SET IS THE READING PANE'S, NOT THE EMAIL'S. `WIDTHS.desktop` is 600 and that
       is the width the email's BODY is built to, which MJML centres on its own background; the pane
       around it is as wide as the window. Setting the frame to 600 at desktop cropped the ground off
       at the body's edge and showed a letter with no surround. Mobile keeps its pixel value because
       375 is the number that fires the breakpoints. */
    for (const [key, frame] of frames) {
      frame.style.width = width === 'mobile' ? `${WIDTHS.mobile}px` : '100%';
      frame.parentElement?.setAttribute('data-hidden', String(key !== `${email}|${style}`));
      /* EVERY frame, not only the visible one: a hidden frame that keeps the old palette flashes it
         on the next pick, and `data-hidden` is `visibility`, so it is laid out and would be read by
         anything measuring the page. */
      setEmailScheme(frame, scheme);
    }

    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-email-pick]')) {
      btn.setAttribute('aria-current', String(btn.dataset.emailPick === email));
    }
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-width-pick]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.widthPick === width));
    }
    /* THE STYLE REFITS FOR THE SAME REASON THE PALETTE DOES, and more so: the two drawings are
     genuinely different heights, so a frame swapped without re-measuring shows the other one's. */
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-style-pick]')) {
    btn.addEventListener('click', () => {
      if (!isStyle(btn.dataset.stylePick ?? null)) return;
      style = btn.dataset.stylePick as StyleKey;
      paint();
      refit();
    });
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-scheme-pick]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.schemePick === scheme));
    }
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-style-pick]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.stylePick === style));
    }

    /* THE READOUT IS MEASURED AT DESKTOP AND DECLARED AT MOBILE, and the difference is honest:
       at mobile the frame IS 375, at desktop it is whatever this window gives it, which is the
       number a reader would want when judging how the 600px body sits in a pane. */
    const px = root.querySelector<HTMLElement>('[data-width-px]');
    if (px) {
      const shown = frames.get(`${email}|${style}`);
      px.textContent =
        width === 'mobile'
          ? `${WIDTHS.mobile}px`
          : `${Math.round(shown?.getBoundingClientRect().width ?? 0)}px pane`;
    }

    const next = new URLSearchParams();
    next.set('email', email);
    next.set('style', style);
    next.set('width', width);
    next.set('scheme', scheme);
    window.history.replaceState(null, '', `${window.location.pathname}?${next}`);
  };

  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-email-pick]')) {
    btn.addEventListener('click', () => {
      email = btn.dataset.emailPick ?? email;
      paint();
      refit();
    });
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-width-pick]')) {
    btn.addEventListener('click', () => {
      if (!isWidth(btn.dataset.widthPick ?? null)) return;
      width = btn.dataset.widthPick as WidthKey;
      paint();
      refit();
    });
  }
  /* THE PALETTE ALSO REFITS. It changes no box in these three templates today, but it is a stylesheet
     landing on the document, and a rule that alters a padding or a line height would silently leave
     every frame the wrong height. Refitting costs one frame; not refitting costs a wrong measurement
     that looks like a design decision. */
  /* THE STYLE REFITS FOR THE SAME REASON THE PALETTE DOES, and more so: the two drawings are
     genuinely different heights, so a frame swapped without re-measuring shows the other one's. */
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-style-pick]')) {
    btn.addEventListener('click', () => {
      if (!isStyle(btn.dataset.stylePick ?? null)) return;
      style = btn.dataset.stylePick as StyleKey;
      paint();
      refit();
    });
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-scheme-pick]')) {
    btn.addEventListener('click', () => {
      if (!isScheme(btn.dataset.schemePick ?? null)) return;
      scheme = btn.dataset.schemePick as SchemeKey;
      paint();
      refit();
    });
  }

  /* RE-MEASURE AFTER THE WIDTH MOVES, NEVER BEFORE. 600px of email reflowed into 375px gets taller —
     that is the whole reason both widths exist — so a height measured before the change belongs to
     the old width. `requestAnimationFrame` is what puts the reading after the browser has laid the
     frame out at its new size; measuring in the same tick reads the old layout.

     THE SIZING RULE ITSELF IS NOT HERE. It lives once, in `lib/email-frame.ts`, with the
     collapse-before-measuring fix and the measurement that forced it. This file only decides WHEN. */
  function refit(): void {
    window.requestAnimationFrame(() => {
      for (const f of frames.values()) fitEmailFrame(f);
    });
  }

  /* A `srcdoc` frame can finish loading AFTER `paint()` has run, and a load replaces the document,
     taking the injected palette with it. Measured 2026-08-24: `Dark` pressed, `aria-pressed` correct,
     `data-scheme="dark"` on the root, and the frame still light because its `<style>` had been thrown
     away with the old document. Nothing in `paint()` can see that; only the load can.

     This is why the listener re-applies the SCHEME and not just the height. `watchEmailFrame` below
     already refits on load and refitting was never the missing half. */
  for (const f of frames.values()) {
    f.addEventListener('load', () => {
      setEmailScheme(f, scheme);
      fitEmailFrame(f);
    });
  }

  for (const f of frames.values()) watchEmailFrame(f);
  paint();
  refit();
}
