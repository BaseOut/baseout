/**
 * Derive the app-wide connection-health banner props from the connection state
 * already hydrated for a Space — pure, no engine/DB access. Consumes only the
 * status vocabulary the `connections` table exposes (`active` · `refreshing` ·
 * `pending_reauth` · `invalid`) and maps it onto the graded banner model in
 * `connection-health-banner.ts`. Returns null when nothing needs attention, so
 * the shell renders no banner on a healthy Space.
 *
 * Storage destinations carry no status column today, so a destination cannot be
 * derived as "broken" from live data — destination-side / expiry states stay
 * design-harness previews until the engine tracks destination health. Precedence
 * is broken > pending_reauth > refreshing.
 */
import type { ConnectionBannerProps } from '../components/patterns/connection-health-banner';

interface ConnectionLike {
  status: string;
  displayName?: string | null;
}

interface StorageDestinationLike {
  type: string;
}

const RECONNECT_HREF = '/sources';

export function deriveBannerProps(state: {
  connections: ConnectionLike[];
  storageDestinations: StorageDestinationLike[];
}): ConnectionBannerProps | null {
  const connections = state.connections ?? [];
  const name = (c: ConnectionLike) => c.displayName || 'Airtable';

  const broken = connections.filter((c) => c.status === 'invalid');
  const reauth = connections.filter((c) => c.status === 'pending_reauth');
  const refreshing = connections.filter((c) => c.status === 'refreshing');

  if (broken.length > 1) {
    return {
      state: 'broken',
      side: 'source',
      count: broken.length,
      names: broken.map(name),
      reconnectHref: RECONNECT_HREF,
    };
  }
  if (broken.length === 1) {
    return {
      state: 'broken',
      side: 'source',
      provider: name(broken[0]),
      reconnectHref: RECONNECT_HREF,
    };
  }
  if (reauth.length >= 1) {
    return {
      state: 'expiring',
      side: 'source',
      provider: name(reauth[0]),
      reconnectHref: RECONNECT_HREF,
    };
  }
  if (refreshing.length >= 1) {
    return {
      state: 'reconnecting',
      side: 'source',
      provider: name(refreshing[0]),
    };
  }
  return null;
}
