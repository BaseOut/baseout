import { describe, it, expect } from 'vitest';
import {
  buildCategories,
  buildSettingsLinks,
  initialsOf,
  type SettingsSubject,
  type SettingsRow,
} from './settingsCatalog';

const subject: SettingsSubject = {
  user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null },
  org: { name: 'Acme Analytics', slug: 'acme' },
  space: { id: 'space-1', name: 'Growth Ops', autoAddFutureBases: false },
};

function findRow(cats: ReturnType<typeof buildCategories>, id: string): SettingsRow | undefined {
  return cats.flatMap((c) => c.sections).flatMap((s) => s.rows).find((r) => r.id === id);
}

describe('initialsOf', () => {
  it('takes the first two initials, uppercased', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('cher')).toBe('C');
    expect(initialsOf('  jean   luc  picard ')).toBe('JL');
  });
});

describe('buildCategories — identity is a prop, never a literal', () => {
  const cats = buildCategories(subject);

  it('threads the signed-in name/email/org/space into the rows', () => {
    expect(findRow(cats, 'account-name')?.value).toBe('Ada Lovelace');
    expect(findRow(cats, 'account-email')?.value).toBe('ada@example.com');
    expect(findRow(cats, 'org-name')?.value).toBe('Acme Analytics');
    expect(findRow(cats, 'org-slug')?.value).toBe('acme');
    expect(findRow(cats, 'space-name')?.value).toBe('Growth Ops');
  });

  it('renders empty strings (not a literal) when org is absent', () => {
    const noOrg = buildCategories({ user: subject.user, org: null, space: subject.space });
    expect(findRow(noOrg, 'org-name')?.value).toBe('');
    expect(findRow(noOrg, 'org-slug')?.value).toBe('');
  });

  it('replaces the Space pane with Create Space when space is null (S32-F1)', () => {
    const noSpace = buildCategories({ user: subject.user, org: subject.org, space: null });
    expect(findRow(noSpace, 'space-name')).toBeUndefined();
    expect(findRow(noSpace, 'space-delete')).toBeUndefined();
    expect(findRow(noSpace, 'space-autoadd')).toBeUndefined();
    const create = findRow(noSpace, 'space-create');
    expect(create?.control).toBe('button');
    expect(create?.trigger).toBe('create-space');
    expect(create?.note).toBeUndefined();
    expect(noSpace.find((c) => c.id === 'space')?.sections[0]?.title).toBe('No Space yet');
  });

  it('exposes the seven categories in order, with Security row-less', () => {
    expect(cats.map((c) => c.id)).toEqual([
      'account',
      'security',
      'organization',
      'space',
      'billing',
      'notifications',
      'developer',
    ]);
    expect(cats.find((c) => c.id === 'security')?.sections).toEqual([]);
  });
});

describe('buildCategories — apps/web wiring vs honest gating', () => {
  const cats = buildCategories(subject);

  it('wires the real routes: billing portal action, and real hrefs', () => {
    expect(findRow(cats, 'billing-method')?.action).toBe('billing-portal');
    expect(findRow(cats, 'billing-email')?.action).toBe('billing-portal');
    expect(findRow(cats, 'billing-invoices')?.action).toBe('billing-portal');
    expect(findRow(cats, 'billing-plan')?.action).toBe('billing-portal');
    expect(findRow(cats, 'billing-usage')?.href).toBe('/reports');
    expect(findRow(cats, 'space-retention')?.href).toBe('/retention');
    expect(findRow(cats, 'space-schedule')?.href).toBe('/backups');
    expect(findRow(cats, 'space-destination')?.href).toBe('/destinations');
  });

  it('ungates the rows that now have a persistence route', () => {
    expect(findRow(cats, 'account-name')?.gated).toBeUndefined();
    expect(findRow(cats, 'space-name')?.gated).toBeUndefined();
    expect(findRow(cats, 'space-autoadd')?.gated).toBeUndefined();
    expect(findRow(cats, 'space-autoadd')?.on).toBe(false);
  });

  it('gates the rows with no persistence route (never a fake save)', () => {
    for (const id of ['org-name', 'org-slug', 'notify-failed', 'notify-quiet']) {
      expect(findRow(cats, id)?.gated, `${id} must be gated`).toBe(true);
    }
    // The account email stays a read-only fact, not a gated control.
    expect(findRow(cats, 'account-email')?.readOnly).toBe(true);
    // Limit behaviour is a pricing-model fact (warn/enforce), not a customer toggle.
    expect(findRow(cats, 'billing-overage')?.readOnly).toBe(true);
    expect(findRow(cats, 'billing-overage')?.gated).toBeUndefined();
    expect(findRow(cats, 'billing-email')?.gated).toBeUndefined();
  });

  it('drops the fixture "API tokens" link — the real panel supersedes it', () => {
    expect(findRow(cats, 'dev-tokens')).toBeUndefined();
  });

  it('keeps a real destructive consequence + honest note on delete rows', () => {
    const del = findRow(cats, 'account-delete');
    expect(del?.control).toBe('destructive');
    expect(del?.consequence).toContain('no undo');
    expect(del?.note).toContain('support');
  });
});

describe('buildSettingsLinks — the drill-down address', () => {
  it('is not drilled with no tab/state, and lists at the bare path', () => {
    const links = buildSettingsLinks(new URL('https://x/settings'));
    expect(links.drilled).toBe(false);
    expect(links.listHref).toBe('/settings');
    expect(links.tabHref('security')).toBe('/settings?tab=security');
  });

  it('is drilled when a tab (or state) is present', () => {
    expect(buildSettingsLinks(new URL('https://x/settings?tab=billing')).drilled).toBe(true);
    expect(buildSettingsLinks(new URL('https://x/settings?state=scan')).drilled).toBe(true);
  });

  it('listHref strips tab + state; tabHref drops state but carries other params', () => {
    const links = buildSettingsLinks(new URL('https://x/settings?tab=security&state=scan&fixture=empty'));
    expect(links.listHref).toBe('/settings?fixture=empty');
    // `set('tab', …)` updates the existing `tab` key in place, so it keeps its original position.
    expect(links.tabHref('developer')).toBe('/settings?tab=developer&fixture=empty');
  });
});
