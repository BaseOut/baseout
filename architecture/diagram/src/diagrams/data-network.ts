import { edge, group, note, svc, type Diagram } from '../types'

/**
 * §9 of systems-overview.md, drawn. Two consumers, one door. The resource IDs
 * are real and verified — they are the fastest way to confirm a config drift
 * against the dashboard.
 */
export const dataNetwork: Diagram = {
  id: 'data-network',
  label: 'Data & Network',
  blurb:
    'The master database has no public ingress. Two consumers reach it — Workers via the VPC service, humans and CI via cloudflared access tcp — and both traverse the same tunnel.',
  nodes: [
    // ── consumer 1: workers ──────────────────────────────────────────────────
    group('g-w', 0, 40, 250, 220, { label: 'Consumer 1 — Workers', tone: 'staging' }),
    svc('workers', 24, 100, {
      label: 'six Workers',
      sub: 'web·server·admin·api·hooks·sql',
    }),
    svc('hd', 24, 185, {
      label: 'Hyperdrive',
      sub: 'bo-db-staging · ec6bd358…',
      status: 'infra',
    }),

    // ── consumer 2: node tooling ─────────────────────────────────────────────
    group('g-n', 0, 320, 250, 230, { label: 'Consumer 2 — Node tooling', tone: 'neutral' }),
    svc('ci', 24, 380, {
      label: 'Workers Builds / laptop',
      sub: 'pnpm db:migrate:tunnel',
    }),
    svc('cfdcli', 24, 465, {
      label: 'cloudflared access tcp',
      sub: '→ 127.0.0.1:5433',
      status: 'infra',
    }),

    // ── the single door ──────────────────────────────────────────────────────
    group('g-door', 340, 40, 300, 510, {
      label: 'THE SINGLE DOOR',
      sub: 'one place to revoke',
      tone: 'danger',
    }),
    svc('vpc', 364, 100, {
      label: 'Workers VPC service',
      sub: '01a04fc4…',
      status: 'infra',
    }),
    svc('mtls', 364, 190, {
      label: 'mTLS: openside-db-ca',
      sub: 'sslmode verify-full',
      status: 'infra',
      tag: '✓',
    }),
    svc('access', 364, 330, {
      label: 'Cloudflare Access',
      sub: 'build-db.baseout.dev',
      status: 'infra',
    }),
    svc('token', 364, 420, {
      label: 'Access service token',
      sub: 'CF_CLIENT_ID / _SECRET',
      status: 'infra',
    }),
    svc('tunnel', 364, 250, {
      label: 'Cloudflare Tunnel',
      sub: 'os-db-tunnel · 4 conns · healthy',
      status: 'infra',
      tag: '★',
    }),

    // ── origin ───────────────────────────────────────────────────────────────
    group('g-do', 730, 120, 300, 320, {
      label: 'DigitalOcean',
      sub: 'staging org',
      tone: 'neutral',
    }),
    svc('droplet', 754, 180, {
      label: 'cloudflared on droplet',
      sub: 'firewall: 0 inbound rules',
      status: 'external',
      tag: '⇢ out',
    }),
    svc('vpcnet', 754, 270, {
      label: 'DigitalOcean VPC',
      sub: 'private addressing only',
      status: 'external',
    }),
    svc('pg', 754, 360, {
      label: 'Managed PostgreSQL',
      sub: 'schema baseout · 43 migrations',
      status: 'external',
    }),

    // ── the other stores ─────────────────────────────────────────────────────
    group('g-other', 730, 500, 300, 250, {
      label: 'Not the master DB',
      tone: 'neutral',
    }),
    svc('d1', 754, 555, {
      label: 'D1 per-Space',
      sub: 'Airtable-derived; server provisions',
      status: 'built',
    }),
    svc('byodb', 754, 645, {
      label: 'BYODB',
      sub: 'customer-owned alternative',
      status: 'proposed',
    }),

    note(
      'n-out',
      340,
      580,
      'Nothing listens. cloudflared dials OUT to Cloudflare and the tunnel rides those connections — no port to scan, no IP range to allowlist, nothing to update when Cloudflare egress changes.',
      300,
    ),
    note(
      'n-ca',
      0,
      600,
      'The TLS blocker is solved: DigitalOcean’s private per-project root is uploaded as a Cloudflare mTLS CA and referenced by the Hyperdrive origin, so this hop runs verify-full — not the "encryption without authentication" the VPC service alone was limited to.',
      300,
    ),
    note(
      'n-dep',
      340,
      700,
      'This is now a DEPLOY dependency: pnpm db:migrate:tunnel runs inside web’s build command, so a droplet reboot blocks every web deploy. Intended failure direction — but it needs Worker-grade uptime attention.',
      300,
    ),
  ],
  edges: [
    edge('d1e', 'workers', 'hd', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('d2e', 'hd', 'vpc', { kind: 'thick' }),
    edge('d3e', 'vpc', 'mtls', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('d4e', 'mtls', 'tunnel', { from: 'sb', to: 'tt', kind: 'thick' }),

    edge('d5e', 'ci', 'cfdcli', { from: 'sb', to: 'tt' }),
    edge('d6e', 'cfdcli', 'access', { kind: 'thick' }),
    edge('d7e', 'token', 'access', { from: 'sr', to: 'tl', label: 'authenticates' }),
    edge('d8e', 'access', 'tunnel', { from: 'sr', to: 'tl', kind: 'thick' }),

    edge('d9e', 'tunnel', 'droplet', { kind: 'thick', label: 'outbound only' }),
    edge('d10e', 'droplet', 'vpcnet', { from: 'sb', to: 'tt', kind: 'thick' }),
    edge('d11e', 'vpcnet', 'pg', { from: 'sb', to: 'tt', kind: 'thick' }),

    edge('d12e', 'pg', 'd1', { from: 'sb', to: 'tt', kind: 'dashed', label: 'separate concern' }),
  ],
}
