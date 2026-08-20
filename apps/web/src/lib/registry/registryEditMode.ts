/**
 * The registry detail page's read/edit mode — ONE implementation for both registry objects.
 *
 * `SourceDetailView` and `DestinationDetailView` are declared ONE FAMILY (audit D12) and both files
 * carried this controller as byte-identical text, each with a comment saying it wanted to be one
 * module. This is that module, in the home `lib/registry/` that `removal.ts` already established
 * (D38 — the object registry is one pattern). Extracting it also puts the code somewhere real
 * `tsc --strict` can see: `astro check` never walks an `apps/web` `<script>` block, so the two copies
 * were typechecked by nothing.
 *
 * ─── THE CONTRACT (D30, one save contract) ───
 *
 * Read is the default mode · Edit is an explicit switch · Save is the ONLY commit · every other exit
 * from edit — the Cancel button, Escape, and the `Read` segment of the mode switcher — DISCARDS.
 *
 * ONE BASELINE, WRITTEN IN ONE PLACE. `committedValues` is initialised from the DOM at mount and
 * re-assigned only by Save. Entering edit captures nothing.
 *
 * That last sentence is the whole fix (audit S25-F1 / X11-F2, S1). The previous version captured
 * `entryValues` on EVERY entry into edit mode, and there were THREE exits of which only two honoured
 * a contract: Cancel reverted, Save committed, and the `Read` segment did neither. So: enter edit →
 * type → click `Read` → nothing reverts and nothing commits, leaving the read slot showing the old
 * text while `input.value` still held the dirty text → click `Edit` again → the DIRTY value became
 * the baseline. From that moment `Cancel` restored *to the abandoned edit*, permanently, and `Save`
 * committed work the user had walked away from. No fourth handler can fix that, because the defect is
 * that an exit was allowed to write the baseline. Here no exit writes it, so no exit can poison it —
 * the third exit is safe BY CONSTRUCTION rather than by a handler remembering to be.
 *
 * WHAT THE `Read` SEGMENT MEANS: it reverts, silently. It is a VIEW switcher, not a form control —
 * the same two-segment `join` that flips a panel between its read and its editable projection — and a
 * segmented switcher that refuses to switch is a surprise on a control whose entire affordance is
 * "this shows you the other side". The user who wants to keep the typing has `Save` one row below it,
 * in the edit bar, at the same moment. (Where the loss is an authored DOCUMENT rather than one field
 * of typing, D30's amendment rules the opposite way and mounts a confirm — that is `SchemaDocs` and
 * `ReportDefinitionView`, not this surface, whose loss is one field's worth of text.)
 *
 * The read slot renders from the DRAFT, never from a separately-held record (D30 amendment 2, after
 * `entityPanelController.ts:142`): `paintValue` writes the read slot from the input Save just
 * committed, and a discard resets the inputs to the text the read slot is already showing. The two
 * cannot disagree, so the user can always see which value `Save` would commit.
 */
import { setButtonLoading } from '../ui';
import { wireTableSort } from '../../components/schema/tableSort';

/**
 * @param refreshNote What the "check for new bases / re-check the connection" button reports. It is
 *   the ONE sentence that differs between the two pages — the object kinds answer a different
 *   question — so it is a parameter rather than a reason to keep two controllers.
 */
export function wireRegistryDetail(refreshNote: string): void {
  const root = document.querySelector<HTMLElement>('[data-reg-root]');
  if (!root || root.dataset.regWired === '1') return;
  root.dataset.regWired = '1';

  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-reg-input]'));
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-reg-mode]'));

  /**
   * The last COMMITTED values — the single baseline. Written here, at mount, and by Save. By
   * NOTHING else: see the header comment on why entering edit mode must not capture.
   */
  let committedValues: string[] = inputs.map((i) => i.value);

  /** Throw the draft away. Every exit from edit that is not Save ends here. */
  function discardDraft(): void {
    inputs.forEach((input, i) => {
      input.value = committedValues[i] ?? input.value;
    });
  }

  function paintValue(field: string, value: string): void {
    const read = root!.querySelector<HTMLElement>(`[data-reg-read="${field}"]`);
    if (read) read.textContent = value;
    if (field === 'name') {
      const title = root!.querySelector<HTMLElement>('[data-reg-title]');
      if (title) title.textContent = value;
    }
  }

  function setMode(mode: 'read' | 'edit'): void {
    if (root!.dataset.mode === mode) return;
    // Leaving edit ALWAYS discards. Save commits first, so by the time it calls this the draft and
    // `committedValues` are equal and the discard is a no-op — which is exactly why there is no
    // fourth code path and no exit the contract can miss.
    if (mode === 'read') discardDraft();
    root!.dataset.mode = mode;
    modeButtons.forEach((b) => {
      const on = b.dataset.regMode === mode;
      b.classList.toggle('sch-mode-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (mode === 'edit') inputs[0]?.focus();
  }

  modeButtons.forEach((b) =>
    b.addEventListener('click', () => setMode(b.dataset.regMode === 'edit' ? 'edit' : 'read')),
  );

  root.querySelector<HTMLButtonElement>('[data-reg-cancel]')?.addEventListener('click', () => {
    setMode('read');
  });

  /**
   * SAVE IS A CONTROL THAT STARTS WORK, SO IT DISABLES ITSELF (audit D49, X14-F4).
   *
   * `setButtonLoading` is the RATIFIED busy affordance — twelve call sites, twelve lines, and the
   * catalog's unused `loading` prop is the thing that changed, not the app. It disables the button,
   * sets `aria-busy` and injects the spinner, so the second press of a double-click reaches nothing;
   * clearing it in `finally` is what keeps a throw from leaving the page stuck busy.
   *
   * The commit is deferred by a beat because in production it IS a network call, and a busy state
   * that resolves in the same frame is a busy state nobody can see or test. The shape is copied from
   * `schemaAutomations.ts` (the implementation D49 names as already correct), not invented here.
   */
  const saveBtn = root.querySelector<HTMLButtonElement>('[data-reg-save]');
  saveBtn?.addEventListener('click', () => {
    if (saveBtn.disabled) return;
    setButtonLoading(saveBtn, true);
    window.setTimeout(() => {
      try {
        // No backend in this harness: Save commits into the page it edited, which is the honest
        // moment for the title to change. Refreshing resets to the fixture, as everywhere else.
        inputs.forEach((input) => paintValue(input.dataset.regInput ?? '', input.value));
        committedValues = inputs.map((i) => i.value); // the ONLY write to the baseline
        setMode('read');
      } finally {
        setButtonLoading(saveBtn, false);
      }
    }, 400);
  });

  root.addEventListener('keydown', (e) => {
    // Escape inside edit mode cancels AND is swallowed, so it never reaches the page's own Escape.
    if (e.key !== 'Escape' || root!.dataset.mode !== 'edit') return;
    e.preventDefault();
    e.stopPropagation();
    setMode('read');
  });

  const refresh = root.querySelector<HTMLButtonElement>('[data-refresh-bases]');
  const note = root.querySelector<HTMLElement>('[data-refresh-note]');
  refresh?.addEventListener('click', () => {
    // Harness: there is nothing to call, and new-base detection is poll-only (no Airtable event);
    // fake the re-check the real page will do.
    if (!note || refresh.disabled) return;
    // D49 again: this control STARTS WORK (it re-checks a remote connection), so it wears the same
    // busy affordance as Save. Before this it could be hammered, and every press printed the same
    // sentence with nothing in between to say a check was under way.
    setButtonLoading(refresh, true);
    window.setTimeout(() => {
      try {
        note.textContent = refreshNote;
        note.classList.remove('hidden');
      } finally {
        setButtonLoading(refresh, false);
      }
    }, 400);
  });

  // Keyboard for clickable "In use by" rows — Enter/Space opens the Space. Table.astro's
  // wireRowKeys is not mounted on these registry detail tables yet (raw <table>), so this stays
  // here until that migration. DestinationDetailView's rows are not role=button (string[] only).
  root.querySelectorAll<HTMLElement>('.reg-userow[role="button"]').forEach((row) => {
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      row.click();
    });
  });

  // Click-sort on the "In use by" table — the same tableSort.ts the two registry LISTS use, so the
  // caret and the keyboard behaviour are the one recipe rather than a third. Bound once, not per
  // sort: wireTableSort MOVES the same <tr>s, it does not rebuild them.
  const useTable = root.querySelector<HTMLElement>('.reg-usewrap table');
  const useBody = useTable?.querySelector<HTMLElement>('tbody') ?? null;
  if (useTable && useBody) {
    // Prefer `thead [data-sort-col]` so this still works when Table.astro puts the attribute on the
    // inner <button>; today's markup keeps it on the <th>, which this selector also matches.
    const headers = Array.from(useTable.querySelectorAll<HTMLElement>('thead [data-sort-col]'));
    const items = () => Array.from(useBody.querySelectorAll<HTMLElement>('tr'));
    wireTableSort(useTable, () => [{ headers, container: useBody, items }], (item, col) => {
      // Read the raw attribute: `data-sort-0` does NOT map to dataset.sort0 (a digit after the
      // hyphen isn't camel-cased), so dataset access would silently return undefined and no-op.
      const v = item.getAttribute(`data-sort-${col}`) || '';
      const n = Number(v);
      return Number.isFinite(n) && v !== '' ? n : String(v);
    });
  }
}
