import { describe, expect, it } from 'vitest';
import { deriveBannerProps } from './connection-health';

const active = { status: 'active', displayName: 'Demo Airtable Workspace' };

describe('deriveBannerProps', () => {
  it('returns null when every connection is active', () => {
    expect(
      deriveBannerProps({ connections: [active], storageDestinations: [{ type: 'google_drive' }] }),
    ).toBeNull();
  });

  it('returns null for an empty state', () => {
    expect(deriveBannerProps({ connections: [], storageDestinations: [] })).toBeNull();
  });

  it('maps one invalid connection to a broken source banner naming the provider', () => {
    const props = deriveBannerProps({
      connections: [{ status: 'invalid', displayName: 'Acme Airtable' }],
      storageDestinations: [],
    });
    expect(props).toMatchObject({ state: 'broken', side: 'source', provider: 'Acme Airtable' });
    expect(props?.reconnectHref).toBeTruthy();
  });

  it('maps a pending_reauth connection to an amber expiring banner', () => {
    const props = deriveBannerProps({
      connections: [{ status: 'pending_reauth', displayName: 'Acme Airtable' }],
      storageDestinations: [],
    });
    expect(props).toMatchObject({ state: 'expiring', side: 'source', provider: 'Acme Airtable' });
    // No fabricated TTL — we don't know days-to-expiry from status alone.
    expect(props?.daysToExpiry).toBeUndefined();
  });

  it('maps a refreshing connection to a reconnecting banner', () => {
    const props = deriveBannerProps({
      connections: [{ status: 'refreshing', displayName: 'Acme Airtable' }],
      storageDestinations: [],
    });
    expect(props).toMatchObject({ state: 'reconnecting', provider: 'Acme Airtable' });
  });

  it('rolls up 2+ broken connections into a grouped banner', () => {
    const props = deriveBannerProps({
      connections: [
        { status: 'invalid', displayName: 'Airtable A' },
        { status: 'invalid', displayName: 'Airtable B' },
      ],
      storageDestinations: [],
    });
    expect(props?.state).toBe('broken');
    expect(props?.count).toBe(2);
    expect(props?.names).toEqual(['Airtable A', 'Airtable B']);
  });

  it('prioritises broken over pending_reauth over refreshing', () => {
    const props = deriveBannerProps({
      connections: [
        { status: 'refreshing', displayName: 'R' },
        { status: 'pending_reauth', displayName: 'P' },
        { status: 'invalid', displayName: 'I' },
      ],
      storageDestinations: [],
    });
    expect(props).toMatchObject({ state: 'broken', provider: 'I' });
  });
});
