import { edge, group, note, svc, type Diagram } from '../types'

/**
 * Main tab. One question answered: what talks to what, from a browser down to
 * Postgres. Detail belongs in the other tabs — anything that would need a second
 * sentence to explain goes there instead.
 */
export const overview: Diagram = {
  id: 'overview',
  label: 'Overview',
  blurb:
    'Edge to database, one request deep. Colours are the status vocabulary from systems-overview.md; the bold path is the only route to the master database.',
  nodes: [
    // ── clients ──────────────────────────────────────────────────────────────
    group('g-clients', 0, 40, 210, 330, { label: 'Clients', tone: 'neutral' }),
    svc('customer', 24, 90, { label: 'Customer browser', sub: 'console.baseout.com', tag: 'web' }),
    svc('aiclient', 24, 180, { label: 'AI client', sub: 'MCP over HTTP', status: 'built' }),
    svc('staff', 24, 270, { label: 'Staff', sub: 'admin.baseout.com' }),

    // ── cloudflare edge ──────────────────────────────────────────────────────
    group('g-edge', 270, 0, 300, 560, {
      label: 'Cloudflare Workers',
      sub: 'staging account · 33857e35…',
      tone: 'staging',
    }),
    svc('web', 296, 60, { label: 'web', sub: 'Astro SSR · auth · dashboard' }),
    svc('admin', 296, 150, { label: 'admin', sub: 'staff console' }),
    svc('api', 296, 240, { label: 'api', sub: 'REST + MCP server', status: 'built' }),
    svc('hooks', 296, 330, { label: 'hooks', sub: 'Airtable webhooks', status: 'built' }),
    svc('sql', 296, 420, { label: 'sql', sub: 'read-only SQL', status: 'proposed' }),
    svc('support', 296, 500, { label: 'support', sub: 'docs portal' }),

    // ── engine ───────────────────────────────────────────────────────────────
    group('g-engine', 630, 60, 250, 260, { label: 'Backup engine', tone: 'staging' }),
    svc('server', 654, 115, { label: 'server', sub: 'headless · /api/internal/*' }),
    svc('dos', 654, 210, {
      label: 'Durable Objects',
      sub: 'ConnectionDO · SpaceDO',
      status: 'infra',
    }),

    // ── background ───────────────────────────────────────────────────────────
    svc('trigger', 654, 390, {
      label: 'Trigger.dev',
      sub: 'Node runner · 9 tasks',
      status: 'external',
      tag: 'sep. acct',
    }),

    // ── private data path ────────────────────────────────────────────────────
    group('g-data', 940, 0, 300, 420, {
      label: 'Private path to Postgres',
      sub: 'no public ingress',
      tone: 'danger',
    }),
    svc('hyperdrive', 964, 55, {
      label: 'Hyperdrive',
      sub: 'bo-db-staging · pool 20',
      status: 'infra',
    }),
    svc('vpc', 964, 145, {
      label: 'Workers VPC service',
      sub: 'mTLS · verify-full',
      status: 'infra',
    }),
    svc('tunnel', 964, 235, {
      label: 'Cloudflare Tunnel',
      sub: 'os-db-tunnel · healthy',
      status: 'infra',
    }),
    svc('cfd', 964, 325, {
      label: 'cloudflared',
      sub: 'DO droplet · 0 inbound ports',
      status: 'infra',
    }),

    svc('pg', 964, 470, {
      label: 'DigitalOcean Postgres',
      sub: 'master DB · schema baseout',
      status: 'external',
    }),

    // ── other stores ─────────────────────────────────────────────────────────
    svc('d1', 630, 490, { label: 'D1 per-Space', sub: 'Airtable-derived data', status: 'built' }),
    svc('airtable', 24, 400, { label: 'Airtable', sub: 'OAuth · REST · MCP', status: 'external' }),

    // Snapshot destinations. Broken out rather than collapsed into one "R2 /
    // BYOS" box — the five live writers are five separate external
    // integrations, each with its own OAuth app. Full picture: Storage tab.
    group('g-dest', 290, 610, 640, 180, {
      label: 'Snapshot destinations',
      sub: 'written by Trigger.dev only — never by a Worker',
      tone: 'neutral',
    }),
    svc('r2', 314, 665, { label: 'Cloudflare R2', sub: 'default · S3 API creds', tag: 'managed' }),
    svc('gdrive', 524, 665, { label: 'Google Drive', sub: 'per-Space OAuth', tag: 'BYOS' }),
    svc('box', 734, 665, { label: 'Box', sub: 'per-Space OAuth', tag: 'BYOS' }),
    svc('dropbox', 314, 720, { label: 'Dropbox', sub: 'per-Space OAuth', tag: 'BYOS' }),
    svc('onedrive', 524, 720, { label: 'OneDrive', sub: 'per-Space OAuth', tag: 'BYOS' }),
    svc('s3', 734, 720, { label: 'S3 · Frame.io', sub: 'accepted, no writer yet', status: 'proposed' }),

    note(
      'n-1',
      940,
      560,
      'The bold chain is the ONLY route to the master database. The droplet firewall has no inbound rules — cloudflared dials out.',
      300,
    ),
  ],
  edges: [
    edge('e1', 'customer', 'web'),
    edge('e2', 'aiclient', 'api'),
    edge('e3', 'staff', 'admin'),

    edge('e4', 'web', 'server', { label: 'SERVER' }),
    edge('e5', 'admin', 'server', { label: 'SERVER' }),
    edge('e6', 'api', 'server', { label: 'SERVER' }),

    edge('e7', 'server', 'dos', { from: 'sb', to: 'tt' }),
    edge('e8', 'server', 'trigger', { from: 'sb', to: 'tt', kind: 'dashed', label: 'enqueue' }),
    edge('e9', 'trigger', 'server', { label: 'progress / complete', kind: 'dashed' }),

    edge('e10', 'web', 'hyperdrive', { kind: 'thick' }),
    edge('e11', 'server', 'hyperdrive', { kind: 'thick' }),
    edge('e12', 'hyperdrive', 'vpc', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('e13', 'vpc', 'tunnel', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('e14', 'tunnel', 'cfd', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('e15', 'cfd', 'pg', { from: 'sb', to: 'tt', kind: 'thick', label: 'private VPC' }),

    edge('e16', 'server', 'd1', { from: 'sb', to: 'tt', kind: 'dashed' }),
    edge('e17', 'trigger', 'r2', { from: 'sb', to: 'tt', kind: 'dashed', label: 'writes snapshots' }),
    edge('e17b', 'trigger', 'gdrive', { from: 'sb', to: 'tt', kind: 'dashed' }),
    edge('e17c', 'trigger', 'box', { from: 'sb', to: 'tt', kind: 'dashed' }),
    edge('e17d', 'trigger', 'dropbox', { from: 'sb', to: 'tl', kind: 'dashed' }),
    edge('e17e', 'trigger', 'onedrive', { from: 'sb', to: 'tl', kind: 'dashed' }),
    edge('e18', 'trigger', 'airtable', { kind: 'dashed', label: 'reads bases' }),
    edge('e19', 'hooks', 'pg', { kind: 'dashed', label: 'dirty-mark' }),
  ],
}
