// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { wireRegistryDetail } from './registryEditMode';

function mountRegistry(): void {
  document.body.innerHTML = `
    <div data-reg-root data-mode="read">
      <h1 data-reg-title>Original</h1>
      <span data-reg-read="name">Original</span>
      <input data-reg-input="name" value="Original" />
      <button type="button" data-reg-mode="read" class="sch-mode-active" aria-pressed="true">Read</button>
      <button type="button" data-reg-mode="edit" aria-pressed="false">Edit</button>
      <button type="button" data-reg-cancel>Cancel</button>
      <button type="button" data-reg-save>Save</button>
    </div>
  `;
  wireRegistryDetail('re-checked');
}

describe('wireRegistryDetail (S25-F1 / ship #2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('Cancel restores the committed baseline, not a poisoned edit entry', () => {
    mountRegistry();
    const root = document.querySelector<HTMLElement>('[data-reg-root]')!;
    const input = document.querySelector<HTMLInputElement>('[data-reg-input]')!;
    const edit = document.querySelector<HTMLButtonElement>('[data-reg-mode="edit"]')!;
    const read = document.querySelector<HTMLButtonElement>('[data-reg-mode="read"]')!;
    const cancel = document.querySelector<HTMLButtonElement>('[data-reg-cancel]')!;

    edit.click();
    input.value = 'Dirty';
    // Read segment must discard — the old bug captured Dirty as the new Cancel baseline.
    read.click();
    expect(input.value).toBe('Original');
    expect(root.dataset.mode).toBe('read');

    edit.click();
    input.value = 'Second try';
    cancel.click();
    expect(input.value).toBe('Original');
  });

  it('Save is the only writer of the committed baseline', () => {
    mountRegistry();
    const input = document.querySelector<HTMLInputElement>('[data-reg-input]')!;
    const edit = document.querySelector<HTMLButtonElement>('[data-reg-mode="edit"]')!;
    const save = document.querySelector<HTMLButtonElement>('[data-reg-save]')!;
    const cancel = document.querySelector<HTMLButtonElement>('[data-reg-cancel]')!;
    const title = document.querySelector<HTMLElement>('[data-reg-title]')!;

    edit.click();
    input.value = 'Committed';
    save.click();
    vi.advanceTimersByTime(400);
    expect(title.textContent).toBe('Committed');

    edit.click();
    input.value = 'Abandoned';
    cancel.click();
    expect(input.value).toBe('Committed');
  });
});
