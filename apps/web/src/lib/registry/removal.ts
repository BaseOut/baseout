/**
 * The consequence of removing a registry object — a source or a destination — derived ONCE.
 *
 * `SourceDetailView` and `DestinationDetailView` are declared ONE FAMILY (audit D12): same width,
 * same block anatomy, same `.reg-*` vocabulary, same edit contract. Their Remove dialogs are the
 * same act on two object kinds, so the sentence has one home rather than two — the rule P13 named
 * and P16.3 applied. Both files already carry a comment saying their duplicated blocks *want* to be
 * one module; this is that module for the half D06 adds.
 *
 * SCOPE. The in-use guard is CORRECT and unchanged (D06 "Not changing"): while any Space uses the
 * object, Remove is disabled and the card says which Spaces to move first. This copy is for
 * `inUseCount === 0` — the only case in which the button is pressable.
 *
 * NOTHING IS ASSERTED. Because no Space uses the object, there is no schedule and no report
 * definition pointing at it, and the copy SAYS that rather than printing a count of dependants it
 * has not counted. The one thing that genuinely survives the removal — backups already written —
 * is named, because that is the fear the dialog exists to answer.
 *
 * NO UNDO TOAST HERE, deliberately. `pattern-undo-toast` forbids offering Undo for something that
 * cannot be restored, and a removed connection cannot be: re-adding it means authorizing from
 * scratch. The dialog says so instead, which is the other half of D06's rule.
 */

/**
 * Wire the Remove button to the dialog, and the dialog's outcome to the honest note.
 *
 * Shared for the same reason the copy is: the two registry pages must not diverge (D12), and a
 * six-line handler written twice drifts exactly as readily as a sentence written twice.
 *
 * NOT-OURS: nothing is removed. There is no backend in this mirror, so confirming states what would
 * happen and why it did not — the same deferred-action contract `pattern-settings-row` documents.
 * Faking a removal would leave the object on the list page it links back to, which is worse than
 * saying nothing happened.
 */
export function wireRegistryRemove(kindWord: 'source' | 'destination'): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-reg-remove]');
  const dlg = document.getElementById('reg-remove-modal') as HTMLDialogElement | null;
  const note = document.querySelector<HTMLElement>('[data-reg-removed]');
  if (!btn || !dlg || btn.dataset.regRemoveWired) return;
  btn.dataset.regRemoveWired = '1';
  btn.addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'confirm' || !note) return;
    note.textContent = `Confirmed. Removing the ${kindWord} is deliberately not simulated in this preview — nothing was removed, and a refresh returns this page to its fixture.`;
    note.hidden = false;
  });
}

export interface RegistryRemovalCopy {
  title: string;
  lead: string;
  consequence: string;
  confirmLabel: string;
}

export interface SourceRemovalFacts {
  kind: 'source';
  name: string;
  /** 'Personal access token' | 'OAuth' — what re-adding would cost the user. */
  authLabel: string;
  /** # bases this connection can see, from the connection itself. */
  basesAvailable: number;
}

export interface DestinationRemovalFacts {
  kind: 'destination';
  name: string;
  /** 'Database' | 'File storage'. */
  kindLabel: string;
  /** Where data lands, e.g. 'folder /Baseout' — the object's own `detail`. */
  detail: string;
}

export type RegistryRemovalFacts = SourceRemovalFacts | DestinationRemovalFacts;

export function describeRegistryRemoval(f: RegistryRemovalFacts): RegistryRemovalCopy {
  if (f.kind === 'source') {
    return {
      title: `Remove ${f.name}?`,
      lead:
        `Baseout stops being able to read from this Airtable account, and the ${f.basesAvailable} ` +
        `base${f.basesAvailable === 1 ? '' : 's'} it can see stop being available to any Space.`,
      consequence:
        'Backups already written stay where they are — removing a source never deletes data you have backed up. ' +
        'No Space uses this source, so no schedule and no report stops running. ' +
        `Adding it back means ${f.authLabel === 'OAuth' ? 'authorizing Airtable again from scratch' : 'issuing a new personal access token'}; this removal cannot be undone.`,
      confirmLabel: 'Remove source',
    };
  }
  return {
    title: `Remove ${f.name}?`,
    lead: `Baseout stops writing to this ${f.kindLabel.toLowerCase()} (${f.detail}).`,
    consequence:
      `Backups already written stay in ${f.detail} — removing a destination never deletes them, and Baseout does not touch the ${f.kindLabel.toLowerCase()} itself. ` +
      'No Space uses this destination, so no schedule and no report stops running. ' +
      'Adding it back means connecting and authorizing again; this removal cannot be undone.',
    confirmLabel: 'Remove destination',
  };
}
