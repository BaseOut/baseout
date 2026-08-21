/**
 * panelHostRegistry — the KIND registry that lets ONE `createPanelStack` hold sheets of several
 * different kinds (catalog `pattern-multi-panel-drawer`).
 *
 * Why this exists (Oleh's law, 2026-08-03): **no overlapping panels anywhere · one stack, up to 10
 * panels · an entity's drawer looks and behaves IDENTICALLY from every section.** The Data page used
 * to mount FOUR independent stacks — RecordPanel, MediaPanel, DataChangelog and (via DataView)
 * EntityPanel — whose roots are all `position: fixed; inset: 0`. They literally sat on top of one
 * another, which is the defect the founder reported.
 *
 * This is NOT a new host design. It is the generalisation of the one that already existed:
 * `MediaPanel.astro` was already a three-kind host (`asset:` + `record:` + `entity:`) with a
 * discriminated panel union, a prefix-keyed `panelKey`, a prefix `canOpen` and a `buildPanel(id)`
 * that dispatched on the id prefix. Everything below is that dispatch table, lifted out of one
 * component so four can share it.
 *
 * ── The contract ──────────────────────────────────────────────────────────────────────────────
 * Each component that owns a SHEET (its `<template>`, its body render, its data snapshot) registers
 * a `PanelKind` under a colon-terminated id prefix. `PanelHost.astro` mounts exactly one root, one
 * `panelsEl`, one control column, one add-pop anchor and one toast, and runs exactly ONE
 * `createPanelStack` whose every host hook dispatches through `kindFor(id)` / `kindOfPanel(p)`.
 *
 * Registration order does not matter: the host resolves a kind at DISPATCH time, never at mount
 * time, and the host API is reached through the lazy `host` proxy below rather than captured. Astro
 * bundles every component `<script>` on a page into one graph, so this module is a singleton and
 * both sides see the same registry.
 *
 * A component that registers a kind must NOT create its own `createPanelStack`, its own
 * `position: fixed` root, or its own rail — that is exactly the duplication this removes.
 */

import type { PickerSource } from './panelAddPicker';

/** The six fields `createPanelStack` manages on every panel, whichever sheet it is. */
export interface StackFields {
  el: HTMLElement;
  uid: number;
  anchor: boolean;
  w: number;
  seq: number;
  collapsed: boolean;
}

/** Every hosted panel carries the prefix of the kind that built it, so the host can route back. */
export interface HostPanel extends StackFields {
  /** The registered kind prefix, e.g. `record:` — stamped by the host right after `buildPanel`. */
  kind: string;
}

/**
 * One sheet KIND. The shape is deliberately the set of `PanelStackConfig` hooks that are genuinely
 * content-specific, plus the two numbers that are per-surface, plus the picker the ＋ opens.
 */
export interface PanelKind<P extends HostPanel = HostPanel> {
  /** Colon-terminated id prefix — `record:` · `asset:` · `run:` · `entity:`. Ids are ALWAYS prefixed. */
  prefix: string;
  /** Clone this kind's template and wire its own DOM refs. The host fills the stack fields after. */
  buildPanel: (id: string) => P;
  /** Point an existing panel of this kind at a new content id (reset the kind's own view state). */
  loadInto: (p: P, id: string) => void;
  /** Render a panel's body/header. */
  render: (p: P) => void;
  /** The content key used to dedup an open — ALWAYS prefixed, so keys never collide across kinds. */
  panelKey: (p: P) => string;
  /** Reject an open (the id is not in this backup). Paired with `onMissing`. */
  canOpen?: (id: string) => boolean;
  /** Say why an open was refused. The host un-hides its root first so the toast is visible. */
  onMissing?: (id: string) => void;
  /** Single-column (mobile) open-beside, when this kind drills in place instead of spawning. */
  mobileOpen?: (p: P | null, id: string) => void;
  /** Focus changed on a panel of this kind (a rich per-panel controller routes shortcuts on it). */
  onFocus?: (p: P, isFocused: boolean) => void;
  /** A panel of this kind is about to be removed — unbind its listeners. */
  onDestroy?: (p: P) => void;
  /**
   * Escape was pressed while a panel of this kind is focused. Return `true` if the KIND consumed it
   * (an open editor, an in-place sub-view to pop, a controller with its own Escape); the host closes
   * the focused panel only when every kind declines. This replaces the two cross-stack Escape hacks
   * that used to guess at each other's DOM.
   */
  onEsc?: (p: P) => boolean;
  /**
   * PER-KIND minimum expanded width, in px. This is the `minwOf` hook from step 6: one number for
   * the whole stack only works while a stack holds ONE kind of sheet, and this one does not.
   */
  minw: number;
  /** Copy for the Pin toast — a file, a record, a run and an entity are pinned for different reasons. */
  detachedText?: string;
  /**
   * What this kind contributes to the host's ONE ＋ picker (components/ui/panelAddPicker.ts).
   *
   * This replaced a per-kind `openAddPop`. Each kind used to own a whole POPOVER — its own markup,
   * its own copy of the same placement maths, its own engine instance — and the ＋ opened whichever
   * one belonged to the focused panel, so you could only ever add what you were already looking at.
   * A kind now supplies only the part nobody else can: the rows, how they group, and how one opens.
   * The popover, the placement, the chips, the footer count and the keyboard are the host's, once.
   *
   * A kind may return MORE than one source, and a source need not correspond to a panel kind:
   * `record:` returns **Records** and **Comments**, because a comment thread lives inside the
   * record panel rather than in a panel of its own. The FIRST source is the kind's default scope
   * when the ＋ is pressed with one of its panels focused.
   *
   * A function, not an array: the rows behind a source are read live (a DOM listing, a snapshot),
   * and so is a source's own label.
   */
  pickerSources?: () => PickerSource[];
}

const kinds: PanelKind<never>[] = [];

/**
 * "Every kind on this page has registered." — the signal a host needs before it may ask `canOpen`
 * about anything, and there is no other honest one.
 *
 * `PanelHost` used to restore its saved arrangement from a `setTimeout(…, 0)`, on the reasoning that
 * one macrotask lands after every module script on the page. That holds when Astro bundles the page
 * into ONE graph. It does not hold in dev, where every component `<script>` is served as its own
 * `<script type="module">` and therefore evaluates in its own task: measured on `/schema`, the
 * timeout fired while `entity:` was still unregistered, so `canOpen` answered "no" to every saved id
 * and two panels were dropped in silence — no error, both gates green.
 *
 * So the schedule hangs off the REGISTRATIONS instead of off a guess about them: each one restarts a
 * zero-delay timer, and the callback runs once the burst stops. One kind or five, dev or built, the
 * callback fires after the last of them.
 */
type Settled = () => void;
const settledCbs = new Set<Settled>();
let settleTimer = 0;
function scheduleSettled() {
  window.clearTimeout(settleTimer);
  // Iterate a COPY: a callback may unsubscribe itself (the usual case — it got what it needed) and
  // mutating the set mid-iteration would skip its neighbour.
  settleTimer = window.setTimeout(() => [...settledCbs].forEach((cb) => cb()), 0);
}
/**
 * Run `cb` once the current burst of kind registrations has finished. Safe to call before any.
 *
 * Returns an UNSUBSCRIBE, and callers are expected to use it. Without one the list only ever grows:
 * `astro:after-swap` re-wires the host (adding a callback) and re-registers the kinds (firing them
 * all), so every later burst also runs callbacks closed over torn-down stacks and detached DOM.
 */
export function onKindsSettled(cb: Settled): () => void {
  settledCbs.add(cb);
  scheduleSettled();
  return () => { settledCbs.delete(cb); };
}

/** Register (or replace) a kind. Idempotent per prefix, so an `astro:after-swap` re-wire is safe. */
export function registerPanelKind<P extends HostPanel>(kind: PanelKind<P>): void {
  const i = kinds.findIndex((k) => k.prefix === kind.prefix);
  const entry = kind as unknown as PanelKind<never>;
  if (i >= 0) kinds[i] = entry; else kinds.push(entry);
  scheduleSettled();
}

/** Every registered kind, in registration order. */
export function panelKinds(): PanelKind<HostPanel>[] {
  return kinds as unknown as PanelKind<HostPanel>[];
}

/** The kind that owns a prefixed id. */
export function kindFor(id: string): PanelKind<HostPanel> | null {
  return (kinds as unknown as PanelKind<HostPanel>[]).find((k) => id.startsWith(k.prefix)) || null;
}

/** The kind that built a live panel. */
export function kindOfPanel(p: HostPanel): PanelKind<HostPanel> | null {
  return (kinds as unknown as PanelKind<HostPanel>[]).find((k) => k.prefix === p.kind) || null;
}

/** The slice of the stack API a KIND is allowed to call. Deliberately narrow: a kind opens, closes
 *  and reads; it never lays out, evicts or resizes — those belong to the one host. */
export interface PanelHostApi {
  open: (id: string, init?: (p: HostPanel) => void) => void;
  /** `init` runs on the new panel BEFORE its first render — the seam a caller uses to say what the
   *  panel should be showing when it appears (a record opened at a particular comment). It was
   *  missing here while `panelStack.openBeside` had always taken it, so a 3-argument call compiled
   *  (astro check does not read `.astro` script blocks) and the argument was silently dropped. */
  openBeside: (source: HostPanel | null, id: string, init?: (p: HostPanel) => void) => void;
  createPanel: (id: string, anchor: boolean, init?: (p: HostPanel) => void) => HostPanel;
  closePanel: (p: HostPanel) => void;
  /** Close the least-recently-focused panel. A kind reaches for this only to make room for a panel
   *  the user explicitly asked for while the stack is at its hard cap (the "Close oldest" offer). */
  evictLRU: (announce?: boolean) => void;
  panels: () => HostPanel[];
  focused: () => HostPanel | null;
  atCap: () => boolean;
  layout: () => void;
  toast: (label: string, action: { label: string; run: () => void; icon?: string } | null, ms?: number) => void;
  /** True once `PanelHost.astro` has mounted on this page. Every section with panels mounts this host since 2026-08-06 — `/data`, `/schema` and both Reports views. */
  mounted: () => boolean;
}

let api: PanelHostApi | null = null;

/** Called once by `PanelHost.astro`. */
export function setPanelHost(a: PanelHostApi): void { api = a; }

/**
 * The lazy host proxy. Kinds capture THIS, not the API, so a kind's script may run before or after
 * the host's — the only ordering guarantee Astro gives across bundled component scripts.
 * Every method is a no-op when no host is mounted (e.g. EntityPanel on the Reports views, which drives its
 * own standalone stack instead).
 */
export const host: PanelHostApi = {
  open: (id, init) => api?.open(id, init),
  openBeside: (s, id, init) => api?.openBeside(s, id, init),
  createPanel: (id, anchor, init) => api!.createPanel(id, anchor, init),
  closePanel: (p) => api?.closePanel(p),
  evictLRU: (a) => api?.evictLRU(a),
  panels: () => api?.panels() || [],
  focused: () => api?.focused() || null,
  atCap: () => api?.atCap() || false,
  layout: () => api?.layout(),
  toast: (l, a, ms) => api?.toast(l, a, ms),
  mounted: () => !!api,
};
