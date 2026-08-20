// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  WELCOME_REQUIRED,
  welcomeErrorId,
  isFieldSatisfied,
  controlShell,
} from './welcomeForm';

describe('WELCOME_REQUIRED', () => {
  it('lists each required field with house-voice copy (no pleading Please)', () => {
    const byName = Object.fromEntries(WELCOME_REQUIRED.map((f) => [f.name, f]));
    expect(byName.firstName).toEqual({
      name: 'firstName',
      message: 'Enter your first name.',
      kind: 'text',
    });
    expect(byName.lastName).toEqual({
      name: 'lastName',
      message: 'Enter your last name.',
      kind: 'text',
    });
    expect(byName.jobTitle).toEqual({
      name: 'jobTitle',
      message: 'Enter your job title.',
      kind: 'text',
    });
    expect(byName.orgName).toEqual({
      name: 'orgName',
      message: 'Enter your organization name.',
      kind: 'text',
    });
    expect(byName.termsAccepted).toEqual({
      name: 'termsAccepted',
      message: 'Accept the terms to continue.',
      kind: 'checkbox',
    });
    for (const f of WELCOME_REQUIRED) {
      expect(f.message.startsWith('Please')).toBe(false);
    }
  });

  it('marks text vs checkbox kinds correctly', () => {
    const kinds = Object.fromEntries(WELCOME_REQUIRED.map((f) => [f.name, f.kind]));
    expect(kinds.firstName).toBe('text');
    expect(kinds.termsAccepted).toBe('checkbox');
  });
});

describe('welcomeErrorId', () => {
  it('names the per-field message slot', () => {
    expect(welcomeErrorId('firstName')).toBe('welcome-firstName-error');
    expect(welcomeErrorId('termsAccepted')).toBe('welcome-termsAccepted-error');
  });
});

describe('isFieldSatisfied', () => {
  it('refuses blank and whitespace-only text', () => {
    const el = document.createElement('input');
    el.value = '';
    expect(isFieldSatisfied(el, 'text')).toBe(false);
    el.value = '   ';
    expect(isFieldSatisfied(el, 'text')).toBe(false);
  });

  it('accepts non-blank text', () => {
    const el = document.createElement('input');
    el.value = 'Ada';
    expect(isFieldSatisfied(el, 'text')).toBe(true);
  });

  it('requires a checked checkbox', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = false;
    expect(isFieldSatisfied(el, 'checkbox')).toBe(false);
    el.checked = true;
    expect(isFieldSatisfied(el, 'checkbox')).toBe(true);
  });

  it('returns false for a missing element', () => {
    expect(isFieldSatisfied(null, 'text')).toBe(false);
    expect(isFieldSatisfied(null, 'checkbox')).toBe(false);
  });

  it('all-valid: every WELCOME_REQUIRED entry can pass together', () => {
    const values: Record<string, string | boolean> = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      jobTitle: 'Founder',
      orgName: 'Acme',
      termsAccepted: true,
    };
    const ok = WELCOME_REQUIRED.every((f) => {
      const el = document.createElement('input');
      if (f.kind === 'checkbox') {
        el.type = 'checkbox';
        el.checked = Boolean(values[f.name]);
      } else {
        el.value = String(values[f.name] ?? '');
      }
      return isFieldSatisfied(el, f.kind);
    });
    expect(ok).toBe(true);
  });
});

describe('controlShell', () => {
  it('returns null for checkboxes (no input-error paint)', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    expect(controlShell(el, 'checkbox')).toBeNull();
  });

  it('prefers the wrapping label.input shell when present', () => {
    const label = document.createElement('label');
    label.className = 'input';
    const el = document.createElement('input');
    label.appendChild(el);
    document.body.appendChild(label);
    expect(controlShell(el, 'text')).toBe(label);
    label.remove();
  });

  it('falls back to the input itself when there is no label.input wrapper', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    expect(controlShell(el, 'text')).toBe(el);
    el.remove();
  });
});
