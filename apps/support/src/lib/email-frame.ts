/**
 * Sizing an email iframe to its own content. ONE helper, two callers.
 *
 * `components/HandoffEmails.astro` (the overview on `/handoff/`) and `pages/handoff/emails.astro`
 * (the viewer) both need this, and a second copy is how the corrected version below would survive in
 * one file and the broken one in the other.
 *
 * ── COLLAPSE BEFORE MEASURING. THIS IS THE WHOLE FUNCTION. ─────────────────────────────────────
 * A document inside an iframe fills that iframe's viewport, so `documentElement.scrollHeight`
 * returns the FRAME's current height whenever the content is shorter than it. Read at the 640px
 * fallback the answer is 640, and the assignment that follows is a no-op — the frame can only ever
 * grow, never shrink to fit. Measured on the overview before the fix: two of the three emails sat at
 * 640px holding 407px and 551px of content, leaving 233px and 89px of dead space under a wireframe
 * whose entire job is to show how long each email actually is. Setting the height to `0` first makes
 * the reading the content's own.
 *
 * `documentElement`, not `body`: MJML's outer table is the body's child, and a body with no height of
 * its own reports zero.
 *
 * ── A WIDTH CHANGE INVALIDATES EVERY HEIGHT ────────────────────────────────────────────────────
 * Reflowing 600px of email into 375px lengthens it — that is the point of looking at both — so the
 * viewer must call this again AFTER the new width has been applied, not before. Any caller that
 * moves a frame's width and does not re-measure is showing a height that belonged to the old one.
 */
export function fitEmailFrame(frame: HTMLIFrameElement): void {
  const doc = frame.contentDocument;
  if (!doc) return;
  frame.style.height = '0px';
  const h = doc.documentElement.scrollHeight;
  frame.style.height = h > 0 ? `${h}px` : '';
}

/**
 * Wire a frame so it measures itself whenever it can.
 *
 * BOTH CALLS, AND NEITHER IS REDUNDANT: a `srcdoc` frame can finish parsing before this module runs,
 * in which case no `load` event will ever follow; a lazy frame can load long after it.
 */
export function watchEmailFrame(frame: HTMLIFrameElement): void {
  fitEmailFrame(frame);
  frame.addEventListener('load', () => fitEmailFrame(frame));
}

/**
 * Show an email's DARK palette inside a preview frame.
 *
 * ── WHY THIS IS NOT A CLASS ON THE EMAIL ───────────────────────────────────────────────────────
 * The dark palette lives in the templates under `@media (prefers-color-scheme: dark)`, which is the
 * only hook a real mail client offers. A page CANNOT force that media feature on an iframe: it is
 * resolved against the OS and the browser, not against the parent document. So a viewer toggle has
 * exactly two options, and only one of them is honest.
 *
 * The dishonest one is to add a second hook to the templates — `[data-theme="dark"]` beside every
 * media query — and have the toggle set it. That ships a selector that no mail client will ever
 * match, doubles thirty declarations a third time, and lets the two copies drift; the preview would
 * then be showing rules that are not the rules.
 *
 * This is the other one: read the email's OWN dark block out of its stylesheet at runtime and re-emit
 * its contents unconditionally. What the toggle shows is therefore, by construction, the same
 * declarations a client honouring the media query would apply. If the dark block is empty, malformed
 * or renamed, this shows nothing changing, which is the correct report rather than a broken one.
 *
 * ── ONE SHEET IN A `srcdoc` FRAME THROWS, AND NOT GUARDING IT BROKE THE WHOLE CONTROL ─────────
 * Measured 2026-08-24: of the seven stylesheets in the acknowledgement's frame, index 1 raises
 * `SecurityError: Cannot access rules` — the browser attaches it to the document but treats it as
 * cross-origin. The dark block is index 5, so an unguarded loop throws before it ever reaches it.
 *
 * The first version of this said the throw should be "left to fail loudly" rather than swallowed.
 * That was wrong twice over. It did not fail loudly: the exception escaped `paint()`, which had
 * already written `data-scheme` and had not yet written the button states, so the page went dark
 * around an email that stayed light and the two toggle buttons disagreed with the stage. And it is
 * not an anomaly worth noticing — it is the normal condition of this frame, on every load. A guard
 * that skips an unreadable sheet is correct here, and the honest report is the one at the end: if
 * NO dark rules were found at all, that is worth saying out loud, because it means the templates
 * lost their dark block and the toggle would otherwise just look broken.
 */
const SCHEME_STYLE = 'data-bo-scheme';

export function setEmailScheme(frame: HTMLIFrameElement, scheme: 'light' | 'dark'): void {
  const doc = frame.contentDocument;
  if (!doc) return;

  let el = doc.querySelector<HTMLStyleElement>(`style[${SCHEME_STYLE}]`);
  if (!el) {
    el = doc.createElement('style');
    el.setAttribute(SCHEME_STYLE, '');
    doc.head.appendChild(el);
  }

  if (scheme === 'light') {
    el.textContent = '';
    return;
  }

  const out: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    /* The injected sheet is skipped, or the second press would read its own output back in. */
    if ((sheet.ownerNode as Element | null)?.hasAttribute?.(SCHEME_STYLE)) continue;

    let rules: CSSRule[];
    try {
      rules = Array.from(sheet.cssRules);
    } catch {
      continue;
    }

    for (const rule of rules) {
      const media = rule as CSSMediaRule;
      if (typeof media.conditionText !== 'string' || !media.cssRules) continue;
      if (!/prefers-color-scheme\s*:\s*dark/.test(media.conditionText)) continue;
      for (const inner of Array.from(media.cssRules)) out.push(inner.cssText);
    }
  }

  if (!out.length) {
    console.warn(
      '[email-frame] No `prefers-color-scheme: dark` rules found in this email. The dark palette ' +
        'lives in emails/partials/head.mjml; if it was removed or renamed, the toggle has nothing ' +
        'to show and this frame is still the light one.',
    );
  }
  el.textContent = out.join('\n');
}
