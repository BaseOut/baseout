/**
 * RestoreView's controller — the state that flows through the restore form.
 *
 * D05's diagnosis was that NOTHING flowed through this page: the entry dropped the
 * base, step 1 never reached step 4, and the submit handler appended only `&att=`. So
 * this file owns exactly one thing — a `RestoreState` that is hydrated from the URL,
 * written back to the URL on every change (a reload no longer silently resets a
 * configured form), and handed to `describeRestoreRequest` for every sentence on the
 * page. The confirm dialog and the live summary read the SAME derivation; neither
 * writes a sentence of its own.
 *
 * Lives in `.ts` rather than in the view's `<script>` because `astro check` never walks
 * an `.astro` script block — this file is covered by `tsc --noEmit --strict`.
 */
import { createPager } from '../../components/ui/tablePager';
import { wireTableSort } from '../../components/schema/tableSort';
import { setButtonLoading } from '../ui';
import {
  baseCoverage,
  describeRestoreRequest,
  fileCountLabel,
  newBaseName,
  tableCountLabel,
  snapshotIsClean,
  type RestoreRequest,
  type RestoreSnapshot,
} from './request';

export interface RestoreModelTable {
  id: string;
  name: string;
  records: number;
  fields: number;
  attachments: number;
}
export interface RestoreModelBase {
  id: string;
  /** Airtable base id — what the run pages carry, so `?base=` can be either. */
  atBaseId: string;
  name: string;
  tables: RestoreModelTable[];
}
export interface RestoreModel {
  snapshots: RestoreSnapshot[];
  bases: RestoreModelBase[];
  existingBases: { id: string; name: string }[];
  destinationLabel: string;
  /** Whether the destination holds attachment FILES — gates the re-upload option (2026-08-11). */
  destinationStoresFiles: boolean;
  workspaceName: string | null;
  /** Workspaces we can already name. Empty leaves only the typed-id path, which is a real state. */
  workspaces: { id: string; name: string }[];
}

/** Read the model the view serialised beside the markup. */
function readModel(root: HTMLElement): RestoreModel | null {
  const el = root.querySelector<HTMLScriptElement>('[data-rs-model]');
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as RestoreModel;
  } catch {
    return null;
  }
}

const text = (root: HTMLElement | Document, sel: string, value: string): void => {
  root.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    el.textContent = value;
  });
};

export function wireRestore(): void {
  const root = document.querySelector<HTMLElement>('[data-restore]');
  if (!root) return;
  // The result / in-flight / failed states carry no form — nothing to wire.
  const form = root.querySelector<HTMLElement>('[data-rs-form]');
  if (!form) return;
  const parsed = readModel(root);
  if (!parsed) return;
  // Bound to a non-null const: the hoisted `function` declarations below sit outside the
  // guard's flow analysis, so `tsc --strict` calls the narrowed binding possibly-null inside
  // each one. Same trap the previous inline script documented for `root`.
  const model: RestoreModel = parsed;

  const url = new URL(window.location.href);
  const params = url.searchParams;

  // ── STATE ────────────────────────────────────────────────────────────────────────
  const snapshotById = (id: string | null): RestoreSnapshot | null =>
    model.snapshots.find((s) => s.runId === id) ?? null;
  const newestClean = model.snapshots.find((s) => snapshotIsClean(s)) ?? model.snapshots[0] ?? null;
  // `?run=` is what every entry point already passed; `?snap=` is the form's own round-trip.
  let snapshot: RestoreSnapshot | null =
    snapshotById(params.get('snap')) ?? snapshotById(params.get('run')) ?? newestClean;
  if (!snapshot) return;

  const basesIn = (s: RestoreSnapshot): RestoreModelBase[] =>
    model.bases.filter((b) => s.baseIds.includes(b.id));

  // ── BASE FIRST (2026-08-11) ──────────────────────────────────────────────────────────────────
  // Resolution now runs in the form's own order: the base is chosen out of every base that ANY
  // snapshot holds, and the snapshot is then chosen out of the ones holding THAT base. The old
  // order could only offer bases the URL's snapshot happened to contain, which is the same
  // limitation the reorder exists to remove.
  //
  // `?base=` may be our id OR the Airtable base id, because the run pages hold `atBaseId` and
  // never learned ours.
  const snapsFor = (b: RestoreModelBase): RestoreSnapshot[] =>
    model.snapshots.filter((s) => s.baseIds.includes(b.id));
  const restorable = model.bases.filter((b) => snapsFor(b).length > 0);
  const wanted = params.get('base');
  const matchBase = (list: RestoreModelBase[], key: string | null): RestoreModelBase | null =>
    key ? (list.find((b) => b.id === key || b.atBaseId === key) ?? null) : null;
  let base = matchBase(restorable, wanted) ?? restorable[0] ?? null;
  if (!base) return;
  // The snapshot has to HOLD the base. A URL naming a base and a backup that never captured it
  // (a real shape: `/restore?run=run_design_failed&base=b-prod`) resolves to the newest backup
  // that did, rather than hydrating a request the engine could never run.
  const newestFor = (b: RestoreModelBase): RestoreSnapshot | null =>
    snapsFor(b).find((s) => snapshotIsClean(s)) ?? snapsFor(b)[0] ?? null;
  if (!snapshot.baseIds.includes(base.id)) {
    const s = newestFor(base);
    if (!s) return;
    snapshot = s;
  }

  const urlTables = params.get('tables');
  let selected = new Set<string>(
    urlTables !== null
      ? urlTables.split(',').filter(Boolean)
      : base.tables.map((t) => t.id),
  );
  // A URL asking for `att=attachments` against a destination that holds no files is a request the
  // engine cannot run, so it is corrected here rather than rendered. This is the same rule the
  // snapshot resolution follows: hydrate something possible, never something merely asked for.
  let attMode: 'attachments' | 'links' =
    !model.destinationStoresFiles || params.get('att') === 'links' ? 'links' : 'attachments';
  // The NON-DESTRUCTIVE DEFAULT (spec 09, lines 42-44): a new base unless the user says otherwise.
  let targetKind: 'new' | 'existing' = params.get('target') === 'existing' ? 'existing' : 'new';
  let existingId = params.get('into') ?? model.existingBases[0]?.id ?? '';
  let newName = params.get('name') ?? newBaseName(base.name, snapshot);
  // The workspace only matters for a NEW base. `?wsp=` may be an id from the list or one typed in;
  // the two are the same field to the request and differ only in how it was filled.
  let workspaceId = params.get('wsp') ?? model.workspaces[0]?.id ?? '';

  // ── ELEMENTS ─────────────────────────────────────────────────────────────────────
  const snapRadios = Array.from(root.querySelectorAll<HTMLInputElement>('[data-rs-snap-radio]'));
  const baseRadios = Array.from(root.querySelectorAll<HTMLInputElement>('[data-rs-base-radio]'));
  const searchEl = root.querySelector<HTMLInputElement>('[data-rs-search]');
  const noMatch = root.querySelector<HTMLElement>('[data-rs-nomatch]');
  const countEl = root.querySelector<HTMLElement>('[data-rs-count]');
  const totalEl = root.querySelector<HTMLElement>('[data-rs-total]');
  const goCountEl = root.querySelector<HTMLElement>('[data-rs-go-count]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-rs-clear]');
  const goBtn = root.querySelector<HTMLButtonElement>('[data-rs-go]');
  const confirmBtn = root.querySelector<HTMLButtonElement>('[data-rs-confirm]');
  const existingSel = root.querySelector('[data-rs-existing]') as HTMLSelectElement | null;
  const wspSel = root.querySelector('[data-rs-wsp-select]') as HTMLSelectElement | null;
  const wspManual = root.querySelector<HTMLElement>('[data-rs-wsp-manual]');
  const wspInput = root.querySelector<HTMLInputElement>('[data-rs-wsp-id]');
  const wspError = root.querySelector<HTMLElement>('[data-rs-wsp-error]');
  const nameInput = root.querySelector<HTMLInputElement>('[data-rs-newname]');
  const nameError = root.querySelector<HTMLElement>('[data-rs-name-error]');
  const dialog = document.getElementById('restore-confirm-modal') as HTMLDialogElement | null;

  const pager = createPager({
    root,
    name: 'rs',
    sizes: [10, 25, 50],
    defaultSize: 25,
    storageKey: 'rs-pagesize',
    onChange: () => renderTables(),
  });

  // ── THE REQUEST — built once, read by every surface ──────────────────────────────
  function currentBase(): RestoreModelBase {
    return base as RestoreModelBase;
  }
  function selectedTables(): RestoreModelTable[] {
    return currentBase().tables.filter((t) => selected.has(t.id));
  }
  function capturedNames(): string[] {
    return basesIn(snapshot as RestoreSnapshot).map((b) => b.name);
  }
  function buildRequest(): RestoreRequest {
    const rows = selectedTables();
    const targetName = targetKind === 'new'
      ? newName.trim()
      : (model.existingBases.find((e) => e.id === existingId)?.name ?? '');
    return {
      snapshot: snapshot as RestoreSnapshot,
      baseName: currentBase().name,
      tableNames: rows.map((t) => t.name),
      records: rows.reduce((s, t) => s + t.records, 0),
      attachments: rows.reduce((s, t) => s + t.attachments, 0),
      attachmentsMode: attMode,
      destinationLabel: model.destinationLabel,
      destinationStoresFiles: model.destinationStoresFiles,
      target: targetKind === 'new' ? { kind: 'new', name: targetName } : { kind: 'existing', name: targetName },
      // The confirm names the workspace the user CHOSE. It used to print `model.workspaceName`, one
      // fixed string, so the sentence said "in your Airtable workspace Acme Co." no matter which
      // workspace was selected — a clause that read as a fact and was a constant. A typed id has no
      // name to print, so the id itself is the honest thing to show.
      workspaceName:
        targetKind !== 'new'
          ? null
          : (model.workspaces.find((w) => w.id === workspaceId)?.name ?? (workspaceId.trim() || null)),
    };
  }

  /** The whole request as a URL — the reload guard AND the hand-off to the result state. */
  function requestParams(): URLSearchParams {
    const p = new URLSearchParams();
    p.set('run', (snapshot as RestoreSnapshot).runId);
    p.set('snap', (snapshot as RestoreSnapshot).runId);
    p.set('base', currentBase().id);
    p.set('tables', selectedTables().map((t) => t.id).join(','));
    p.set('att', attMode);
    p.set('target', targetKind);
    if (targetKind === 'existing') p.set('into', existingId);
    else {
      p.set('name', newName.trim());
      p.set('wsp', workspaceId.trim());
    }
    return p;
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────────
  function rowsFor(b: string): HTMLElement[] {
    return Array.from(root!.querySelectorAll<HTMLElement>(`[data-rs-body="${b}"] [data-rs-row]`));
  }

  function renderTables(): void {
    const b = currentBase().id;
    const q = (searchEl?.value || '').trim().toLowerCase();
    const all = rowsFor(b);
    const matched = q ? all.filter((r) => (r.dataset.name || '').includes(q)) : all;
    all.forEach((r) => (r.hidden = true));
    pager.window(matched).forEach((r) => (r.hidden = false));
    if (noMatch) noMatch.hidden = matched.length > 0;
    const wrap = root!.querySelector<HTMLElement>(`[data-rs-tables="${b}"]`);
    if (wrap) wrap.style.display = matched.length === 0 ? 'none' : '';
  }

  /**
   * Show only the BACKUPS that hold the chosen base, and only that base's table list.
   *
   * This is the inversion the reorder is made of. It used to hide BASE options that the chosen
   * snapshot did not contain; now the base is the given and the snapshot list narrows — one line of
   * filtering either way, which is why the model needed nothing new. Every base stays on screen at
   * all times carrying its own coverage sentence, so the note that used to say "2 bases are not in
   * this backup, so they are not offered here" has nothing left to explain and is gone.
   */
  function renderScope(): void {
    const b = currentBase();
    baseRadios.forEach((r) => (r.checked = r.dataset.base === b.id));
    let shown = 0;
    root!.querySelectorAll<HTMLElement>('[data-rs-snaprow]').forEach((row) => {
      const holds = (row.dataset.bases ?? '').split(',').includes(b.id);
      row.hidden = !holds;
      if (holds) shown += 1;
    });
    snapRadios.forEach((r) => (r.checked = r.value === (snapshot as RestoreSnapshot).runId));
    root!.querySelectorAll<HTMLElement>('[data-rs-tables]').forEach((w) => {
      w.hidden = w.dataset.rsTables !== b.id;
    });
    // THE HINT IS COMPUTED FROM WHAT IS SELECTED, never asserted about it. It first read
    // "The newest clean one is selected" whenever the base had more than one backup — a sentence
    // chosen by a branch rather than read off the selection — and it was false the moment a reader
    // switched base while holding an older date: Customer Success showed an Aug 4 backup under a
    // line promising Aug 10. The count comes from the rows actually shown, and whether this is the
    // newest comes from comparing ids.
    const cov = baseCoverage(b.id, b.name, model.snapshots);
    const holders = cov.snapshots;
    const current = snapshot as RestoreSnapshot;
    const isNewest = holders.length > 0 && holders[0].runId === current.runId;
    const stale = cov.kind === 'last-attempt-failed' ? ' The newest run did not reach this base.' : '';
    text(
      root!,
      '[data-rs-snap-hint]',
      shown === 1
        ? `One backup holds this base.${stale}`
        : isNewest
          ? `${shown} backups hold this base — the newest is selected.${stale}`
          : `${shown} backups hold this base — you have selected the one from ${current.takenAtLabel}.${stale}`,
    );
  }

  function renderCounts(): void {
    const boxes = Array.from(root!.querySelectorAll<HTMLInputElement>(`[data-rs-table][data-base="${currentBase().id}"]`));
    boxes.forEach((b) => (b.checked = selected.has(b.value)));
    const checked = selectedTables().length;
    if (countEl) countEl.textContent = String(checked);
    if (totalEl) totalEl.textContent = String(boxes.length);
    // The count-in-button pattern, with its plural. Shared with the server render.
    if (goCountEl) goCountEl.textContent = tableCountLabel(checked);
    if (clearBtn) clearBtn.hidden = checked === 0;
  }

  function renderAttachments(): void {
    const rows = selectedTables();
    const n = rows.reduce((s, t) => s + t.attachments, 0);
    text(root!, '[data-rs-att-count]', fileCountLabel(n));
    root!.querySelectorAll<HTMLInputElement>('input[name="rs-att"]').forEach((r) => {
      r.checked = r.value === attMode;
    });
  }

  /** Is the current workspace one we can name, or one the user typed? */
  function wspIsKnown(): boolean {
    return model.workspaces.some((w) => w.id === workspaceId);
  }

  function renderTarget(): void {
    root!.querySelectorAll<HTMLInputElement>('input[name="rs-target"]').forEach((r) => {
      r.checked = r.value === targetKind;
    });
    // The workspace belongs to the NEW-base branch only: an existing base already has one, so the
    // whole block goes inert with the branch rather than sitting there asking for something that
    // does not apply.
    const manual = !wspIsKnown();
    if (wspSel) {
      wspSel.value = manual ? '__other' : workspaceId;
      wspSel.disabled = targetKind !== 'new';
    }
    if (wspManual) wspManual.hidden = !manual;
    if (wspInput) {
      wspInput.value = manual ? workspaceId : '';
      wspInput.disabled = targetKind !== 'new';
    }
    if (wspError) wspError.hidden = !(targetKind === 'new' && manual && workspaceId.trim().length === 0);
    if (existingSel) {
      existingSel.value = existingId;
      existingSel.disabled = targetKind !== 'existing';
    }
    if (nameInput) {
      nameInput.value = newName;
      nameInput.disabled = targetKind !== 'new';
      nameInput.placeholder = newBaseName(currentBase().name, snapshot as RestoreSnapshot);
    }
  }

  /** The one gate: a new-base restore with no name cannot proceed. */
  function valid(): boolean {
    if (selectedTables().length === 0) return false;
    if (targetKind === 'new' && newName.trim().length === 0) return false;
    // A new base has to be created SOMEWHERE. Without this the form would happily submit a restore
    // with no workspace and the engine would have nowhere to put the base.
    if (targetKind === 'new' && workspaceId.trim().length === 0) return false;
    if (targetKind === 'existing' && !existingId) return false;
    return true;
  }

  function paint(scope: HTMLElement | Document, copy: ReturnType<typeof describeRestoreRequest>, prefix: string): void {
    text(scope, `[${prefix}-what]`, copy.what);
    text(scope, `[${prefix}-when]`, copy.when);
    text(scope, `[${prefix}-where]`, copy.where);
    text(scope, `[${prefix}-existing]`, copy.existing);
    text(scope, `[${prefix}-irreversible]`, copy.irreversible);
    text(scope, `[${prefix}-permission]`, copy.permission);
    text(scope, `[${prefix}-credits]`, copy.credits);
    const warn = scope.querySelector<HTMLElement>(`[${prefix}-warn]`);
    if (warn) {
      warn.hidden = copy.snapshotWarning === null;
      text(warn, `[${prefix}-warn-text]`, copy.snapshotWarning ?? '');
    }
    text(scope, `[${prefix}-headline]`, copy.headline);
  }

  function render(): void {
    renderScope();
    renderCounts();
    renderTables();
    renderAttachments();
    renderTarget();
    const copy = describeRestoreRequest(buildRequest(), capturedNames());
    paint(root!, copy, 'data-rs-sum');
    if (dialog) paint(dialog, copy, 'data-rc');
    if (nameError) nameError.hidden = !(targetKind === 'new' && newName.trim().length === 0);
    const ok = valid();
    if (goBtn) goBtn.toggleAttribute('disabled', !ok);
    if (confirmBtn) confirmBtn.toggleAttribute('disabled', !ok);
    // The reload guard: the configured form is IN the URL, so refreshing rebuilds it.
    const next = `${window.location.pathname}?${requestParams().toString()}`;
    window.history.replaceState(null, '', next);
  }

  // ── EVENTS ───────────────────────────────────────────────────────────────────────
  snapRadios.forEach((r) =>
    r.addEventListener('change', () => {
      const s = snapshotById(r.value);
      if (!s) return;
      // The base is unchanged BY CONSTRUCTION: only backups holding it are offered, so the old
      // fallback ("keep the base if this snapshot has it, otherwise take its first") is dead code
      // now — and keeping it would quietly re-introduce the thing the reorder removed, a base
      // changing underneath a reader who only touched the date.
      snapshot = s;
      selected = new Set(currentBase().tables.map((t) => t.id));
      newName = newBaseName(currentBase().name, s);
      pager.reset();
      render();
    }),
  );

  baseRadios.forEach((r) =>
    r.addEventListener('change', () => {
      const next = model.bases.find((b) => b.id === r.dataset.base);
      if (!next) return;
      base = next;
      // THE BASE RESETS THE BACKUP, always — the dependency Dan named runs one way, so a choice
      // downstream of the base cannot survive the base changing. Carrying the date over was tried
      // and rejected by measurement: going Product Roadmap (only an Aug 4 copy) → Customer Success
      // silently left Customer Success pinned to Aug 4 while a clean Aug 10 backup existed, with
      // nothing on screen saying the date had come from a base the reader had left behind.
      const s = newestFor(next);
      if (s) snapshot = s;
      selected = new Set(next.tables.map((t) => t.id));
      // The scope drives BOTH the target and the generated name (D05 item 2).
      newName = newBaseName(next.name, snapshot as RestoreSnapshot);
      pager.reset();
      render();
    }),
  );

  root.querySelectorAll<HTMLInputElement>('[data-rs-table]').forEach((b) =>
    b.addEventListener('change', () => {
      if (b.checked) selected.add(b.value);
      else selected.delete(b.value);
      render();
    }),
  );

  root.querySelector('[data-rs-all]')?.addEventListener('click', () => {
    selected = new Set(currentBase().tables.map((t) => t.id));
    render();
  });
  clearBtn?.addEventListener('click', () => {
    selected = new Set();
    render();
  });

  searchEl?.addEventListener('input', () => {
    pager.reset();
    renderTables();
  });

  root.querySelectorAll<HTMLInputElement>('input[name="rs-att"]').forEach((r) =>
    r.addEventListener('change', () => {
      attMode = r.value === 'links' ? 'links' : 'attachments';
      render();
    }),
  );

  root.querySelectorAll<HTMLInputElement>('input[name="rs-target"]').forEach((r) =>
    r.addEventListener('change', () => {
      targetKind = r.value === 'existing' ? 'existing' : 'new';
      render();
    }),
  );
  existingSel?.addEventListener('change', () => {
    existingId = existingSel.value;
    render();
  });
  wspSel?.addEventListener('change', () => {
    // Choosing the escape hatch clears the id so the field starts empty and `valid()` blocks the
    // submit until it is filled — rather than carrying the last named workspace's id into a box
    // that is asking for a different one.
    workspaceId = wspSel.value === '__other' ? '' : wspSel.value;
    render();
    if (wspSel.value === '__other') wspInput?.focus();
  });
  wspInput?.addEventListener('input', () => {
    workspaceId = wspInput.value;
    render();
  });
  nameInput?.addEventListener('input', () => {
    newName = nameInput.value;
    render();
  });

  goBtn?.addEventListener('click', () => {
    if (!valid()) return;
    dialog?.showModal();
  });
  confirmBtn?.addEventListener('click', () => {
    if (!valid() || !confirmBtn) return;
    // ── apps/web REAL-DATA WIRING (ui-only promotion, 2026-08-12) ──────────────────────────────
    // The harness confirm navigated to a fixture `?state=running`. In apps/web the confirm is the
    // ONLY write this product makes into a customer's Airtable, so it POSTs the request to the
    // working restore endpoint, mapping the form's snapshot+base selection onto the EXISTING
    // { sourceRunId, scope, scopeTarget } contract — `sourceRunId` is the chosen backup run
    // (snapshot.runId is the backup_runs UUID), `baseId` is the chosen base. The engine currently
    // restores the whole base regardless of table selection (workflows-restore §Out of Scope), so
    // scope='base' is honest; the per-table selection stays in the URL for when it lands.
    const s = snapshot as RestoreSnapshot;
    const b = currentBase();
    const page = document.querySelector<HTMLElement>('[data-restore-page]');
    const spaceId = page?.dataset.spaceId ?? '';
    if (!spaceId) return;
    setButtonLoading(confirmBtn, true);
    void (async () => {
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(spaceId)}/restore`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceRunId: s.runId, scope: 'base', scopeTarget: { baseId: b.id } }),
        });
        if (res.ok) {
          const data = (await res.json()) as { restoreId?: string };
          if (data.restoreId) {
            window.location.assign(`/restore?done=${encodeURIComponent(data.restoreId)}`);
            return;
          }
        }
        // Non-OK or missing id — surface it on the confirm button rather than a fake running state.
        confirmBtn.textContent = 'Something went wrong — try again';
        confirmBtn.classList.add('btn-error');
      } finally {
        setButtonLoading(confirmBtn, false);
      }
    })();
  });

  // Click-to-sort, unchanged contract — one group per base, values off the row's data-*.
  wireTableSort(
    root,
    () =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-rs-tables]')).map((w) => ({
        headers: Array.from(w.querySelectorAll<HTMLElement>('thead [data-sort-col]')),
        container: w.querySelector<HTMLElement>('[data-rs-body]')!,
        items: () => Array.from(w.querySelectorAll<HTMLElement>('[data-rs-row]')),
      })),
    (row, col) => {
      if (col === 1) return row.dataset.name || '';
      if (col === 2) return Number(row.dataset.records ?? -1);
      if (col === 3) return Number(row.dataset.fields ?? -1);
      if (col === 4) return Number(row.dataset.attachments ?? -1);
      return '';
    },
    () => {
      pager.reset();
      renderTables();
    },
  );

  render();
}
