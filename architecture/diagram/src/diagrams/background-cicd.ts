import { edge, group, note, svc, type Diagram } from '../types'

/**
 * Two flows that are easy to conflate: the RUNTIME backup flow (server →
 * Trigger.dev → callbacks) and the BUILD-TIME deploy flow (Workers Builds).
 * They share only one thing — Trigger.dev is now deployed by the same CI that
 * deploys the Workers.
 */
export const backgroundCicd: Diagram = {
  id: 'background-cicd',
  label: 'Background & CI/CD',
  blurb:
    'Runtime job flow on top, deploy pipelines underneath. Since 2026-09-03 Trigger.dev deploys through Workers Builds too — GitHub Actions no longer deploys anything.',
  nodes: [
    // ── runtime flow ─────────────────────────────────────────────────────────
    group('g-run', 0, 30, 1010, 250, {
      label: 'RUNTIME — a backup run',
      tone: 'staging',
    }),
    svc('spacedo', 24, 95, {
      label: 'SpaceDO alarm',
      sub: 'decides a Space is due',
      status: 'infra',
    }),
    svc('server', 244, 95, { label: 'server', sub: 'creates backup_runs row' }),
    svc('trigger', 464, 95, {
      label: 'Trigger.dev task',
      sub: 'backup-base on Node',
      status: 'external',
    }),
    svc('airtable', 684, 95, {
      label: 'Airtable',
      sub: 'REST + MCP reads',
      status: 'external',
    }),
    svc('store', 684, 190, {
      label: 'R2 · Drive · Box · Dropbox · OneDrive',
      sub: 'one writer per destination — Storage tab',
    }),
    svc('callback', 244, 190, {
      label: '/api/internal/runs/:id',
      sub: 'progress · complete',
    }),

    // ── deploy flow ──────────────────────────────────────────────────────────
    group('g-ci', 0, 330, 1010, 300, {
      label: 'BUILD TIME — Workers Builds',
      sub: 'no deploys from developer machines',
      tone: 'neutral',
    }),
    svc('git', 24, 400, {
      label: 'git push',
      sub: 'staging branch → staging',
      tag: 'main → prod',
    }),

    svc('bweb', 264, 385, {
      label: 'web pipeline',
      sub: 'db:migrate:tunnel && astro build',
      tag: '⚠ migrates',
    }),
    svc('bapps', 264, 480, {
      label: 'six sibling pipelines',
      sub: 'admin·api·hooks·sql·support·diagram',
    }),
    svc('bwf', 264, 560, {
      label: 'workflows pipeline',
      sub: 'trigger.dev deploy --env',
      tag: 'not wrangler',
    }),

    svc('deps', 524, 480, {
      label: 'build:deps first',
      sub: '@baseout/shared → dist/ is gitignored',
      status: 'infra',
    }),
    svc('gate', 524, 385, {
      label: 'secrets.required gate',
      sub: 'missing secret fails the deploy',
      status: 'infra',
    }),
    svc('anchor', 524, 560, {
      label: 'baseout-workflows anchor',
      sub: '404 stub — NOT a runtime',
      status: 'infra',
    }),

    svc('cfout', 784, 385, { label: 'Workers', sub: 'deployed per env' }),
    svc('tdout', 784, 560, {
      label: 'Trigger.dev',
      sub: 'tasks deployed per env',
      status: 'external',
    }),

    note(
      'n-nets',
      0,
      190,
      'Callback transport errors are fire-and-forget. The backup_runs state machine and the SpaceDO alarm are the safety nets — not retries.',
      200,
    ),
    note(
      'n-lock',
      264,
      660,
      'Seven pipelines fire on one push with NO ordering between them, so db:migrate wraps drizzle-kit in a pg_advisory_lock. __drizzle_migrations is a ledger, not a mutex.',
      240,
    ),
    note(
      'n-watch',
      524,
      660,
      'Web’s build must watch db/migrations/**, db/** and pnpm-lock.yaml, or a migration-only push applies nothing and deploys nothing — silently.',
      240,
    ),
    note(
      'n-expand',
      784,
      660,
      'Nothing guarantees a migration lands before the OTHER six Workers, so expand-then-contract is mandatory: additive in release n, destructive no earlier than n+1.',
      240,
    ),
  ],
  edges: [
    edge('r1', 'spacedo', 'server'),
    edge('r2', 'server', 'trigger', { label: 'enqueue', kind: 'dashed' }),
    edge('r3', 'trigger', 'airtable'),
    edge('r4', 'trigger', 'store', { from: 'sb', to: 'tt' }),
    edge('r5', 'trigger', 'callback', { from: 'sb', to: 'tr', kind: 'dashed' }),
    edge('r6', 'callback', 'server', { from: 'sb', to: 'tl' }),

    edge('c1', 'git', 'bweb'),
    edge('c2', 'git', 'bapps'),
    edge('c3', 'git', 'bwf'),
    edge('c4', 'bweb', 'gate'),
    edge('c5', 'bapps', 'deps'),
    edge('c6', 'bwf', 'anchor'),
    edge('c7', 'gate', 'cfout', { kind: 'thick' }),
    edge('c8', 'deps', 'cfout'),
    edge('c9', 'anchor', 'tdout', { kind: 'thick' }),
  ],
}
