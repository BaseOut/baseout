// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { hideAlert, setAlertMessage, showAlert } from './alert';

function mountVessel(opts: { hidden?: boolean; text?: string } = {}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-ui-alert', '');
  el.setAttribute('role', 'alert');
  if (opts.hidden) {
    el.hidden = true;
    el.classList.add('hidden');
  }
  const text = document.createElement('span');
  text.setAttribute('data-alert-text', '');
  text.textContent = opts.text ?? '';
  el.appendChild(text);
  document.body.appendChild(el);
  return el;
}

describe('showAlert (D42 write/reveal order)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('un-hides then writes (reveal before mutation)', () => {
    const el = mountVessel({ hidden: true, text: '' });
    const flushPoints: boolean[] = [];
    Object.defineProperty(el, 'offsetHeight', {
      configurable: true,
      get() {
        flushPoints.push(!el.hidden);
        return 1;
      },
    });

    showAlert(el, 'Save failed.');

    expect(el.hidden).toBe(false);
    expect(el.classList.contains('hidden')).toBe(false);
    expect(el.querySelector('[data-alert-text]')!.textContent).toBe('Save failed.');
    // Forced reflow must see the vessel already visible — that is the whole announce contract.
    expect(flushPoints).toEqual([true]);
  });

  it('skips the write when the message is unchanged (X-M14)', () => {
    const el = mountVessel({ text: 'Same warning.' });
    expect(setAlertMessage(el, 'Same warning.')).toBe(false);
    expect(setAlertMessage(el, 'New warning.')).toBe(true);
    expect(el.querySelector('[data-alert-text]')!.textContent).toBe('New warning.');
  });

  it('hideAlert conceals and can clear stale text', () => {
    const el = mountVessel({ text: 'Stale.' });
    hideAlert(el, true);
    expect(el.hidden).toBe(true);
    expect(el.querySelector('[data-alert-text]')!.textContent).toBe('');
  });
});
