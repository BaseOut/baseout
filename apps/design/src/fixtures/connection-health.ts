// Fixtures for the connection-health banner preview (/connection-banner).
// Each entry drives one ConnectionHealthBanner instance — props mirror the
// component API. `trigger` documents what real-world event raises the state.
import type { ConnectionBannerProps } from '@web/components/patterns/connection-health-banner';

export interface BannerPreview {
  key: string;
  label: string;
  trigger: string;
  props: ConnectionBannerProps;
}

export const BANNER_PREVIEWS: BannerPreview[] = [
  {
    key: 'broken',
    label: 'Broken · source',
    trigger: 'Airtable token revoked or expired → backups paused (connection status: invalid)',
    props: { state: 'broken', provider: 'Airtable', side: 'source', lastBackup: '2 days ago', reconnectHref: '/sources' },
  },
  {
    key: 'broken-dest',
    label: 'Broken · destination',
    trigger: 'Google Drive access revoked → backups can’t be written (design preview — destinations carry no status yet)',
    props: { state: 'broken', provider: 'Google Drive', side: 'destination', reconnectHref: '/destinations' },
  },
  {
    key: 'multiple',
    label: 'Multiple broken',
    trigger: '2+ connections down → grouped roll-up, not stacked banners',
    props: { state: 'broken', count: 3, names: ['Airtable', 'Google Drive', 'Dropbox'], reconnectHref: '/sources' },
  },
  {
    key: 'expiring',
    label: 'Expiring soon',
    trigger: 'connection status: pending_reauth → warn before it lapses',
    props: { state: 'expiring', provider: 'Google Drive', daysToExpiry: 5, reconnectHref: '/destinations' },
  },
  {
    key: 'degraded',
    label: 'Degraded',
    trigger: 'no successful backup in 24h, not yet a hard auth failure',
    props: { state: 'degraded', provider: 'Airtable', reconnectHref: '/sources' },
  },
  {
    key: 'reconnecting',
    label: 'Reconnecting',
    trigger: 'connection status: refreshing → OAuth done, verifying access',
    props: { state: 'reconnecting', provider: 'Airtable' },
  },
  {
    key: 'restored',
    label: 'Restored',
    trigger: 'verify passed → confirm + re-queue the missed backup',
    props: { state: 'restored' },
  },
];

export function findBannerPreview(key: string | null): BannerPreview | undefined {
  return BANNER_PREVIEWS.find((p) => p.key === key);
}
