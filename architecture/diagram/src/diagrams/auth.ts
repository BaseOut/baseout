import { edge, group, note, svc, type Diagram } from '../types'

/**
 * §10 drawn. The organising idea is that the mechanism is chosen by WHO is
 * calling, not by which route is hit — so the tab is five lanes, one per caller
 * class, and they share almost nothing.
 *
 * Worth keeping visible: admin issues no session of its own, and api's REST and
 * MCP surfaces authenticate through the SAME bearer path (one TokenGrant), which
 * is why a token's scopes constrain its MCP tools identically.
 */
export const auth: Diagram = {
  id: 'auth',
  label: 'Auth',
  blurb:
    'Five mechanisms, chosen by caller class rather than by route. No passwords exist anywhere. REST and MCP share one bearer path, so scopes constrain both identically.',
  nodes: [
    // ── lane 1: human customer ───────────────────────────────────────────────
    group('g-cust', 0, 40, 900, 200, {
      label: '1 — Human customer  →  web',
      sub: 'better-auth, passwordless',
      tone: 'staging',
    }),
    svc('human', 24, 100, { label: 'Customer', sub: 'console.baseout.dev' }),
    svc('magic', 234, 95, {
      label: 'Magic link',
      sub: 'primary factor · expires 60s',
      tag: 'no passwords',
    }),
    svc('sso', 234, 175, {
      label: 'Airtable SSO',
      sub: 'genericOAuth · separate minimal-scope app',
      status: 'proposed',
    }),
    svc('totp', 444, 95, {
      label: 'TOTP 2FA (optional)',
      sub: 'backup codes · secret encrypted at rest',
    }),
    svc('session', 654, 95, {
      label: 'Session',
      sub: '30 days · cookieCache → sessions table + KV',
      status: 'infra',
    }),
    svc('envscope', 654, 175, {
      label: 'auth-env-scope.ts',
      sub: 'email lookups scoped to worker env',
      status: 'infra',
      tag: 'fail closed',
    }),

    // ── lane 2: staff ────────────────────────────────────────────────────────
    group('g-staff', 0, 270, 900, 190, {
      label: '2 — Staff  →  admin',
      sub: 'admin runs NO better-auth instance',
      tone: 'neutral',
    }),
    svc('staff', 24, 330, { label: 'Staff member', sub: 'admin.baseout.dev' }),
    svc('roles', 234, 325, {
      label: "users.role === 'super'",
      sub: "'customer' | 'super' — NOT user_role='admin'",
      status: 'infra',
    }),
    svc('handoff', 444, 325, {
      label: '60s AES-GCM handoff',
      sub: 'web /api/admin/handoff mints',
    }),
    svc('adminck', 654, 325, {
      label: 'baseout_admin_session',
      sub: "admin's own cookie · reads sessions, never writes",
      status: 'infra',
    }),

    // ── lane 3: machine / AI ─────────────────────────────────────────────────
    group('g-api', 0, 490, 900, 260, {
      label: '3 — Machine / AI client  →  api',
      sub: 'REST and MCP share ONE bearer path',
      tone: 'production',
    }),
    svc('client', 24, 550, { label: 'Script / AI client', sub: 'api.baseout.dev' }),
    svc('bearer', 234, 545, {
      label: 'Bearer bo_live_…',
      sub: 'prefix checked before any DB hit',
      tag: 'SHA-256',
    }),
    svc('grant', 444, 545, {
      label: 'TokenGrant',
      sub: 'org · optional space · 10 scopes',
      status: 'infra',
    }),
    svc('rest', 654, 505, { label: 'REST routes', sub: 'scope-gated' }),
    svc('mcp', 654, 585, {
      label: 'MCP server',
      sub: 'same grant → same scopes',
      status: 'built',
    }),
    svc('limits', 234, 660, {
      label: 'RATE_LIMITER + API_USAGE',
      sub: 'per-token · shadow mode · AE metering',
      status: 'infra',
    }),

    // ── lane 4: sibling worker ───────────────────────────────────────────────
    group('g-svc', 0, 780, 440, 190, {
      label: '4 — Sibling Worker  →  server',
      tone: 'neutral',
    }),
    svc('sibling', 24, 840, {
      label: 'web · admin · api',
      sub: 'SERVER_INTERNAL_TOKEN',
    }),
    svc('gate', 234, 840, {
      label: 'x-internal-token',
      sub: 'constant-time vs SERVER_INTERNAL_TOKEN',
      status: 'infra',
    }),

    // ── lane 5: airtable webhooks ────────────────────────────────────────────
    group('g-hook', 470, 780, 430, 190, {
      label: '5 — Airtable  →  hooks',
      tone: 'neutral',
    }),
    svc('at', 494, 840, { label: 'Airtable', sub: 'webhook POST', status: 'external' }),
    svc('mac', 694, 840, {
      label: 'X-Airtable-Content-MAC',
      sub: 'verified vs mac_secret_base64_enc',
      status: 'infra',
    }),

    note(
      'n-tenant',
      444, 660,
      'Tenant-safe on purpose: an org/Space mismatch returns 404, NEVER 403, so another tenant’s ids are never confirmed to exist. A missing scope returns 403 — the distinction is deliberate.',
      270,
    ),
    note(
      'n-scopes',
      654, 660,
      'Write scopes do NOT imply their read scope. documents:read and documents:write are composed explicitly.',
      246,
    ),
    note(
      'n-sql',
      0, 1000,
      'apps/sql has ONE source file and no auth code at all — no bearer parse, no HMAC verify, no internal gate. Its route is path-scoped (sql.baseout.dev/v1/*) precisely to limit what an unfinished Worker exposes. SERVICE_HMAC_TO_SERVER — the planned HMAC successor to the bearer SERVER_INTERNAL_TOKEN — was removed from secrets.required on 2026-09-04: no code signs or verifies with it, so gating a deploy on it only failed builds. Reserved in .dev.vars.example; re-add on BOTH sides when the signing code lands.',
      440,
    ),
    note(
      'n-match',
      470, 1000,
      'Three values must be byte-identical across Workers or things break SILENTLY: BASEOUT_ENCRYPTION_KEY (web writes, server reads — drift forces customer reconnects), server SERVER_INTERNAL_TOKEN = the three SERVER_INTERNAL_TOKENs, and ADMIN_HANDOFF_SECRET (web mints, admin opens).',
      430,
    ),
  ],
  edges: [
    edge('a1', 'human', 'magic'),
    edge('a2', 'human', 'sso', { kind: 'dashed' }),
    edge('a3', 'magic', 'totp', { label: 'if enrolled' }),
    edge('a4', 'totp', 'session', { kind: 'thick' }),
    edge('a5', 'sso', 'session', { kind: 'dashed' }),
    edge('a6', 'session', 'envscope', { from: 'sb', to: 'tt' }),

    edge('b1', 'staff', 'roles'),
    edge('b2', 'roles', 'handoff', { label: 'gated on super' }),
    edge('b3', 'handoff', 'adminck', { kind: 'thick', label: 'opens' }),

    edge('c1', 'client', 'bearer'),
    edge('c2', 'bearer', 'grant', { kind: 'thick', label: 'hash → row' }),
    edge('c3', 'grant', 'rest'),
    edge('c4', 'grant', 'mcp'),
    edge('c5', 'bearer', 'limits', { from: 'sb', to: 'tt', kind: 'dashed' }),

    edge('d1', 'sibling', 'gate', { kind: 'thick' }),
    edge('e1', 'at', 'mac', { kind: 'thick' }),
  ],
}
