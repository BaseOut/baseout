/**
 * Inbox — client behaviour.
 *
 * There is no backend. Triage mutates DOM state only and a refresh resets to the
 * fixture, so every faked action announces its result (the honest-signal pattern)
 * rather than implying persistence.
 *
 * The panel is NON-MODAL: it does not trap focus, does not steal focus on open,
 * and carries no role="dialog". Arrivals announce through a polite live region.
 */

const PANEL = '[data-inbox]';
const OPEN_ATTR = 'data-inbox-open';

/** Rows still live in a lane — handled (done/snoozed/resolved) and muted rows are out. */
function liveRows(panel: HTMLElement, lane?: string): HTMLElement[] {
  const sel = lane ? `.ibx-row[data-lane="${lane}"]` : '.ibx-row';
  return Array.from(panel.querySelectorAll<HTMLElement>(sel)).filter(
    (r) => !r.dataset.handled && r.dataset.muted !== 'true',
  );
}

/**
 * Rows the CURRENT Space filter lets through. Distinct from liveRows(): a row filtered
 * out is not handled, it is out of scope — its own state is untouched.
 */
function inScopeRows(panel: HTMLElement, lane?: string): HTMLElement[] {
  return liveRows(panel, lane).filter((r) => r.dataset.spaceHidden === undefined);
}

/**
 * Space filter (account-level Inbox, 2+ Spaces). Hides out-of-scope rows and retitles the
 * control. The lane badges follow the filter — they count what you are looking at — but the
 * NAV badge deliberately does not: it is the account's truth, and a Space filter must not
 * hide a broken connection from it.
 */
function applySpaceFilter(panel: HTMLElement, space: string): void {
  panel.dataset.spaceFilter = space;
  for (const row of panel.querySelectorAll<HTMLElement>('.ibx-row')) {
    if (space && row.dataset.space !== space) row.dataset.spaceHidden = '';
    else delete row.dataset.spaceHidden;
  }
  const label = panel.querySelector<HTMLElement>('[data-inbox-space-label]');
  if (label) label.textContent = space || 'All spaces';
  for (const opt of panel.querySelectorAll<HTMLElement>('[data-inbox-space]')) {
    opt.setAttribute('aria-current', String((opt.dataset.inboxSpace || '') === space));
  }
  sync(panel);
}

/** Move a row into the handled set (done / snoozed / resolved). Reversible. */
function setHandled(row: HTMLElement, reason: 'done' | 'snoozed' | 'resolved'): void {
  row.dataset.handled = reason;
  row.dataset.read = 'true';
}


function announce(panel: HTMLElement, message: string): void {
  const live = panel.querySelector<HTMLElement>('[data-inbox-live]');
  if (live) live.textContent = message;
}

/** Minimal, self-removing toast on the daisyUI `toast` primitive, with optional Undo. */
function toast(message: string, onUndo?: () => void): void {
  let host = document.getElementById('inbox-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'inbox-toast-host';
    host.className = 'toast toast-end z-[600]';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'alert alert-soft';
  el.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  if (onUndo) {
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn btn-ghost btn-sm';
    undo.textContent = 'Undo';
    undo.addEventListener('click', () => {
      onUndo();
      el.remove();
    });
    el.appendChild(undo);
  }

  host.appendChild(el);
  window.setTimeout(() => el.remove(), 5000);
}

/**
 * Recount both lanes and the sidebar badge. The badge shows the ATTENTION count,
 * not the unread count — the number that means "you have to do something".
 */
const cap = (n: number) => (n > 9 ? '9+' : String(n));

function sync(panel: HTMLElement): void {
  // Attention: how many things you must FIX. Activity: how much you have not READ.
  // Two different questions, so two different numbers — and a count, not a bare dot,
  // because "something broke" and "three things broke" are different decisions.
  const attention = inScopeRows(panel, 'attention').length;
  const activityUnread = inScopeRows(panel, 'activity').filter((r) => r.dataset.read !== 'true').length;

  const counts: Record<string, number> = { attention, activity: activityUnread };
  for (const [lane, n] of Object.entries(counts)) {
    const badge = panel.querySelector<HTMLElement>(`[data-tab-count="${lane}"]`);
    if (badge) {
      badge.textContent = cap(n);
      badge.hidden = n === 0;
    }
  }

  // The nav badge answers "is anything wrong in my account?" — a Space filter is a
  // viewing choice and may not change that answer.
  const accountAttention = liveRows(panel, 'attention').length;
  const badge = document.querySelector<HTMLElement>('[data-inbox-count]');
  if (badge) {
    badge.textContent = cap(accountAttention);
    badge.hidden = accountAttention === 0;
  }

  // Handled rows live in Needs attention — that is the lane you triage.
  const handledRows = panel.querySelectorAll<HTMLElement>(
    '.ibx-row[data-lane="attention"][data-handled]',
  );
  const handledCount = panel.querySelector<HTMLElement>('[data-inbox-handled-count]');
  if (handledCount) {
    handledCount.textContent = String(handledRows.length);
    handledCount.hidden = handledRows.length === 0;
  }
  syncMenu(panel);

  // Distinguish "nothing new" from "nothing at all" — otherwise a filter that
  // matched nothing reads as an empty inbox, which is the lie we are avoiding.
  const filterEmpty = panel.querySelector<HTMLElement>('[data-inbox-filter-empty]');
  if (filterEmpty) {
    const activityRows = inScopeRows(panel, 'activity');
    const activityVisible = activityRows.filter(
      (r) => !(panel.dataset.activityFilter === 'new' && r.dataset.read === 'true'),
    ).length;
    // Only meaningful when the lane HAS rows and the filter hid them all.
    filterEmpty.hidden = activityVisible > 0 || activityRows.length === 0;
  }

  // Each tab owns its zero-state, so emptying one lane never claims the whole
  // inbox is clear.
  for (const lane of ['attention', 'activity']) {
    const section = panel.querySelector<HTMLElement>(`.ibx-lane[data-lane="${lane}"]`);
    const empty = section?.querySelector<HTMLElement>('.ibx-empty');
    if (!empty || !section) continue;
    const laneHandled = section.querySelectorAll('.ibx-row[data-handled]:not([data-space-hidden])').length;
    // In-scope, not merely live: a Space filter that hides every row must show the zero-state,
    // otherwise the lane renders as a blank void with no explanation.
    const hasRows =
      inScopeRows(panel, lane).length > 0 ||
      (laneHandled > 0 && panel.dataset.showHandled === 'true');
    empty.hidden = hasRows;
  }
}

/**
 * The filter menu is lane-aware: "Show handled" cannot mean anything in Activity, and
 * "Unread only" cannot mean anything in a lane you triage. Offering either in the wrong
 * lane would name a state that does not exist there.
 */
function syncMenu(panel: HTMLElement): void {
  const lane = panel.querySelector<HTMLElement>('[data-inbox-tab][aria-selected="true"]')?.dataset.inboxTab;
  for (const el of panel.querySelectorAll<HTMLElement>('[data-inbox-menu-lane]')) {
    el.hidden = el.dataset.inboxMenuLane !== lane;
  }
  // A filter that narrows the list must say so on the trigger, or a filtered inbox reads as an empty
  // one. Same signal the Schema and Backups facets use: primary tint + a count.
  const activeInLane = [
    !!panel.dataset.spaceFilter,
    lane === 'attention' && panel.dataset.showHandled === 'true',
    lane === 'activity' && panel.dataset.activityFilter === 'new',
  ].filter(Boolean).length;

  panel.querySelector<HTMLElement>('[data-inbox-filter-trigger]')?.classList.toggle('ff-on', activeInLane > 0);
  const count = panel.querySelector<HTMLElement>('[data-inbox-filter-count]');
  if (count) {
    count.textContent = String(activeInLane);
    count.hidden = activeInLane === 0;
  }
  for (const el of panel.querySelectorAll<HTMLElement>('[data-inbox-reset]')) el.hidden = activeInLane === 0;
}

/** Switch tabs. Counts keep updating on the tab you are not looking at. */
function selectTab(panel: HTMLElement, key: string): void {
  for (const tab of panel.querySelectorAll<HTMLElement>('[data-inbox-tab]')) {
    const on = tab.dataset.inboxTab === key;
    tab.classList.toggle('tab-active', on);
    tab.setAttribute('aria-selected', String(on));
  }
  for (const section of panel.querySelectorAll<HTMLElement>('.ibx-lane')) {
    section.hidden = section.dataset.lane !== key;
  }
  syncMenu(panel);
  sync(panel);
}

function setOpen(panel: HTMLElement, open: boolean): void {
  panel.hidden = !open;
  document.documentElement.toggleAttribute(OPEN_ATTR, open);
  const trigger = document.querySelector<HTMLElement>('[data-inbox-trigger]');
  trigger?.setAttribute('aria-expanded', String(open));
  // The Inbox opens a panel instead of navigating, so nothing marks it active — reuse the same
  // `active` class the router-driven nav items get, otherwise an open Inbox looks unselected.
  trigger?.classList.toggle('active', open);
  if (open) sync(panel);
}

/**
 * Self-healing. A state-backed row (reconnect, health) is bound to live state, so
 * when that state clears we resolve the row IN PLACE and stay silent — no new
 * "it's fixed!" notification. Fire `inbox:resolve` with the row id to demo it.
 */
function resolveRow(panel: HTMLElement, id: string): void {
  const row = panel.querySelector<HTMLElement>(`[data-row="${id}"]`);
  if (!row || row.dataset.stateBacked !== 'true') return;

  setHandled(row, 'resolved');
  row.querySelector('.ibx-copy')?.classList.add('ibx-copy-resolved');
  row.querySelector('.btn')?.remove();
  row.querySelector('.ibx-detail')?.remove();
  row.querySelector('.ibx-actions')?.remove();

  if (!row.querySelector('.ibx-resolved-note')) {
    const note = document.createElement('p');
    note.className = 'ibx-resolved-note';
    note.textContent = 'Resolved — connection restored';
    row.querySelector('.ibx-main')?.appendChild(note);
  }

  const chip = row.querySelector<HTMLElement>('.ibx-chip');
  if (chip) {
    chip.className = 'ibx-chip bg-success/10 text-success';
    chip.innerHTML = '<span class="iconify lucide--circle-check size-4"></span>';
  }

  // It STAYS in Needs attention, behind `Show handled`. Demoting it into Activity
  // would file a connection matter as news. `setHandled` already dropped it out of
  // the live count, and we stay silent: no "it's fixed!" row.
  sync(panel);
}

export function wireInbox(): void {
  const panel = document.querySelector<HTMLElement>(PANEL);
  if (!panel || panel.dataset.wired === 'true') return;
  panel.dataset.wired = 'true';

  // Default to showing everything: a filter must be something the user turned on,
  // never a reason they failed to see a row.
  panel.dataset.activityFilter = 'all';
  panel.dataset.showHandled = 'false';

  document.querySelector<HTMLElement>('[data-inbox-trigger]')?.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(panel, panel.hidden);
  });

  panel.querySelector('[data-inbox-close]')?.addEventListener('click', () => setOpen(panel, false));

  for (const tab of panel.querySelectorAll<HTMLElement>('[data-inbox-tab]')) {
    tab.addEventListener('click', () => selectTab(panel, tab.dataset.inboxTab ?? 'attention'));
  }

  // Mark-all-read touches ACTIVITY ONLY. Marking an unresolved "reconnect!" as
  // read would let the New filter hide a broken connection — the panel would show
  // a clean inbox while backups are stopped. Read is not resolved.
  panel.querySelector('[data-inbox-read-all]')?.addEventListener('click', () => {
    const rows = liveRows(panel, 'activity');
    for (const row of rows) row.dataset.read = 'true';
    announce(panel, `${rows.length} activity notifications marked read`);
    toast('Activity marked read. Rows that need attention were left alone.');
    sync(panel);
  });

  // Activity: "Unread only" — a catalog toggle, so it reports its own state.
  panel.querySelector<HTMLInputElement>('[data-inbox-filter="new"]')?.addEventListener('change', (e) => {
    panel.dataset.activityFilter = (e.currentTarget as HTMLInputElement).checked ? 'new' : 'all';
    sync(panel);
  });

  // Space filter — radios, so the chosen Space is legible without opening anything twice.
  panel.querySelectorAll<HTMLInputElement>('[data-inbox-space]').forEach((opt) => {
    opt.addEventListener('change', () => {
      if (opt.checked) applySpaceFilter(panel, opt.dataset.inboxSpace || '');
    });
  });

  // Reset — one click back to the unfiltered truth, shown only when there is something to reset.
  panel.querySelector<HTMLElement>('button[data-inbox-reset]')?.addEventListener('click', () => {
    const all = panel.querySelector<HTMLInputElement>('[data-inbox-space=""]');
    if (all) all.checked = true;
    const unread = panel.querySelector<HTMLInputElement>('[data-inbox-filter="new"]');
    if (unread) unread.checked = false;
    const handled = panel.querySelector<HTMLInputElement>('[data-inbox-show-handled]');
    if (handled) handled.checked = false;
    panel.dataset.activityFilter = 'all';
    panel.dataset.showHandled = 'false';
    applySpaceFilter(panel, '');
  });

  // Show handled — the reveal for done / snoozed / self-resolved rows.
  panel.querySelector<HTMLInputElement>('[data-inbox-show-handled]')?.addEventListener('change', (e) => {
    panel.dataset.showHandled = String((e.currentTarget as HTMLInputElement).checked);
    sync(panel);
  });

  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>('.ibx-row');

    const groupToggle = target.closest<HTMLElement>('[data-inbox-toggle-group]');
    if (groupToggle) {
      const id = groupToggle.dataset.inboxToggleGroup ?? '';
      const list = panel.querySelector<HTMLElement>(`[data-inbox-group="${id}"]`);
      if (list) {
        const open = !list.hidden;
        list.hidden = open;
        groupToggle.setAttribute('aria-expanded', String(!open));
      }
      return;
    }

    if (!row) return;

    // Restore a handled row back into the live Activity lane.
    if (target.closest('[data-inbox-restore]')) {
      delete row.dataset.handled;
      announce(panel, 'Notification moved back to Activity');
      sync(panel);
      return;
    }

    if (target.closest('[data-inbox-done]')) {
      setHandled(row, 'done');
      announce(panel, 'Notification marked done');
      toast('Marked done.', () => {
        delete row.dataset.handled;
        sync(panel);
      });
      sync(panel);
      return;
    }

    if (target.closest('[data-inbox-snooze]')) {
      setHandled(row, 'snoozed');
      announce(panel, 'Notification snoozed for one day');
      toast('Snoozed for 1 day. It resurfaces early on new activity.', () => {
        delete row.dataset.handled;
        sync(panel);
      });
      sync(panel);
      return;
    }

    if (target.closest('[data-inbox-mute]')) {
      const base = row.dataset.base ?? 'this base';
      const muted: HTMLElement[] = [];
      for (const r of panel.querySelectorAll<HTMLElement>(`.ibx-row[data-base="${base}"]`)) {
        if (r.dataset.lane === 'activity' && !r.dataset.handled) {
          r.dataset.muted = 'true';
          muted.push(r);
        }
      }
      announce(panel, `Muted ${base}`);
      toast(`Muted ${base}. Failures still come through.`, () => {
        for (const r of muted) delete r.dataset.muted;
        sync(panel);
      });
      sync(panel);
      return;
    }

    // Opening a row marks it read and follows the deep-link — the surface you
    // land on IS the detail, and it is where you can act (re-run, reconnect, diff).
    // Read is NOT resolved: a read "reconnect!" is still broken, so state-backed
    // rows stay in the attention lane.
    if (target.closest('[data-inbox-open-row]')) {
      row.dataset.read = 'true';
      sync(panel);
    }
  });

  // Esc closes the panel and returns focus to the trigger (it never trapped focus).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(panel, false);
      document.querySelector<HTMLElement>('[data-inbox-trigger]')?.focus();
    }
  });

  window.addEventListener('inbox:resolve', (e) => {
    const id = (e as CustomEvent<{ id: string }>).detail?.id;
    if (id) resolveRow(panel, id);
  });

  sync(panel);
}
