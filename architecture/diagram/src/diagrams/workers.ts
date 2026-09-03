import { edge, group, note, svc, type Diagram } from '../types'

/**
 * Worker topology plus the bindings each one holds. The two facts worth carrying
 * away: service bindings are one-directional and cannot cross accounts, and
 * `hooks` deliberately has none.
 */
export const workers: Diagram = {
  id: 'workers',
  label: 'Workers',
  blurb:
    'Eight Workers. Internal calls ride service bindings, never public HTTP — and every one carries an x-internal-token header behind that network isolation.',
  nodes: [
    group('g-front', 0, 40, 250, 400, { label: 'Customer-facing', tone: 'neutral' }),
    svc('web', 24, 95, { label: 'web', sub: 'Astro · full site', tag: 'SSR' }),
    svc('api', 24, 190, { label: 'api', sub: 'REST + MCP server', status: 'built' }),
    svc('sql', 24, 285, { label: 'sql', sub: 'read-only, Business+', status: 'proposed' }),
    svc('support', 24, 370, { label: 'support', sub: 'assets only, no main' }),

    group('g-int', 330, 40, 250, 300, { label: 'Internal', tone: 'neutral' }),
    svc('admin', 354, 95, { label: 'admin', sub: 'staff console' }),
    svc('hooks', 354, 190, { label: 'hooks', sub: 'webhook receiver', status: 'built' }),
    svc('design', 354, 275, {
      label: 'design',
      sub: 'Node adapter — cannot deploy',
      status: 'proposed',
    }),

    group('g-eng', 680, 60, 260, 260, { label: 'Engine', tone: 'staging' }),
    svc('server', 704, 115, { label: 'server', sub: '/api/health + /api/internal/*' }),
    svc('connection-do', 704, 205, {
      label: 'ConnectionDO',
      sub: '1/Connection · 5 req/s gate',
      status: 'infra',
    }),
    svc('space-do', 704, 265, {
      label: 'SpaceDO',
      sub: '1/Space · run lock + alarm',
      status: 'infra',
    }),

    group('g-bind', 0, 500, 940, 210, {
      label: 'Runtime bindings',
      sub: 'non-inheritable — every env restates its own set',
      tone: 'neutral',
    }),
    svc('b-hd', 24, 555, { label: 'HYPERDRIVE', sub: 'web·server·admin·api·hooks·sql', status: 'infra' }),
    svc('b-kv', 264, 555, { label: 'SESSION (KV)', sub: 'web · admin', status: 'infra' }),
    svc('b-r2', 504, 555, { label: 'BACKUPS_R2', sub: 'server — read-only by discipline', status: 'infra' }),
    svc('b-ai', 744, 555, { label: 'AI', sub: 'server — always remote', status: 'infra' }),
    svc('b-email', 24, 640, { label: 'EMAIL', sub: 'web · server', status: 'infra' }),
    svc('b-ae', 264, 640, { label: 'API_USAGE (AE)', sub: 'api metering', status: 'infra' }),
    svc('b-rl', 504, 640, { label: 'RATE_LIMITER', sub: 'api — shadow mode', status: 'infra' }),
    svc('b-assets', 744, 640, { label: 'ASSETS', sub: 'web·admin·support·design', status: 'infra' }),

    note(
      'n-hooks',
      330,
      370,
      'hooks has NO binding to server, on purpose: the 2026-07-18 pull-based design keeps the webhook receiver working through an engine outage.',
      250,
    ),
    note(
      'n-do',
      680,
      350,
      'Each Worker script owns its own DO namespaces, so baseout-server-staging and the production script start with EMPTY state. Migration consideration, not a bug.',
      260,
    ),
    note(
      'n-ai',
      680,
      450,
      'Workers AI has no local simulator — remote:true is mandatory, so `wrangler dev` needs a valid account token or the dev server will not boot.',
      260,
    ),
  ],
  edges: [
    edge('w1', 'web', 'server', { label: 'BACKUP_ENGINE', kind: 'thick' }),
    edge('w2', 'admin', 'server', { label: 'BACKUP_ENGINE', kind: 'thick' }),
    edge('w3', 'api', 'server', { label: 'SERVER', kind: 'thick' }),
    edge('w4', 'server', 'connection-do', { from: 'sb', to: 'tt' }),
    edge('w5', 'server', 'space-do', { from: 'sb', to: 'tl' }),
  ],
}
