import { edge, group, note, svc, type Diagram } from '../types'

/**
 * Snapshot destinations, drawn from the factory rather than from the docs:
 * apps/workflows/trigger/tasks/_lib/storage-writers/index.ts.
 *
 * The two things this tab exists to make un-missable:
 *   1. `storage_type` accepts EIGHT values but only five have a writer. The
 *      other three fall through to local disk *silently*.
 *   2. R2 is reached two completely different ways — S3 API creds from the
 *      Trigger.dev runner (snapshots) and a native binding from `server`
 *      (report documents). Confusing them is how R2 creds end up in a
 *      .dev.vars where they can never be used.
 */
export const storage: Diagram = {
  id: 'storage',
  label: 'Snapshot storage',
  blurb:
    'Snapshots are written ONLY by the Trigger.dev runner, never by a Worker. Five of the eight accepted storage_type values have a real writer; the rest degrade to local disk without failing the run.',
  nodes: [
    // ── producer ─────────────────────────────────────────────────────────────
    group('g-prod', 0, 40, 250, 330, {
      label: 'Producer — the only writer',
      tone: 'staging',
    }),
    svc('runner', 24, 100, {
      label: 'Trigger.dev Node runner',
      sub: 'backup-base · restore-base',
      status: 'external',
    }),
    svc('factory', 24, 195, {
      label: 'resolveStorageWriter()',
      sub: 'dispatches on storage_type',
      status: 'infra',
    }),
    svc('creds', 24, 290, {
      label: 'storage_destinations',
      sub: 'oauth_*_enc · AES-256-GCM · per Space',
      status: 'infra',
    }),

    // ── managed ──────────────────────────────────────────────────────────────
    group('g-managed', 340, 40, 290, 150, {
      label: 'Managed (default)',
      tone: 'neutral',
    }),
    svc('r2', 364, 95, {
      label: 'Cloudflare R2',
      sub: "storage_type 'r2_managed' — the default",
      tag: 'S3 API',
    }),

    // ── BYOS via OAuth ───────────────────────────────────────────────────────
    group('g-byos', 340, 215, 290, 400, {
      label: 'BYOS — per-Space customer OAuth',
      tone: 'neutral',
    }),
    svc('gdrive', 364, 270, {
      label: 'Google Drive',
      sub: "'google_drive'",
      status: 'live',
      tag: 'OAuth',
    }),
    svc('box', 364, 355, { label: 'Box', sub: "'box'", status: 'live', tag: 'OAuth' }),
    svc('dropbox', 364, 440, {
      label: 'Dropbox',
      sub: "'dropbox'",
      status: 'live',
      tag: 'OAuth',
    }),
    svc('onedrive', 364, 525, {
      label: 'OneDrive',
      sub: "'onedrive'",
      status: 'live',
      tag: 'OAuth',
    }),

    // ── accepted but unimplemented ───────────────────────────────────────────
    group('g-todo', 700, 215, 290, 320, {
      label: 'Accepted by the column, NO writer',
      sub: 'falls through to local disk',
      tone: 'danger',
    }),
    svc('s3', 724, 270, {
      label: 'Amazon S3',
      sub: "'s3' — routes to LocalFsWriter",
      status: 'proposed',
      tag: '⚠',
    }),
    svc('frameio', 724, 355, {
      label: 'Frame.io',
      sub: "'frame_io' — routes to LocalFsWriter",
      status: 'proposed',
      tag: '⚠',
    }),
    svc('byos', 724, 440, {
      label: 'generic BYOS',
      sub: "'byos' — routes to LocalFsWriter",
      status: 'proposed',
      tag: '⚠',
    }),

    // ── dev ──────────────────────────────────────────────────────────────────
    svc('localfs', 724, 95, {
      label: 'Local filesystem',
      sub: "'local_fs' — dev + every fallback",
      status: 'infra',
    }),

    // ── the OTHER R2 path ────────────────────────────────────────────────────
    group('g-reports', 0, 470, 250, 250, {
      label: 'Different R2 path entirely',
      tone: 'production',
    }),
    svc('server', 24, 525, {
      label: 'server Worker',
      sub: 'BACKUPS_R2 native binding',
    }),
    svc('reportdoc', 24, 620, {
      label: 'report documents',
      sub: 'putDocument / getDocument',
    }),

    note(
      'n-fallback',
      700,
      560,
      'Missing creds is DELIBERATE graceful degradation, not an error: the run succeeds and writes to local disk. Good for dev iteration — and the reason a misconfigured customer destination can look like a healthy backup that went nowhere they can reach.',
      290,
    ),
    note(
      'n-creds',
      0,
      760,
      'R2 creds (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET) live ONLY on the Trigger.dev runner, from process.env. They must never appear in any .dev.vars — Workers never reach R2 for snapshot writes, so a key there is a false signal that can never fire. Canonical location + rotation: shared/internal/r2-setup.md.',
      380,
    ),
    note(
      'n-two',
      420,
      760,
      'R2 twice, two credential models: the runner uses S3 API keys for SNAPSHOTS; `server` uses a credential-less native binding for REPORT documents (it both puts and gets). Same bucket, unrelated paths.',
      290,
    ),
    note(
      'n-check',
      700,
      95,
      'Note the mismatch: backup_configurations.storage_type accepts 8 values, but the storage_destinations.type CHECK constraint still only allows local_fs + google_drive.',
      290,
    ),
  ],
  edges: [
    edge('st1', 'runner', 'factory', { from: 'sb', to: 'tt' }),
    edge('st2', 'creds', 'factory', { from: 'st', to: 'tb', label: 'decrypted' }),

    edge('st3', 'factory', 'r2', { kind: 'thick', label: 'default' }),
    edge('st4', 'factory', 'gdrive'),
    edge('st5', 'factory', 'box'),
    edge('st6', 'factory', 'dropbox'),
    edge('st7', 'factory', 'onedrive'),

    edge('st8', 's3', 'localfs', { kind: 'dashed', from: 'st', to: 'tb' }),
    edge('st9', 'frameio', 'localfs', { kind: 'dashed', from: 'st', to: 'tb' }),
    edge('st10', 'byos', 'localfs', { kind: 'dashed', from: 'st', to: 'tb' }),
    edge('st11', 'factory', 's3', { kind: 'dashed', label: 'accepted…' }),

    edge('st12', 'server', 'reportdoc', { from: 'sb', to: 'tt' }),
    edge('st13', 'reportdoc', 'r2', { from: 'sr', to: 'tb', kind: 'dashed', label: 'same bucket' }),
  ],
}
