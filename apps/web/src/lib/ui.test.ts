// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { setButtonLoading } from './ui';

describe('setButtonLoading', () => {
  let btn: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '<button type="submit">Save</button>';
    btn = document.querySelector('button')!;
  });

  it('adds a daisyUI spinner, disables the button, and sets aria-busy when loading=true', () => {
    setButtonLoading(btn, true);

    const spinner = btn.querySelector('[data-loading-spinner]');
    expect(spinner).not.toBeNull();
    expect(spinner!.className).toBe('loading loading-spinner loading-sm');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('removes the spinner, re-enables the button, and clears aria-busy when loading=false', () => {
    setButtonLoading(btn, true);
    setButtonLoading(btn, false);

    expect(btn.querySelector('[data-loading-spinner]')).toBeNull();
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute('aria-busy')).toBe('false');
  });

  it('is idempotent when called repeatedly with the same value', () => {
    setButtonLoading(btn, true);
    setButtonLoading(btn, true);
    setButtonLoading(btn, true);

    expect(btn.querySelectorAll('[data-loading-spinner]').length).toBe(1);

    setButtonLoading(btn, false);
    setButtonLoading(btn, false);

    expect(btn.querySelectorAll('[data-loading-spinner]').length).toBe(0);
    expect(btn.disabled).toBe(false);
  });

  it('preserves existing button content (the spinner is prepended)', () => {
    btn.innerHTML = '<span class="label">Send Sign-In Link</span>';

    setButtonLoading(btn, true);

    const children = Array.from(btn.children);
    expect(children.length).toBe(2);
    expect(children[0].getAttribute('data-loading-spinner')).toBe('');
    expect((children[1] as HTMLElement).textContent).toBe('Send Sign-In Link');

    setButtonLoading(btn, false);
    expect(btn.children.length).toBe(1);
    expect((btn.children[0] as HTMLElement).textContent).toBe('Send Sign-In Link');
  });
});
