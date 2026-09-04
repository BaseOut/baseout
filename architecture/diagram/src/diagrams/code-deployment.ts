import { edge, group, note, svc, type Diagram } from '../types'

/**
 * architecture/code-lifecycle.md drawn. Two lanes, because the two branches have
 * genuinely different shapes: staging is push-to-deploy with no gate, main needs
 * a reviewed PR.
 *
 * The facts here were read from the live GitHub API on 2026-09-04 — notably that
 * `main` has NO required status checks, so CI is advisory. Keeping that visible
 * is half the point of the tab.
 */
export const codeDeployment: Diagram = {
  id: 'code-deployment',
  label: 'Code deployment',
  blurb:
    'Two branches. A push to staging IS a deploy — no gate. main needs a reviewed PR, but CI is not a required check, so the review is the only gate. GitHub never deploys and holds zero secrets.',
  nodes: [
    // ── staging lane ─────────────────────────────────────────────────────────
    group('g-stg', 0, 40, 940, 200, {
      label: 'STAGING PATH — push to deploy',
      sub: 'branch is unprotected',
      tone: 'staging',
    }),
    svc('local', 24, 105, { label: 'local commit', sub: 'change/<name> branch' }),
    svc('pushstg', 234, 100, {
      label: 'push → staging',
      sub: 'no protection rule at all',
      tag: '⚠ deploys',
    }),
    svc('ci1', 444, 100, {
      label: 'ci.yml',
      sub: 'runs, but blocks nothing',
      status: 'infra',
    }),
    svc('wbstg', 654, 100, {
      label: 'Workers Builds',
      sub: '9 projects, in parallel',
      status: 'infra',
    }),
    svc('stgest', 654, 175, {
      label: 'staging estate',
      sub: 'staging account',
    }),

    // ── production lane ──────────────────────────────────────────────────────
    group('g-prod', 0, 280, 940, 230, {
      label: 'PRODUCTION PATH — reviewed PR',
      sub: 'main is protected',
      tone: 'production',
    }),
    svc('pr', 24, 345, {
      label: 'Pull Request',
      sub: 'staging → main',
    }),
    svc('checks', 234, 320, {
      label: 'ci.yml + codeql',
      sub: 'ADVISORY — not required',
      status: 'infra',
      tag: '⚠',
    }),
    svc('review', 234, 400, {
      label: '1 approving review',
      sub: 'the ONLY merge gate',
      tag: 'required',
    }),
    svc('merge', 444, 360, { label: 'merge → main', sub: 'default branch' }),
    svc('wbprod', 654, 320, {
      label: 'Workers Builds',
      sub: 'production project set',
      status: 'infra',
    }),
    svc('prodest', 654, 400, {
      label: 'production estate',
      sub: 'SEPARATE account',
      status: 'proposed',
    }),

    // ── what github does / does not ──────────────────────────────────────────
    group('g-gh', 0, 550, 460, 250, {
      label: 'GitHub',
      sub: 'checks only',
      tone: 'neutral',
    }),
    svc('ghci', 24, 605, {
      label: 'ci.yml — 13 steps',
      sub: 'lat check · secrets parity · cron map · typecheck · lint · tests · storybook',
      status: 'infra',
    }),
    svc('ghql', 24, 700, {
      label: 'codeql.yml',
      sub: 'main + schedule',
      status: 'infra',
    }),
    svc('ghsec', 244, 700, {
      label: 'ZERO secrets',
      sub: 'actions · variables · dependabot all 0',
      tag: '✓ verified',
    }),

    // ── cloudflare side ──────────────────────────────────────────────────────
    group('g-cf', 500, 550, 440, 250, {
      label: 'Cloudflare — the only secret store',
      tone: 'danger',
    }),
    svc('rt', 524, 605, {
      label: 'runtime secrets',
      sub: 'wrangler secret bulk .env.secrets.<env>',
      status: 'infra',
    }),
    svc('gate2', 744, 605, {
      label: 'secrets.required',
      sub: 'missing → deploy FAILS',
      status: 'infra',
    }),
    svc('bv', 524, 700, {
      label: 'build variables',
      sub: 'per Workers Builds project',
      status: 'infra',
    }),
    svc('vars', 744, 700, {
      label: 'vars in wrangler.jsonc',
      sub: 'committed — non-secret only',
      status: 'infra',
    }),

    note(
      'n-gate',
      0,
      830,
      'CI is NOT a required status check on main (required_status_checks: None), so a PR can merge with ci.yml red — the review is the only gate. enforce_admins is also false, so an admin can push straight to main. Adding `test` as a required check is a one-setting fix and the highest-value hardening here.',
      460,
    ),
    note(
      'n-order',
      500,
      830,
      'Nothing orders the 9 pipelines against each other — they fire in parallel on one push. Hence db:migrate holds a pg_advisory_lock, and expand-then-contract is MANDATORY: additive half in release n, destructive half no earlier than n+1.',
      440,
    ),
    note(
      'n-mig',
      654,
      240,
      'Migrations are chained into WEB’s build command, so a failed migration fails that build and web cannot deploy ahead of its schema.',
      286,
    ),
    note(
      'n-wf',
      444,
      440,
      'workflows is the exception: its deploy command is `trigger.dev deploy`, not wrangler. A 404 stub Worker exists only to give the build trigger something to attach to.',
      200,
    ),
  ],
  edges: [
    edge('s1', 'local', 'pushstg'),
    edge('s2', 'pushstg', 'ci1', { kind: 'dashed', label: 'advisory' }),
    edge('s3', 'pushstg', 'wbstg', { kind: 'thick', label: 'triggers' }),
    edge('s4', 'wbstg', 'stgest', { from: 'sb', to: 'tt', kind: 'thick' }),

    edge('p1', 'pr', 'checks'),
    edge('p2', 'pr', 'review'),
    edge('p3', 'checks', 'merge', { kind: 'dashed' }),
    edge('p4', 'review', 'merge', { kind: 'thick', label: 'gate' }),
    edge('p5', 'merge', 'wbprod', { kind: 'thick', label: 'triggers' }),
    edge('p6', 'wbprod', 'prodest', { from: 'sb', to: 'tt', kind: 'thick' }),

    edge('g1', 'ghci', 'ghql', { from: 'sb', to: 'tt' }),
    edge('c1', 'rt', 'gate2', { kind: 'thick' }),
    edge('c2', 'bv', 'vars', { kind: 'dashed' }),
  ],
}
