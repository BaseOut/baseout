/**
 * sectionTabs — the ONE controller behind `pattern-section-tabs`.
 *
 * The tab CSS was extracted into `global.css` a while back, but the twenty lines of JS that
 * actually switch a tab were still hand-copied into every host, and the copies had already
 * drifted: SchemaView's carried a "/" search shortcut and a React-Flow resize nudge, DataView's
 * carried neither, and — the reason this module exists — NEITHER read the URL.
 *
 * That last one was not a missing nicety. It meant a tab was not addressable at all:
 * `/data?tab=comments` silently opened Browse, so nothing outside the page could point at a
 * specific tab — not a handoff step, not a link in a spec, not a message to the client. Every
 * "open the Comments tab" instruction had to be prose telling someone where to click.
 *
 * What the module owns:
 *  · activate on load from `?tab=`, falling back to the server-rendered landing panel when the
 *    param is absent or names a tab this page doesn't have (a stale link degrades, never blanks);
 *  · write the param back on change with `history.replaceState` — REPLACE, not push, because Back
 *    must leave the page rather than undo a tab, which is the behaviour people actually expect;
 *  · dispatch `app:tabchange`, which every stacking drawer listens for. Omitting it orphans an
 *    open drawer over a panel whose rows no longer exist;
 *  · the "/" shortcut that focuses the visible panel's search.
 *
 * Host-specific behaviour goes through `onChange`, not a fork.
 */

export interface SectionTabsOptions {
  /** The host element that contains both `[data-tab]` buttons and `[data-panel]` sections. */
  root: HTMLElement;
  /** URL query parameter carrying the active tab key. Default `tab`. */
  param?: string;
  /** Selector for the search input inside a panel, focused by "/". Omit to disable the shortcut. */
  searchSelector?: string;
  /** Run after a tab becomes active — the React-Flow resize nudge, and anything like it. */
  onChange?: (tab: string) => void;
}

export function wireSectionTabs(opts: SectionTabsOptions): void {
  const { root, param = 'tab', searchSelector, onChange } = opts;
  if (root.dataset.tabsWired) return;
  root.dataset.tabsWired = '1';

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-panel]'));
  if (!tabs.length) return;

  const show = (tab: HTMLButtonElement, opts2: { silent?: boolean } = {}) => {
    tabs.forEach((x) => x.classList.toggle('tab-active', x === tab));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
    const key = tab.dataset.tab || '';
    // Keep the URL in step so the address bar is always a working link to what is on screen.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(param, key);
      history.replaceState(history.state, '', url);
    } catch {
      // A malformed URL is not worth breaking the tab switch over.
    }
    // A tab is a context switch: the leaving tab's detail drawer is no longer in context, so every
    // drawer stack closes. Skipped on the initial activation — nothing is open yet, and firing it
    // then would race the drawer controllers' own wiring.
    if (!opts2.silent) document.dispatchEvent(new CustomEvent('app:tabchange', { detail: { tab: key } }));
    onChange?.(key);
  };

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      if (t.classList.contains('tab-active')) return; // already here — don't disturb an open drawer
      show(t);
    }),
  );

  // Deep link. Only acts when the param names a tab that exists AND is not already active, so the
  // common case (no param) leaves the server-rendered landing panel exactly as it was painted.
  const wanted = new URLSearchParams(window.location.search).get(param);
  if (wanted) {
    const target = tabs.find((t) => t.dataset.tab === wanted);
    if (target && !target.classList.contains('tab-active')) show(target, { silent: true });
  }

  if (searchSelector) {
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/') return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      const panel = panels.find((p) => !p.hidden);
      const search = panel?.querySelector<HTMLInputElement>(searchSelector);
      if (search) { e.preventDefault(); search.focus(); }
    });
  }
}
