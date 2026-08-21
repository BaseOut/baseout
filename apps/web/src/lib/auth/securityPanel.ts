/**
 * securityPanel — the client half of `components/settings/SecurityPanel.astro`.
 *
 * It lives in a `.ts` file rather than an `.astro` <script> on purpose: `astro
 * check` does not read script blocks, so a controller written inline is invisible
 * to typecheck. Everything here is therefore covered by `tsc --strict`.
 *
 * Two contracts this file exists to keep, both from
 * openspec/changes/login-methods (Decisions 4 and 5):
 *
 *  1. VERIFY-TO-ACTIVATE. Opening the wizard, scanning, and reading the secret
 *     change nothing. `setEnabled(true)` is called from exactly ONE place —
 *     submitting the verify step — so abandoning the wizard at any earlier point
 *     leaves two-factor off. There is deliberately no other caller.
 *  2. THE BACKUP CODES ARE SHOWN ONCE, BEHIND A GATE. The save step has no
 *     dismiss, no cancel and no close; its only exit is the Done button, and that
 *     button stays disabled until the "I saved these" checkbox is ticked. Losing
 *     this list is the one dismissal in the product that can cost someone their
 *     account, so the gate is the feature.
 *
 * Production enrollment, verify, and disable go through `/api/auth/two-factor/*`
 * (web-auth-2fa). Opening the wizard still changes nothing: `setEnabled(true)`
 * is called only after verify-totp succeeds.
 */
import { setButtonLoading } from '../ui';
import { secretFromOtpauth } from './otpauth';

export type SecurityStage = 'idle' | 'scan' | 'verify' | 'save' | 'disable' | 'regenerate';

const STAGES: readonly SecurityStage[] = ['idle', 'scan', 'verify', 'save', 'disable', 'regenerate'];

const isStage = (v: string | undefined): v is SecurityStage =>
  !!v && (STAGES as readonly string[]).includes(v);

/** Why the codes are on screen — it changes the heading and the Done copy. */
type CodeOrigin = 'enrol' | 'regenerate';

function mount(root: HTMLElement): void {
  if (root.dataset.securityReady === '1') return;
  root.dataset.securityReady = '1';

  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const all = <T extends HTMLElement>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));

  const stages = new Map<SecurityStage, HTMLElement>();
  all<HTMLElement>('[data-sec-stage]').forEach((el) => {
    const name = el.dataset.secStage;
    if (isStage(name)) stages.set(name, el);
  });

  // Checkbox.astro and CodeInput.astro take a fixed prop list and do NOT spread
  // unknown attributes, so a `data-` hook passed to them never reaches the DOM.
  // Hence the hook goes on a wrapper and the real control is found underneath it.
  const saveGate = q<HTMLInputElement>('[data-sec-save-gate] input');
  const saveDone = q<HTMLButtonElement>('[data-sec-save-done]');
  const verifyForm = q<HTMLFormElement>('[data-sec-verify-form]');
  const verifySubmit = q<HTMLButtonElement>('[data-sec-verify-submit]');
  const disableForm = q<HTMLFormElement>('[data-sec-disable-form]');
  const disableSubmit = q<HTMLButtonElement>('[data-sec-disable-submit]');
  const codeCells = all<HTMLElement>('[data-sec-code]');
  const codesTitle = q<HTMLElement>('[data-sec-codes-title]');
  const codesLede = q<HTMLElement>('[data-sec-codes-lede]');
  const regenNote = q<HTMLElement>('[data-sec-codes-regen-note]');

  const readList = (attr: string): string[] => {
    const raw = root.dataset[attr];
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  /** Codes are written into cells that already exist, so scoped styles survive. */
  const firstCodes = readList('secCodes');
  const nextCodes = readList('secRegenCodes');
  let shownCodes = firstCodes;

  const paintCodes = (codes: string[]): void => {
    shownCodes = codes;
    codeCells.forEach((cell, i) => {
      cell.textContent = codes[i] ?? '';
    });
  };

  /* ---- the two pieces of state the whole panel is about ---- */

  const enrolledAt = q<HTMLElement>('[data-sec-enrolled-at]');

  const setEnabled = (on: boolean): void => {
    root.dataset.secOn = on ? 'true' : 'false';
    // Production gets the enrolment date back from the server. There is no server
    // here, so rather than leave an em dash after a real enrolment — or fabricate a
    // date — say the only thing that is actually true.
    if (on && enrolledAt && enrolledAt.textContent?.trim() === '—') {
      enrolledAt.textContent = 'Just now';
    }
  };

  const setStage = (stage: SecurityStage): void => {
    root.dataset.secStage2 = stage;
    stages.forEach((el, name) => el.classList.toggle('hidden', name !== stage));

    // The save step is a hand-over, so it opens with the gate unticked every time —
    // a checkbox left ticked from a previous run would let Done through unread.
    if (stage === 'save' && saveGate) {
      saveGate.checked = false;
      syncSaveGate();
    }

    // Focus the first thing the user has to act on. Derived from the DOM rather
    // than a marker attribute, because the primitives drop unknown attributes.
    const focusTarget = stages
      .get(stage)
      ?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"])');
    focusTarget?.focus();
  };

  const setCodeOrigin = (origin: CodeOrigin): void => {
    const regenerating = origin === 'regenerate';
    if (codesTitle) {
      codesTitle.textContent = regenerating ? 'Your new backup codes' : 'Save your backup codes';
    }
    if (codesLede) {
      codesLede.textContent = regenerating
        ? 'These replace your previous codes. Store them somewhere you can reach without your phone.'
        : 'Each code signs you in once if you lose your phone. This is the only time they are shown.';
    }
    regenNote?.classList.toggle('hidden', !regenerating);
  };

  /* ---- gates ---- */

  function syncSaveGate(): void {
    if (!saveDone || !saveGate) return;
    saveDone.disabled = !saveGate.checked;
  }

  saveGate?.addEventListener('change', syncSaveGate);
  syncSaveGate();

  // A 6-digit control reports its own completeness; the submit follows it rather
  // than guessing from keystrokes.
  const bindCodeGate = (scope: HTMLElement | null, submit: HTMLButtonElement | null): void => {
    if (!scope || !submit) return;
    submit.disabled = true;
    scope.addEventListener('code-input:change', (e) => {
      const detail = (e as CustomEvent<{ value: string; complete: boolean }>).detail;
      submit.disabled = !detail?.complete;
    });
  };
  bindCodeGate(verifyForm, verifySubmit);
  bindCodeGate(disableForm, disableSubmit);

  const errorEl = q<HTMLElement>('[data-sec-error]');
  const setError = (message: string): void => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  const readCode = (form: HTMLFormElement | null): string => {
    const input = form?.querySelector<HTMLInputElement>('input:not([type="checkbox"]):not([type="hidden"])');
    return input?.value.replace(/\s/g, '') ?? '';
  };

  const authJson = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  };

  const applyEnrollment = (totpURI: string, codes: string[]): void => {
    const secret = secretFromOtpauth(totpURI);
    const secretEl = q<HTMLElement>('[data-sec-secret]');
    if (secretEl) secretEl.textContent = secret || totpURI;
    paintCodes(codes);
  };

  const ensureEnrollment = async (btn: HTMLButtonElement): Promise<boolean> => {
    if ((q<HTMLElement>('[data-sec-secret]')?.textContent ?? '').replace('—', '').trim()) {
      return true;
    }
    setError('');
    setButtonLoading(btn, true);
    try {
      const { ok, data } = await authJson('/api/auth/two-factor/enable', {});
      const totpURI = typeof data.totpURI === 'string' ? data.totpURI : '';
      const codes = Array.isArray(data.backupCodes) ? data.backupCodes.map(String) : [];
      if (!ok || !totpURI) {
        setError(typeof data.message === 'string' ? data.message : 'Could not start two-factor setup. Try again.');
        return false;
      }
      applyEnrollment(totpURI, codes);
      return true;
    } catch {
      setError('Could not start two-factor setup. Try again.');
      return false;
    } finally {
      setButtonLoading(btn, false);
    }
  };

  /* ---- transitions ---- */

  all<HTMLElement>('[data-sec-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.secGo;
      if (target === 'scan') {
        void ensureEnrollment(btn as HTMLButtonElement).then((ok) => {
          if (ok && isStage(target)) setStage(target);
        });
        return;
      }
      if (isStage(target)) setStage(target);
    });
  });

  // THE one place two-factor is switched on. Nothing before this point does.
  verifyForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (verifySubmit?.disabled) return;
    const code = readCode(verifyForm);
    if (!code) return;
    setButtonLoading(verifySubmit, true);
    void authJson('/api/auth/two-factor/verify-totp', { code })
      .then(({ ok, data }) => {
        if (!ok) {
          setError(typeof data.message === 'string' ? data.message : 'That code was not accepted. Wait for the next one.');
          return;
        }
        setError('');
        setEnabled(true);
        setCodeOrigin('enrol');
        setStage('save');
      })
      .catch(() => {
        setError('Could not verify that code. Try again.');
      })
      .finally(() => {
        setButtonLoading(verifySubmit, false);
      });
  });

  disableForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (disableSubmit?.disabled) return;
    const code = readCode(disableForm);
    if (!code) return;
    setButtonLoading(disableSubmit, true);
    void authJson('/api/auth/two-factor/disable', { code })
      .then(({ ok, data }) => {
        if (!ok) {
          setError(typeof data.message === 'string' ? data.message : 'A valid two-factor code is required to turn this off.');
          return;
        }
        setError('');
        setEnabled(false);
        setStage('idle');
      })
      .catch(() => {
        setError('Could not turn two-factor off. Try again.');
      })
      .finally(() => {
        setButtonLoading(disableSubmit, false);
      });
  });

  q<HTMLButtonElement>('[data-sec-regen-confirm]')?.addEventListener('click', () => {
    paintCodes(nextCodes.length ? nextCodes : firstCodes);
    setCodeOrigin('regenerate');
    setStage('save');
  });

  saveDone?.addEventListener('click', () => {
    if (saveDone.disabled) return;
    setStage('idle');
  });

  /* ---- copy / download: the two ways out of "I have to write these down" ---- */

  const codesText = (): string => shownCodes.join('\n');

  q<HTMLButtonElement>('[data-sec-copy]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const label = btn.querySelector<HTMLElement>('[data-sec-copy-label]');
    void navigator.clipboard?.writeText(codesText()).then(() => {
      if (!label) return;
      const was = label.textContent ?? 'Copy';
      label.textContent = 'Copied';
      window.setTimeout(() => {
        label.textContent = was;
      }, 2000);
    });
  });

  q<HTMLButtonElement>('[data-sec-download]')?.addEventListener('click', () => {
    const blob = new Blob([`${codesText()}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'baseout-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  paintCodes(firstCodes);
}

/**
 * Mount every un-mounted security panel under `scope` (idempotent).
 *
 * PROMOTION RECONCILE (apps/web): the fork types `scope` as `ParentNode`, but under
 * the Cloudflare worker types `ParentNode` resolves to workerd's global (not lib.dom),
 * so `astro check` rejects it. `Document | HTMLElement` covers the real call sites
 * (the `document` default + `astro:after-swap`) — a DOM-type-shadow rewrite, never `any`.
 */
export function initSecurityPanel(scope: Document | HTMLElement = document): void {
  scope.querySelectorAll<HTMLElement>('[data-security-root]').forEach(mount);
}
