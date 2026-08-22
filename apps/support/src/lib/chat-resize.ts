/**
 * Drag-to-resize for the chat drawer.
 *
 * WHY THIS AND NOT THE APP'S PANEL COMPONENT. Oleh asked for `apps/web`'s chat panel to be reused
 * here, on the grounds that it already resizes and two implementations of one thing is waste. The
 * capability is right; the mechanism is not available in this repo, for two reasons worth writing
 * down rather than rediscovering:
 *
 *   1. IT WOULD DRAG THE WHOLE APP'S STYLING IN. That panel is `PanelHost` + `panelStack` +
 *      `SchemaChat`, ~1,400 lines before the stack library, and every visual in it comes from
 *      Tailwind utility classes compiled against `apps/web`'s config plus `apps/web/src/styles/
 *      global.css`. The support portal deliberately loads NEITHER — `brand/baseout-bridge.css`
 *      carries a written rule never to point `customCss` at `global.css`, because those ~3,300
 *      mostly-unlayered lines would out-rank Starlight's reset, prose styles and layout at once.
 *      Importing the component means importing that, and the portal's typography is the product.
 *   2. IT IS BUILT FOR A DIFFERENT JOB. `PanelHost` is a STACK of up to ten sheets with split mode,
 *      per-page `TABLEGAP` / `MINCONTENT` widths measured against `/data` and `/schema`, ＋ pickers
 *      and detach. None of that has a meaning in a docs site. And the client drew the line himself:
 *      "there's talking with your data, but there's also asking a question" — these are two
 *      products, not one component used twice.
 *
 * So what got shared is the CAPABILITY, which is what was actually asked for, in the ~60 lines it
 * costs. If the two chats should genuinely converge later, the honest form is a shared package in
 * the real monorepo holding the panel SHELL — resize, header, stack behaviour — not a cross-app
 * import of a component whose styling contract this app has ruled out.
 */

const KEY_W = 'support-chat-width';
const MIN = 320;
/** Never let the drawer take the page: 70% of the viewport, and never past a comfortable reading
 *  width for the conversation itself. */
const max = () => Math.min(720, Math.round(window.innerWidth * 0.7));

const clamp = (n: number) => Math.max(MIN, Math.min(max(), n));

export function wireResize(panel: HTMLElement, grip: HTMLElement): void {
  /* The width lives on the ROOT, not on the drawer. The drawer reads it for its own size and the
     page reads it to reserve the same gutter — so dragging the drawer wider NARROWS the reading
     column instead of sliding on top of it. Written on the panel it was invisible to the layout,
     and a widened drawer covered the prose it was supposed to sit beside. */
  const apply = (w: number) =>
    document.documentElement.style.setProperty('--cd-w', `${clamp(w)}px`);

  const stored = Number(localStorage.getItem(KEY_W) ?? '0');
  if (stored) apply(stored);

  let startX = 0;
  let startW = 0;

  const onMove = (e: PointerEvent) => {
    /* The drawer is anchored to the right edge, so dragging its leading edge LEFT makes it wider —
       the delta is inverted relative to the pointer. */
    apply(startW + (startX - e.clientX));
  };

  const onUp = () => {
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    grip.removeEventListener('pointercancel', onUp);
    document.documentElement.removeAttribute('data-chat-resizing');
    localStorage.setItem(KEY_W, String(Math.round(panel.getBoundingClientRect().width)));
  };

  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    grip.setPointerCapture(e.pointerId);
    /* Suppresses the open/close transition for the duration — a 220ms ease on `width` would make
       the drag feel like it is lagging behind the cursor. */
    document.documentElement.setAttribute('data-chat-resizing', '');
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', onUp);
  });

  /* Keyboard: the grip is a real control, so it moves in steps and reports its size. */
  grip.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      apply(panel.getBoundingClientRect().width + step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      apply(panel.getBoundingClientRect().width - step);
    } else {
      return;
    }
    localStorage.setItem(KEY_W, String(Math.round(panel.getBoundingClientRect().width)));
  });

  /* A window narrowed past the stored width must not leave the drawer wider than the rule allows. */
  window.addEventListener('resize', () => apply(panel.getBoundingClientRect().width));
}
