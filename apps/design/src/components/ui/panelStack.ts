/**
 * panelStack — the ONE stacking multi-panel drawer controller (catalog `pattern-multi-panel-drawer`).
 *
 * Extracted 2026-07-22 from three hand-copied controllers (Schema EntityPanel `.ep-*`, Data RecordPanel
 * `.rp-*`, Data Changelog drill `.dcp-*`) that had drifted (different constants, duplicated 46px strip
 * literal + magic numbers). This owns the CONTENT-AGNOSTIC stack mechanics — the panel array, per-panel
 * width/anchor/focus/collapse, auto-accordion layout, per-panel resize grip, stack shutter, reorder,
 * park/expand, cap-with-undo, mobile fold — and calls back into the host for everything DOM/content
 * specific (cloning a panel, rendering it, keying it for dedup, showing a toast, flashing a new panel).
 *
 * A host panel object must extend `StackPanel` (el + the six stack-managed fields); everything else on it
 * (body refs, per-panel view state) is the host's own and the controller never touches it.
 */

/** The minimum shape the controller manages on every panel; hosts extend this with their own fields. */
export interface StackPanel {
  el: HTMLElement;
  /** Stable id for this panel instance (not the content id). */
  uid: number;
  /** The anchor is slot-0, created by a plain open; it never reorders and is never the eviction victim. */
  anchor: boolean;
  /** Stored expanded width in px (what the panel returns to when un-parked). */
  w: number;
  /** Focus recency — higher = more recently focused; drives which panel the accordion parks first. */
  seq: number;
  /** Parked to a slim strip. */
  collapsed: boolean;
}

export interface ToastAction { label: string; run: () => void; icon?: string; }

export interface PanelStackConfig<P extends StackPanel> {
  /** Root drawer element (hidden when the stack is empty). */
  root: HTMLElement;
  /** The flex row that holds the panels in DOM order (array[0] = anchor = leftmost). */
  panelsEl: HTMLElement;
  /** The zero-width rail (＋ picker + shutter + count); hidden when the stack is empty. */
  railEl: HTMLElement;
  /** Optional open-panel count badge on the rail. */
  countEl?: HTMLElement | null;
  /** The stack shutter pill (drag / ←→ to resize every expanded panel together). */
  shutterEl?: HTMLElement | null;

  /** Stack geometry. Only MINW + TABLEGAP are genuinely per-surface (records want a wider floor; a page
   *  reserves more/less peek to the left of the drawer); the rest are shared INVARIANTS with sensible
   *  defaults, so a host overrides one only with a reason. STRIP = parked-strip width (a bare `46` in
   *  every old copy). MINEXP defaults to MINW (the promise "N panels fit expanded side by side"). */
  DEFW?: number; MINW?: number; TABLEGAP?: number; MAXPANELS?: number; MINEXP?: number; COLLAPSE_AT?: number;
  STRIP?: number;
  /** localStorage key for the remembered expanded width. */
  storageKey: string;
  /** The per-panel width CSS custom property, e.g. `--rp-w`. */
  widthVar: string;
  /** Prefix-specific class names toggled on panel elements. */
  cls: {
    collapsed: string; focus: string; anchor: string; flash: string;
    gripOn: string; dragging: string; reordering: string;
  };
  /** Reorder-grip selector (delegated pointerdown); a panel is `[data-…-panel]`. */
  reorderSel: string;
  panelSel: string;
  /** Per-panel resize-grip selector (the full-height left edge line), resolved within each panel. */
  gripSel: string;

  /** Is the viewport in single-panel (mobile) mode? Defaults to `window.matchMedia('(max-width: 1023.98px)').matches`. */
  isMobile?: () => boolean;

  // ── Host hooks ──
  /** Clone the template + wire the panel's own DOM refs/state; return the panel. uid/seq/w/anchor/collapsed
   *  are filled by the controller right after, so the host may pass placeholders. */
  buildPanel: () => P;
  /** Point an existing panel at a new content id (reset the host's per-panel view state). */
  loadInto: (p: P, id: string) => void;
  /** Render a panel's body/header. */
  render: (p: P) => void;
  /** The content key used to dedup an open (usually the top-of-stack id; return '' to never dedup). */
  panelKey: (p: P) => string;
  /** Optional: reject an open (e.g. record not in this backup). Return false to abort; pair with onMissing. */
  canOpen?: (id: string) => boolean;
  onMissing?: (id: string) => void;
  /** Mobile open-beside: hosts drill in place instead of spawning a panel. */
  mobileOpen?: (p: P | null, id: string) => void;
  /** Called for every panel whenever focus changes (host may drive a per-panel active flag, e.g. the
   *  Schema EntityPanel routes keyboard shortcuts to `panel.setActive`). Runs after the focus class toggle. */
  onFocus?: (p: P, isFocused: boolean) => void;
  /** Called right before a panel's element is removed (close / evict / closeAll) so a host with a rich
   *  per-panel controller can tear it down (unbind listeners) — the Schema EntityPanel's `panel.doClose`. */
  onDestroy?: (p: P) => void;

  /** Show a toast; the host owns the toast DOM + copy. `null` action = an info toast. */
  toast: (label: string, action: ToastAction | null, ms?: number) => void;
  /** Hide any toast. */
  hideToast: () => void;
  /** Undo/info copy (host owns wording). */
  text: { closed: string; capReached: (max: number) => string; evicted: (max: number) => string; noRoom: string; detached?: string; };
  /** Optional flash animation for a freshly-opened non-anchor panel. */
  flash?: (el: HTMLElement) => void;
  /** Optional cleanup when the stack empties (e.g. close a ＋ picker popover). */
  onEmpty?: () => void;
}

export interface PanelStackApi<P extends StackPanel> {
  panels: () => P[];
  focused: () => P | null;
  anchorOf: () => P | null;
  byUid: (uid: number) => P | null;
  open: (id: string, init?: (p: P) => void) => void;
  openBeside: (source: P | null, id: string, init?: (p: P) => void) => void;
  /** Low-level: create a panel (host openFieldBeside-style flows). */
  createPanel: (id: string, anchor: boolean, init?: (p: P) => void) => P;
  closePanel: (p: P) => void;
  /** Tear down every panel at once (host Esc-on-anchor / close-all). */
  closeAll: () => void;
  detachPanel: (p: P) => void;
  parkPanel: (uid: number) => void;
  expandPanel: (uid: number) => void;
  evictLRU: (announce?: boolean) => void;
  layout: () => void;
  setFocus: (p: P | null) => void;
  atCap: () => boolean;
  /** Re-run the last close as an undo (host wires this into its undo toast action). */
  reopenLastClosed: () => void;
}

export function createPanelStack<P extends StackPanel>(cfg: PanelStackConfig<P>): PanelStackApi<P> {
  // Shared invariants default here; a host passes only what is genuinely its own (usually MINW + TABLEGAP).
  const STRIP = cfg.STRIP ?? 46;
  const DEFW = cfg.DEFW ?? 480;
  const MINW = cfg.MINW ?? 360;
  const TABLEGAP = cfg.TABLEGAP ?? 64;
  const MAXPANELS = cfg.MAXPANELS ?? 10;
  const MINEXP = cfg.MINEXP ?? MINW;
  const COLLAPSE_AT = cfg.COLLAPSE_AT ?? 300;
  // Matches the CSS single-column breakpoint (1023.98px). RecordPanel and the Changelog drill pass
  // this same literal; EntityPanel takes the default, so it MUST agree with the stylesheet or the
  // Schema panel renders mobile CSS while the controller runs desktop logic for the 900–1023 band.
  const isMobile = cfg.isMobile ?? (() => window.matchMedia('(max-width: 1023.98px)').matches);
  const { root, panelsEl, railEl, cls } = cfg;

  let panels: P[] = [];
  let focused: P | null = null;
  let uidSeq = 1, focusSeq = 1;
  let lastClosed: { id: string; anchor: boolean } | null = null;

  const loadW = () => { const v = Number(localStorage.getItem(cfg.storageKey) || 0); return v >= MINW ? v : DEFW; };
  const saveW = (px: number) => { try { localStorage.setItem(cfg.storageKey, String(Math.round(px))); } catch { /* ignore */ } };
  let defW = loadW();

  const byUid = (uid: number) => panels.find((p) => p.uid === uid) || null;
  const anchorOf = () => panels.find((p) => p.anchor) || null;
  const atCap = () => panels.length >= MAXPANELS;
  const syncOrder = () => panels.forEach((p) => panelsEl.appendChild(p.el));

  function showRail() {
    railEl.hidden = panels.length === 0;
    if (cfg.countEl) { cfg.countEl.textContent = String(panels.length); cfg.countEl.hidden = panels.length < 2; }
  }
  function setFocus(p: P | null) {
    focused = p; if (p) p.seq = ++focusSeq;
    panels.forEach((q) => { const f = q === focused; q.el.classList.toggle(cls.focus, f); cfg.onFocus?.(q, f); });
  }
  const setAnchorFlags = () => panels.forEach((q) => q.el.classList.toggle(cls.anchor, q.anchor));
  const setWidth = (p: P, px: number | null) => { if (px == null) p.el.style.removeProperty(cfg.widthVar); else p.el.style.setProperty(cfg.widthVar, px + 'px'); };

  // Auto-accordion: park the least-recently-focused overflow to strips; each strip eats STRIP px of the
  // same budget, so parking one can force another — iterate until it settles.
  function layout() {
    if (!panels.length) { root.hidden = true; railEl.hidden = true; return; }
    root.hidden = false;
    showRail(); setAnchorFlags();
    if (isMobile()) {
      panels.forEach((p) => { p.el.classList.remove(cls.collapsed); setWidth(p, null); p.el.style.display = (p === focused || panels.length === 1) ? '' : 'none'; });
      return;
    }
    panels.forEach((p) => p.el.style.removeProperty('display'));
    const avail = window.innerWidth - TABLEGAP;
    for (;;) {
      const strips = panels.filter((p) => p.collapsed).length;
      const cap = Math.max(1, Math.floor((avail - strips * STRIP) / MINEXP));
      const expandedList = panels.filter((p) => !p.collapsed);
      if (expandedList.length <= cap) break;
      const victim = expandedList.filter((p) => !p.anchor).sort((a, b) => a.seq - b.seq)[0] || expandedList[0];
      victim.collapsed = true;
    }
    panels.forEach((p) => p.el.classList.toggle(cls.collapsed, p.collapsed));
    const expanded = panels.filter((p) => !p.collapsed);
    const expAvail = avail - (panels.length - expanded.length) * STRIP;
    let ws = expanded.map((p) => p.w);
    const sum = ws.reduce((a, b) => a + b, 0);
    if (sum > expAvail) { const k = expAvail / sum; ws = ws.map((w) => Math.max(MINW, Math.round(w * k))); }
    let ei = 0;
    panels.forEach((p) => { if (p.collapsed) setWidth(p, STRIP); else setWidth(p, ws[ei++]); });
  }

  function roomToExpand(): boolean {
    if (isMobile()) return true;
    const avail = window.innerWidth - TABLEGAP;
    const strips = panels.filter((p) => p.collapsed).length;
    const cap = Math.max(1, Math.floor((avail - strips * STRIP) / MINEXP));
    return panels.filter((p) => !p.collapsed).length < cap;
  }

  // Stack resize (the shutter pill): drag drives the TOTAL width so every expanded panel ends equal. Panels
  // park ONE AT A TIME, leftmost first; pulling back out unparks them right to left.
  function stackResize(total: number): number | null {
    const n = panels.length; if (!n) return null;
    const maxTotal = window.innerWidth - TABLEGAP;
    const S = Math.min(total, maxTotal);
    let k = 0;
    for (let i = n; i >= 1; i--) { if (i * MINW + (n - i) * STRIP <= S) { k = i; break; } }
    const w = k ? Math.round(Math.max(MINW, Math.min((S - (n - k) * STRIP) / k, (maxTotal - (n - k) * STRIP) / k))) : MINW;
    panels.forEach((p, i) => { p.collapsed = i < n - k; p.w = w; });
    layout();
    return k ? w : null;
  }

  function wireShutter() {
    const sh = cfg.shutterEl; if (!sh) return;
    const stackWidth = () => panels.reduce((a, p) => a + (p.collapsed ? STRIP : p.w), 0);
    sh.addEventListener('pointerdown', (e) => {
      if (isMobile()) return; e.preventDefault(); sh.classList.add(cls.gripOn);
      const sx = (e as PointerEvent).clientX, st = stackWidth();
      const mv = (me: PointerEvent) => { stackResize(st + (sx - me.clientX)); };
      const end = () => {
        sh.classList.remove(cls.gripOn);
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end);
        const w = panels.find((p) => !p.collapsed)?.w; if (w) { defW = w; saveW(w); }
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
    });
    sh.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      const n = panels.length || 1;
      let target = stackWidth() + (k === 'ArrowLeft' ? 32 : -32) * n;
      if (k === 'ArrowLeft') target = Math.max(target, MINW + (n - 1) * STRIP);
      const w = stackResize(target);
      if (w) { defW = w; saveW(w); }
    });
  }

  function wireGrip(p: P) {
    const g = p.el.querySelector<HTMLElement>(cfg.gripSel); if (!g) return;
    g.addEventListener('pointerdown', (e) => {
      if (isMobile()) return;
      e.preventDefault(); g.classList.add(cls.gripOn);
      const sx = (e as PointerEvent).clientX, sw = p.w;
      const mv = (me: PointerEvent) => {
        const raw = sw + (sx - me.clientX);
        if (raw < COLLAPSE_AT) { end(); parkPanel(p.uid); return; }
        p.w = Math.max(MINW, Math.min(raw, window.innerWidth * 0.7)); layout();
      };
      const end = () => { g.classList.remove(cls.gripOn); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end); defW = p.w; saveW(p.w); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
    });
  }

  function buildPanel(): P {
    const p = cfg.buildPanel();
    p.uid = uidSeq++; p.anchor = false; p.w = defW; p.seq = ++focusSeq; p.collapsed = false;
    wireGrip(p);
    return p;
  }

  function createPanel(id: string, anchor: boolean, init?: (p: P) => void): P {
    if (anchor && atCap()) evictLRU();
    const p = buildPanel();
    p.anchor = anchor;
    panelsEl.appendChild(p.el);
    const bornParked = !anchor && !roomToExpand();
    p.collapsed = bornParked;
    cfg.loadInto(p, id);
    if (init) init(p);
    if (anchor) panels.unshift(p); else panels.push(p);
    syncOrder();
    cfg.render(p);
    if (bornParked) cfg.toast(cfg.text.noRoom, null);
    else { setFocus(p); if (!anchor && cfg.flash) cfg.flash(p.el); }
    return p;
  }

  function closePanel(p: P) {
    const i = panels.indexOf(p); if (i < 0) return;
    lastClosed = { id: cfg.panelKey(p), anchor: p.anchor };
    cfg.onDestroy?.(p);
    const el = p.el; window.setTimeout(() => el.remove(), 0);
    panels.splice(i, 1);
    if (focused === p) { const n = panels[Math.max(0, i - 1)]; if (n) setFocus(n); else focused = null; }
    if (!panels.length) { closeAll(); return; }
    cfg.toast(cfg.text.closed, undoAction());
    layout();
  }
  function closeAll() { panels.slice().forEach((p) => { cfg.onDestroy?.(p); p.el.remove(); }); panels = []; focused = null; cfg.onEmpty?.(); cfg.hideToast(); root.hidden = true; railEl.hidden = true; }

  function evictLRU(announce = true) {
    const victim = panels.filter((p) => !p.anchor).sort((a, b) => a.seq - b.seq)[0] || panels[0]; if (!victim) return;
    lastClosed = { id: cfg.panelKey(victim), anchor: victim.anchor };
    cfg.onDestroy?.(victim);
    victim.el.remove();
    panels = panels.filter((p) => p !== victim);
    if (announce) cfg.toast(cfg.text.evicted(MAXPANELS), undoAction());
  }

  function open(id: string, init?: (p: P) => void) {
    if (cfg.canOpen && !cfg.canOpen(id)) { cfg.onMissing?.(id); return; }
    root.hidden = false;
    const ex = panels.find((q) => cfg.panelKey(q) === id);
    if (ex) { ex.collapsed = false; init?.(ex); setFocus(ex); cfg.render(ex); ex.el.scrollIntoView({ inline: 'nearest', block: 'nearest' }); layout(); return; }
    const a = anchorOf();
    if (a) { a.collapsed = false; cfg.loadInto(a, id); init?.(a); setFocus(a); cfg.render(a); layout(); }
    else { createPanel(id, true, init); layout(); }
  }

  function openBeside(source: P | null, id: string, init?: (p: P) => void) {
    if (cfg.canOpen && !cfg.canOpen(id)) { cfg.onMissing?.(id); return; }
    root.hidden = false;
    if (isMobile()) { if (cfg.mobileOpen) cfg.mobileOpen(source || focused, id); else open(id, init); return; }
    const ex = panels.find((q) => cfg.panelKey(q) === id);
    if (ex) { ex.collapsed = false; setFocus(ex); cfg.render(ex); layout(); return; }
    if (atCap()) {
      cfg.toast(cfg.text.capReached(MAXPANELS),
        { label: 'Close oldest', icon: 'lucide--layers', run: () => { evictLRU(false); createPanel(id, false, init); layout(); } }, 6000);
      return;
    }
    createPanel(id, false, init); layout();
  }

  function detachPanel(p: P) {
    if (!p.anchor) return;
    p.anchor = false; setAnchorFlags();
    if (cfg.text.detached) cfg.toast(cfg.text.detached, null);
  }
  function parkPanel(uid: number) { const p = byUid(uid); if (!p || p.collapsed) return; p.collapsed = true; layout(); }
  function expandPanel(uid: number) { const p = byUid(uid); if (!p) return; p.collapsed = false; setFocus(p); layout(); }

  // Reorder — drag the ⠿ grip to live-swap panel order (anchor stays in slot 0).
  function uidAtX(x: number): number { for (const p of panels) { const r = p.el.getBoundingClientRect(); if (x >= r.left && x <= r.right) return p.uid; } return 0; }
  function movePanel(dragUid: number, overUid: number) {
    const from = panels.findIndex((p) => p.uid === dragUid), to = panels.findIndex((p) => p.uid === overUid);
    if (from < 0 || to < 0 || from === to) return;
    if (panels[from].anchor) return;
    if (anchorOf() && to === 0) return;
    const [m] = panels.splice(from, 1); panels.splice(to, 0, m);
    syncOrder(); layout();
  }
  document.addEventListener('pointerdown', (e) => {
    const h = (e.target as HTMLElement).closest<HTMLElement>(cfg.reorderSel); if (!h || isMobile()) return;
    const sheet = h.closest<HTMLElement>(cfg.panelSel); const p = panels.find((q) => q.el === sheet); if (!p) return;
    e.preventDefault(); const dragUid = p.uid, sx = (e as PointerEvent).clientX; let dragging = false; h.classList.add(cls.gripOn);
    const mv = (me: PointerEvent) => {
      if (!dragging && Math.abs(me.clientX - sx) > 6) { dragging = true; p.el.classList.add(cls.dragging); if (anchorOf()) panelsEl.classList.add(cls.reordering); }
      if (!dragging) return; const over = uidAtX(me.clientX); if (over && over !== dragUid) movePanel(dragUid, over);
    };
    const end = () => { h.classList.remove(cls.gripOn); p.el.classList.remove(cls.dragging); panelsEl.classList.remove(cls.reordering); document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', end); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', end);
  });

  const undoAction = (): ToastAction | null => { if (!lastClosed) return null; const s = lastClosed; return { label: 'Undo', run: () => reopenLastClosed(s) }; };
  function reopenLastClosed(s?: { id: string; anchor: boolean } | null) {
    const t = s || lastClosed; if (!t || !t.id) return;
    createPanel(t.id, t.anchor && !anchorOf()); layout();
  }

  wireShutter();

  return {
    panels: () => panels,
    focused: () => focused,
    anchorOf, byUid,
    open, openBeside, createPanel, closePanel, closeAll, detachPanel, parkPanel, expandPanel, evictLRU,
    layout, setFocus, atCap,
    reopenLastClosed: () => reopenLastClosed(),
  };
}
