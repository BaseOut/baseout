/**
 * settingsControls — the client behaviour behind SettingsView's rows.
 *
 * THE COMMIT CONTRACT. The product already runs three save contracts (an explicit Save button in
 * the setup wizard, Save/Cancel edit mode in the entity panel, and commit-on-blur/Enter for inline
 * renames). A settings hub of single independent knobs is the third case, so this reuses it rather
 * than inventing a fourth:
 *
 *   · text   — commits on `change`, which the platform fires exactly on blur-after-edit and on
 *              Enter. Escape reverts to the last committed value. An empty required value is
 *              refused and reverted, with the reason stated in the row.
 *   · select — commits on `change`.
 *   · toggle — commits on `change`, immediately. A toggle with a Save button beside it is a lie
 *              about what a toggle means.
 *
 * Every commit flashes `Saved` in the row and announces it once to a polite live region, so the
 * change is confirmed for a screen reader and for the eye without a toast per keystroke.
 *
 * PROMOTION RECONCILE (apps/web, web-settings). Two changes from the fork verbatim:
 *  1. The `root: ParentNode` / `el: Element` signatures are rewritten to `HTMLElement`. Under the
 *     Cloudflare worker types those names resolve to workerd globals (not lib.dom), so `astro check`
 *     rejects them — the same DOM-type-shadow rewrite `wireCopyId`/`wireTableSort` already use. The
 *     single call site passes the real `[data-settings-root]` HTMLElement, so nothing widens.
 *  2. GENERIC ROWS THAT STILL HAVE NO ROUTE stay `gated`. Account name, Space
 *     name, and auto-add persist through `/api/auth/update-user`, `PATCH /api/spaces/:id`,
 *     and `PATCH /api/spaces/:id/backup-config`. The one extra mutation is billing
 *     "Open portal" (`POST /api/billing/portal` with a `setButtonLoading` spinner, §4.5).
 *     Everything else is either a real `<a href>` or an honest deferred-action note.
 */
import { setButtonLoading } from '../lib/ui';
import {
  persistAccountName,
  persistSpaceAutoAdd,
  persistSpaceName,
} from '../lib/settings/persist';

const FLASH_MS = 2400;

function liveRegion(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-set-live]');
}

function announce(root: HTMLElement, message: string): void {
  const live = liveRegion(root);
  if (!live) return;
  // Re-announce an identical message: clearing first forces the region to fire again.
  live.textContent = '';
  window.setTimeout(() => {
    live.textContent = message;
  }, 30);
}

/** Show the `Saved` flag in a row for a beat, then fade it. */
function flashSaved(row: HTMLElement): void {
  const flag = row.querySelector<HTMLElement>('[data-set-flag]');
  if (!flag) return;
  const prev = Number(flag.dataset.timer || '0');
  if (prev) window.clearTimeout(prev);
  flag.classList.add('set-flag-on');
  flag.dataset.timer = String(
    window.setTimeout(() => {
      flag.classList.remove('set-flag-on');
      flag.dataset.timer = '';
    }, FLASH_MS),
  );
}

/** The per-row message slot, used for deferred-action notes and for refused input. */
function setNote(row: HTMLElement, message: string, tone: 'plain' | 'error'): void {
  const note = row.querySelector<HTMLElement>('[data-set-note]');
  if (!note) return;
  note.textContent = message;
  note.hidden = false;
  note.classList.toggle('set-rownote-error', tone === 'error');
}

function clearNote(row: HTMLElement): void {
  const note = row.querySelector<HTMLElement>('[data-set-note]');
  if (!note) return;
  note.hidden = true;
  note.textContent = '';
  note.classList.remove('set-rownote-error');
}

function rowOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>('.set-row');
}

function labelOf(row: HTMLElement): string {
  return row.querySelector<HTMLElement>('.set-rowname')?.textContent?.trim() || 'Setting';
}

/**
 * Initials follow the name field, so editing "Name" updates the avatar in the same section. It is
 * the one place where two controls on this page are genuinely coupled, and leaving the old initials
 * behind would be a small version of the same lie this page was rebuilt to remove.
 *
 * The selector reaches inside Avatar.astro (`.avatar > div > span` is its initials slot). That
 * coupling is deliberate and narrow: Avatar renders no hook of its own, and adding a pass-through
 * prop to a shared primitive for one caller is the worse trade. A no-op when an image is set.
 */
function syncInitials(root: HTMLElement, name: string): void {
  const target = root.querySelector<HTMLElement>('[data-set-avatar] .avatar span');
  if (!target) return;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  if (initials) target.textContent = initials;
}

async function commitText(root: HTMLElement, input: HTMLInputElement): Promise<void> {
  const row = rowOf(input);
  if (!row) return;
  const next = input.value.trim();
  const last = input.dataset.setLast ?? '';

  if (!next) {
    input.value = last;
    setNote(row, `${labelOf(row)} cannot be empty.`, 'error');
    announce(root, `${labelOf(row)} cannot be empty. Reverted.`);
    return;
  }
  if (next === last) return;

  const id = input.dataset.setId;
  const spaceId = root.dataset.spaceId ?? '';
  let persisted = { ok: true as boolean, error: undefined as string | undefined };
  if (id === 'account-name') persisted = await persistAccountName(next);
  else if (id === 'space-name' && spaceId) persisted = await persistSpaceName(spaceId, next);

  if (!persisted.ok) {
    input.value = last;
    setNote(row, persisted.error ?? `${labelOf(row)} could not be saved.`, 'error');
    announce(root, persisted.error ?? `${labelOf(row)} could not be saved.`);
    return;
  }

  input.value = next;
  input.dataset.setLast = next;
  clearNote(row);
  flashSaved(row);
  announce(root, `${labelOf(row)} saved.`);
  if (input.dataset.setId === 'account-name') syncInitials(root, next);
}

async function commitChoice(root: HTMLElement, el: HTMLInputElement | HTMLElement): Promise<void> {
  const row = rowOf(el);
  if (!row) return;
  const id = el instanceof HTMLInputElement ? el.dataset.setId : undefined;
  const spaceId = root.dataset.spaceId ?? '';
  if (id === 'space-autoadd' && el instanceof HTMLInputElement && spaceId) {
    const persisted = await persistSpaceAutoAdd(spaceId, el.checked);
    if (!persisted.ok) {
      el.checked = !el.checked;
      setNote(row, persisted.error ?? `${labelOf(row)} could not be saved.`, 'error');
      announce(root, persisted.error ?? `${labelOf(row)} could not be saved.`);
      return;
    }
  }
  clearNote(row);
  flashSaved(row);
  const state =
    el instanceof HTMLInputElement ? (el.checked ? 'on' : 'off') : ((el as { value?: string }).value ?? '');
  announce(root, `${labelOf(row)} set to ${state}.`);
}

export function initSettingsControls(): void {
  const root = document.querySelector<HTMLElement>('[data-settings-root]');
  if (!root) return;
  if (root.dataset.setWired === '1') return;
  root.dataset.setWired = '1';

  root.querySelectorAll<HTMLInputElement>('input[data-set-text]').forEach((input) => {
    input.dataset.setLast = input.value.trim();
    input.addEventListener('change', () => commitText(root, input));
    input.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        input.blur();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        input.value = input.dataset.setLast ?? '';
        const row = rowOf(input);
        if (row) clearNote(row);
        input.blur();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('select[data-set-select]').forEach((sel) => {
    sel.addEventListener('change', () => commitChoice(root, sel));
  });

  root.querySelectorAll<HTMLInputElement>('input[data-set-toggle]').forEach((box) => {
    box.addEventListener('change', () => commitChoice(root, box));
  });

  /**
   * DESTRUCTIVE rows (audit D06). `Delete account` and `Delete Space` open the catalog
   * `confirm-modal`, and the honest note is printed only AFTER the confirm, so the surface still
   * refuses to pretend while the guard is real. NOT-OURS: nothing is deleted — apps/web has no
   * account/Space deletion route yet, and the note says so.
   */
  root.querySelectorAll<HTMLButtonElement>('button[data-set-destructive]').forEach((btn) => {
    const dlg = document.getElementById(btn.dataset.setDestructive || '') as HTMLDialogElement | null;
    if (!dlg) return;
    btn.addEventListener('click', () => dlg.showModal());
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'confirm') return;
      const row = rowOf(btn);
      const message = btn.dataset.setNoteText || '';
      if (!row || !message) return;
      setNote(row, message, 'plain');
      announce(root, message);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('button[data-set-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = rowOf(btn);
      const message = btn.dataset.setAction || '';
      if (!row || !message) return;
      setNote(row, message, 'plain');
      announce(root, message);
    });
  });

  /**
   * BILLING PORTAL (web-settings) — the one real mutation on this surface. POSTs to the existing
   * `/api/billing/portal` route and hands off to Stripe's hosted portal on success; on a
   * dev-disabled / no-customer / upstream error it states the reason in the row rather than
   * pretending. `setButtonLoading` spinner cleared in `finally` (§4.5).
   */
  root.querySelectorAll<HTMLButtonElement>('button[data-set-portal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = rowOf(btn);
      if (row) clearNote(row);
      setButtonLoading(btn, true);
      try {
        const res = await fetch('/api/billing/portal', { method: 'POST' });
        const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && body.url) {
          window.location.href = body.url;
          return;
        }
        if (row) {
          setNote(row, body.error ?? 'Could not open the billing portal. Try again.', 'plain');
          announce(root, 'Could not open the billing portal.');
        }
      } catch {
        if (row) setNote(row, 'Network error opening the billing portal. Try again.', 'plain');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  });
}
