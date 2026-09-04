import { edge, group, note, svc, type Diagram } from '../types'

/**
 * The point of this tab is the ASYMMETRY: dev is a tenant of staging, while
 * production shares nothing. If a reader takes away only one thing, it should be
 * that the boundary is an account boundary in three providers, not a naming
 * convention in one.
 */
export const environments: Diagram = {
  id: 'environments',
  label: 'Environments',
  blurb:
    'Separation is enforced at the account level in all three stateful providers. Dev is a tenant of staging; production shares nothing — no credential, no pool, no network path.',
  nodes: [
    // ── staging estate ───────────────────────────────────────────────────────
    group('g-stg', 0, 30, 560, 470, {
      label: 'STAGING ESTATE',
      sub: 'also serves dev',
      tone: 'staging',
    }),

    svc('cf-stg', 30, 95, {
      label: 'Cloudflare — staging acct',
      sub: '33857e35…',
      status: 'infra',
    }),
    svc('w-dev', 30, 185, {
      label: 'env: dev',
      sub: 'baseout-*-dev · derived name',
    }),
    svc('w-stg', 300, 185, {
      label: 'env: staging',
      sub: 'baseout-* · name pinned',
    }),

    svc('td-stg', 30, 290, {
      label: 'Trigger.dev — staging acct',
      sub: 'envs: dev + staging',
      status: 'external',
    }),
    svc('do-stg', 300, 290, {
      label: 'DigitalOcean — staging org',
      sub: 'Postgres + tunnel droplet',
      status: 'external',
    }),

    svc('db-stg', 165, 400, {
      label: 'ONE shared database',
      sub: 'dev + staging both write here',
      status: 'infra',
      tag: '⚠',
    }),

    // ── production estate ────────────────────────────────────────────────────
    group('g-prod', 660, 30, 340, 470, {
      label: 'PRODUCTION ESTATE',
      sub: 'fully isolated',
      tone: 'production',
    }),
    svc('cf-prod', 690, 95, {
      label: 'Cloudflare — prod acct',
      sub: 'separate account',
      status: 'proposed',
    }),
    svc('w-prod', 690, 185, {
      label: 'env: production',
      sub: 'baseout-* · name pinned',
      status: 'proposed',
    }),
    svc('td-prod', 690, 290, {
      label: 'Trigger.dev — prod acct',
      sub: 'env: prod',
      status: 'proposed',
    }),
    svc('do-prod', 690, 400, {
      label: 'DigitalOcean — prod org',
      sub: 'own cluster + own droplet',
      status: 'proposed',
    }),

    note(
      'n-why',
      0,
      540,
      'WHY dev shares staging: dev is a developer convenience. A dev mistake can dirty staging data but can never reach production — the API token that would write there has no permission in that account.',
      560,
    ),
    note(
      'n-cost',
      660,
      540,
      'Production must RE-CREATE, not copy: Hyperdrive config, KV namespaces, R2 buckets, mTLS CA upload, VPC service, tunnel, droplet, Access service token. Durable Object state does not migrate.',
      340,
    ),
    note(
      'n-name',
      0,
      700,
      'Naming asymmetry: dev derives baseout-web-dev from wrangler env suffixing. staging + production PIN the bare name, because Workers Builds overrides any derived name via WRANGLER_CI_OVERRIDE_NAME. Different accounts, so the two bare names cannot collide. scripts/check-wrangler-secrets.mjs enforces exactly this.',
      1000,
    ),
  ],
  edges: [
    edge('s1', 'cf-stg', 'w-dev', { from: 'sb', to: 'tt' }),
    edge('s2', 'cf-stg', 'w-stg', { label: 'same account' }),
    edge('s3', 'w-dev', 'db-stg', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('s4', 'w-stg', 'db-stg', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('s5', 'do-stg', 'db-stg', { from: 'sb', to: 'tt' }),
    edge('s6', 'td-stg', 'db-stg', { from: 'sb', to: 'tt', kind: 'dashed' }),

    edge('p1', 'cf-prod', 'w-prod', { from: 'sb', to: 'tt' }),
    edge('p2', 'w-prod', 'td-prod', { from: 'sb', to: 'tt', kind: 'dashed' }),
    edge('p3', 'td-prod', 'do-prod', { from: 'sb', to: 'tt' }),
  ],
}
