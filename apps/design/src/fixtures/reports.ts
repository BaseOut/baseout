/**
 * Reports fixtures — fake data for the Reports page, typed against the REAL apps/web report
 * interfaces (so a type change there surfaces here as a compile error). No backend: the engineer
 * wires GET /spaces/:id/reports + the report document.
 *
 * The Schema-health rows reference REAL schema-lab entity ids (f-dl-stage, b-deals, f-co-pipeline) so
 * that clicking one opens the shared EntityPanel the harness mounts — proving UX parity.
 *
 * Variants: `reportList` (mixed history, incl. running + failed-generation + a delivery failure),
 * `reportDetails` (a rich report with issues across all four sections, and a healthy report that is
 * still fully populated — every section shows its table, all green).
 */
import type {
  ReportSummary, ReportDetail, Delta, ReportSchedule, ReportDefinition, EmbeddedSchedule,
} from '@web/lib/reports/types';

// Space members for the recipient autocomplete.
export const reportMembers = [
  { email: 'reese@acme.co', name: 'Reese D.' },
  { email: 'sam@acme.co', name: 'Sam K.' },
  { email: 'jordan@acme.co', name: 'Jordan P.' },
];

// Report-delivery schedules (multiple per Space, different audiences).
export const reportSchedules: ReportSchedule[] = [
  {
    id: 'sch-weekly', name: 'Weekly client report', cadence: 'weekly', day: 1, time: '09:00',
    recipients: [
      { kind: 'member', email: 'reese@acme.co', name: 'Reese D.' },
      { kind: 'external', email: 'client@bigco.com' },
      { kind: 'external', email: 'pm@bigco.com' },
    ],
    formats: ['pdf'], suppressEmpty: false, enabled: true,
    // A bounced delivery — the failure surfaces on the schedule row (design.md § List + schedules).
    lastDelivery: { lastSentAt: '2026-07-13T06:00:00', sent: 3, delivered: 2, failures: [{ email: 'pm@bigco.com', reason: 'Address rejected (hard bounce)' }] },
  },
  {
    id: 'sch-onbackup', name: 'Ops alert (after every backup)', cadence: 'after_backup',
    recipients: [{ kind: 'member', email: 'sam@acme.co', name: 'Sam K.' }],
    formats: ['html'], suppressEmpty: true, enabled: true,
    lastDelivery: { lastSentAt: '2026-07-13T02:10:00', sent: 1, delivered: 1 },
  },
  {
    id: 'sch-monthly', name: 'Monthly exec summary', cadence: 'monthly', day: 1, time: '08:00',
    recipients: [{ kind: 'external', email: 'exec@acme.co' }],
    formats: ['pdf', 'html'], suppressEmpty: false, enabled: false,
    lastDelivery: null,
  },
];

const up = (text: string, goodWhenUp = true): Delta => ({ dir: 'up', goodWhenUp, text });
const down = (text: string, goodWhenUp = true): Delta => ({ dir: 'down', goodWhenUp, text });
const flat = (): Delta => ({ dir: 'flat', text: '±0' });

// ── List ────────────────────────────────────────────────────────────────────────────────────
export const reportList: ReportSummary[] = [
  {
    id: 'r-2026-07-13', windowStart: '2026-07-06T00:00:00', windowEnd: '2026-07-13T00:00:00',
    generatedAt: '2026-07-13T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'issues', backupsOk: 13, backupsFailed: 1,
    delivery: { lastSentAt: '2026-07-13T06:00:00', sent: 5, delivered: 4, failures: [{ email: 'ops@acme.co', reason: 'Mailbox full (soft bounce)' }] },
  },
  {
    id: 'r-2026-06-29', windowStart: '2026-06-29T00:00:00', windowEnd: '2026-07-06T00:00:00',
    generatedAt: '2026-07-06T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'healthy', backupsOk: 14, backupsFailed: 0,
    delivery: { lastSentAt: '2026-07-06T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-adhoc-0701', windowStart: '2026-07-01T00:00:00', windowEnd: '2026-07-02T12:00:00', adHoc: true,
    generatedAt: '2026-07-02T12:02:00', generationState: 'generated', trigger: { kind: 'manual', by: 'Reese D.' },
    status: 'healthy', backupsOk: 2, backupsFailed: 0, delivery: null,
  },
  {
    id: 'r-2026-06-22', windowStart: '2026-06-22T00:00:00', windowEnd: '2026-06-29T00:00:00',
    generatedAt: '2026-06-29T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'issues', backupsOk: 12, backupsFailed: 2,
    delivery: { lastSentAt: '2026-06-29T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-gen-failed', windowStart: '2026-06-15T00:00:00', windowEnd: '2026-06-22T00:00:00',
    generatedAt: null, generationState: 'failed', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'failed', backupsOk: 0, backupsFailed: 0, delivery: null,
  },
  // Older weekly history — enough rows to exercise pagination.
  {
    id: 'r-2026-06-08', windowStart: '2026-06-08T00:00:00', windowEnd: '2026-06-15T00:00:00',
    generatedAt: '2026-06-15T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'healthy', backupsOk: 14, backupsFailed: 0, delivery: { lastSentAt: '2026-06-15T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-2026-06-01', windowStart: '2026-06-01T00:00:00', windowEnd: '2026-06-08T00:00:00',
    generatedAt: '2026-06-08T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'issues', backupsOk: 13, backupsFailed: 1, delivery: { lastSentAt: '2026-06-08T06:00:00', sent: 5, delivered: 4, failures: [{ email: 'ops@acme.co', reason: 'Mailbox full (soft bounce)' }] },
  },
  {
    id: 'r-2026-05-25', windowStart: '2026-05-25T00:00:00', windowEnd: '2026-06-01T00:00:00',
    generatedAt: '2026-06-01T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'healthy', backupsOk: 14, backupsFailed: 0, delivery: { lastSentAt: '2026-06-01T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-adhoc-0520', windowStart: '2026-05-20T00:00:00', windowEnd: '2026-05-21T09:00:00', adHoc: true,
    generatedAt: '2026-05-21T09:05:00', generationState: 'generated', trigger: { kind: 'manual', by: 'Sam K.' },
    status: 'healthy', backupsOk: 1, backupsFailed: 0, delivery: null,
  },
  {
    id: 'r-2026-05-18', windowStart: '2026-05-18T00:00:00', windowEnd: '2026-05-25T00:00:00',
    generatedAt: '2026-05-25T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'healthy', backupsOk: 14, backupsFailed: 0, delivery: { lastSentAt: '2026-05-25T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-2026-05-11', windowStart: '2026-05-11T00:00:00', windowEnd: '2026-05-18T00:00:00',
    generatedAt: '2026-05-18T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'issues', backupsOk: 11, backupsFailed: 3, delivery: { lastSentAt: '2026-05-18T06:00:00', sent: 5, delivered: 5 },
  },
  {
    id: 'r-2026-05-04', windowStart: '2026-05-04T00:00:00', windowEnd: '2026-05-11T00:00:00',
    generatedAt: '2026-05-11T06:00:00', generationState: 'generated', trigger: { kind: 'scheduled', by: 'Weekly client report', scheduleId: 'sch-weekly' },
    status: 'healthy', backupsOk: 14, backupsFailed: 0, delivery: { lastSentAt: '2026-05-11T06:00:00', sent: 5, delivered: 5 },
  },
];

// A single failed-generation report — the ?fixture=failed state.
export const reportListFailed: ReportSummary[] = [reportList[4], reportList[3]];

// ── Trends + Data health fixtures (client 2026-07-14) ─────────────────────────────────────────
// Weekly snapshots over the last ~11 backups; each metric splits across 3 bases. Engine stores these
// per backup in prod; here they're faked. Base ids are arbitrary keys (charts label by name).
const trendCats = ['May 4', 'May 11', 'May 18', 'May 25', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 29', 'Jul 6', 'Jul 13'];
const trendBases = [
  { baseId: 'b-sales', baseName: 'Sales CRM', share: 0.55 },
  { baseId: 'b-mktg', baseName: 'Marketing', share: 0.30 },
  { baseId: 'b-ops', baseName: 'Operations', share: 0.15 },
];
const splitSeries = (overall: number[]) =>
  trendBases.map((b) => ({ baseId: b.baseId, baseName: b.baseName, data: overall.map((v) => Math.round(v * b.share)) }));
const metric = (key: any, label: string, unit: 'count' | 'bytes', overall: number[], deltaText: string): any => ({
  key, label, unit, current: overall[overall.length - 1], delta: up(deltaText), categories: trendCats, overall, byBase: splitSeries(overall),
});
const richTrends = {
  metrics: [
    metric('records', 'Records', 'count', [38200, 39100, 40050, 41200, 41800, 42600, 43100, 43900, 44120, 44300, 44900], '+2.7k'),
    metric('tables', 'Tables', 'count', [11, 11, 12, 12, 12, 13, 13, 13, 13, 14, 14], '+3'),
    metric('fields', 'Fields', 'count', [104, 106, 108, 112, 116, 120, 122, 126, 128, 130, 132], '+28'),
    metric('attachments', 'Attachments', 'count', [820, 860, 910, 980, 1040, 1120, 1180, 1240, 1290, 1330, 1380], '+560'),
    metric('automations', 'Automations', 'count', [3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6], '+3'),
    metric('interfaces', 'Interfaces', 'count', [2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5], '+3'),
  ],
};
const richDataHealth = {
  records: {
    total: 44900,
    byBase: [
      { baseId: 'b-sales', baseName: 'Sales CRM', tableCount: 14, fieldCount: 186, recordCount: 24700, storage: '1.4 GB' },
      { baseId: 'b-mktg', baseName: 'Marketing', tableCount: 9, fieldCount: 112, recordCount: 13500, storage: '820 MB' },
      { baseId: 'b-ops', baseName: 'Operations', tableCount: 6, fieldCount: 74, recordCount: 6700, storage: '410 MB' },
    ],
  },
  attachments: {
    totalFiles: 1380, totalStorage: '3.2 GB',
    byBase: [
      { baseId: 'b-sales', baseName: 'Sales CRM', attachmentFieldCount: 8, fileCount: 780, storage: '1.9 GB' },
      { baseId: 'b-mktg', baseName: 'Marketing', attachmentFieldCount: 5, fileCount: 420, storage: '820 MB' },
      { baseId: 'b-ops', baseName: 'Operations', attachmentFieldCount: 3, fileCount: 180, storage: '480 MB' },
    ],
  },
};

// ── Details ─────────────────────────────────────────────────────────────────────────────────
const richReport: ReportDetail = {
  ...reportList[0],
  strip: [
    { label: 'Backups', icon: 'lucide--database-backup', value: '13 / 1', sub: 'ok / failed', delta: up('+1 failed', false) },
    { label: 'Connections', icon: 'lucide--plug-zap', value: 'Degraded', tone: 'warning', sub: '1 broke this period' },
    { label: 'Schema health', icon: 'lucide--heart-pulse', value: '82', tone: 'warning', sub: 'Amber · dropped from green', delta: down('-8 pts', false) },
    // X08-F7 — the ONLY `tone: 'neutral'` strip tile in the tree, and it exists so the fix is
    // reachable. Before this, `reports.ts` used `warning` / `success` / no tone only, so the branch
    // that painted an invisible 8px hole could not be rendered by the harness at all: the bug shipped
    // past every gate partly because nothing could show it. `neutral` is the right tone here on the
    // merits too — a count of documents touched carries neither alarm nor achievement. The `delta` is
    // kept declared but the toned branch has no slot for it (same as `Schema health` above).
    { label: 'Docs updated', icon: 'lucide--file-text', value: '3', tone: 'neutral', sub: 'created / updated', delta: up('+3') },
  ],
  backupSummary: {
    tone: 'warning', statusLabel: '1 issue',
    stats: [
      { label: 'Runs', value: '14', delta: up('+2') },
      { label: 'Failed', value: '1', delta: up('+1'), tone: 'error' },
      { label: 'Volume', value: '2.4 GB', delta: up('+180 MB') },
    ],
    rows: [
      { baseName: 'Sales CRM', outcome: 'ok', tables: 14, fields: 186, records: 128400, volume: '1.4 GB', runId: '8f2a1c', destinationUrl: 'https://drive.google.com/drive/folders/baseout-sales', destinationName: 'Google Drive' },
      { baseName: 'Marketing', outcome: 'ok', tables: 9, fields: 112, records: 44120, volume: '820 MB', runId: '8f2a1d', destinationUrl: 'https://drive.google.com/drive/folders/baseout-mktg', destinationName: 'Google Drive' },
      { baseName: 'Operations', outcome: 'failed', tables: null, fields: null, records: null, volume: null, error: 'Airtable rate limit exceeded' },
    ],
    emptyLine: 'Every backup succeeded this period.',
  },
  connectionHealth: {
    tone: 'warning', statusLabel: '1 issue',
    stats: [],
    rows: [
      // D07 — these were `src-airtable` / `dst-gdrive`, ids no registry fixture carries. The rows
      // still opened a detail page because `findSource`/`findDestination` fell back to the first
      // entry (PARKED P7 §3); with that fallback gone they would land on Not found, so they now
      // name the objects that exist. A report row is a "go see it" link like any other.
      { name: 'Airtable', kind: 'source', status: 'connected', connectionId: 'src-ops' },
      { name: 'Google Drive', kind: 'destination', status: 'broken', incident: 'Disconnected Jul 8 – Jul 9 (auth expired)', reconnect: true, connectionId: 'company-drive' },
    ],
    emptyLine: 'No connection issues this period.',
  },
  schemaHealth: {
    tone: 'warning', statusLabel: '3 changes',
    stats: [
      { label: 'Health score', value: '82', delta: down('-8', false) },
      { label: 'Changes', value: '3', delta: up('+3') },
    ],
    // Real schema-lab entity ids → clicking opens the SHARED EntityPanel.
    rows: [
      { entityId: 'f-dl-stage', entityName: 'Stage', location: 'Sales CRM ▸ Deals', change: 'Option added', tone: 'neutral' },
      { entityId: 'f-co-pipeline', entityName: 'Pipeline Value', location: 'Sales CRM ▸ Companies', change: 'Formula changed', tone: 'warning' },
      { entityId: 'b-deals', entityName: 'Deals', location: 'Sales CRM', change: 'Health dropped to amber', tone: 'error' },
    ],
    emptyLine: 'No schema changes this period.',
  },
  documentation: {
    tone: 'success', statusLabel: '3 updated',
    stats: [],
    rows: [
      { docId: 'doc-pipeline', title: 'Pipeline stages — how deals advance', action: 'updated', at: '2026-07-10T09:20:00', by: 'Reese D.' },
      { docId: 'doc-onboard', title: 'New base onboarding checklist', action: 'created', at: '2026-07-08T14:00:00', by: 'Sam K.' },
      { docId: 'doc-glossary', title: 'Field glossary', action: 'updated', at: '2026-07-07T11:30:00', by: 'Reese D.' },
    ],
    emptyLine: 'No documentation changes this period.',
  },
  trends: richTrends,
  dataHealth: richDataHealth,
};

// A healthy period, fully POPULATED — every section shows its table (all green), so the report reads
// as a real document rather than four "no issues" placeholders. (The affirmative empty-line grammar
// still lives in storybook `pattern-report`; an empty period can be re-added as its own fixture.)
const healthyReport: ReportDetail = {
  ...reportList[1],
  strip: [
    { label: 'Backups', icon: 'lucide--database-backup', value: '14 / 0', sub: 'ok / failed', delta: flat() },
    { label: 'Connections', icon: 'lucide--plug-zap', value: 'Healthy', tone: 'success', sub: 'all connected' },
    { label: 'Schema health', icon: 'lucide--heart-pulse', value: '90', tone: 'success', sub: 'Green · 2 minor changes', delta: flat() },
    { label: 'Docs updated', icon: 'lucide--file-text', value: '2', sub: 'created / updated', delta: up('+2') },
  ],
  backupSummary: {
    tone: 'success', statusLabel: 'Healthy',
    stats: [
      { label: 'Runs', value: '14', delta: flat() }, { label: 'Failed', value: '0', delta: flat() }, { label: 'Volume', value: '2.2 GB', delta: up('+40 MB') },
    ],
    rows: [
      { baseName: 'Sales CRM', outcome: 'ok', tables: 14, fields: 186, records: 128900, volume: '1.4 GB', runId: '7c1a90', destinationUrl: 'https://drive.google.com/drive/folders/baseout-sales', destinationName: 'Google Drive' },
      { baseName: 'Marketing', outcome: 'ok', tables: 9, fields: 112, records: 44300, volume: '820 MB', runId: '7c1a91', destinationUrl: 'https://drive.google.com/drive/folders/baseout-mktg', destinationName: 'Google Drive' },
      { baseName: 'Operations', outcome: 'ok', tables: 6, fields: 74, records: 20100, volume: '410 MB', runId: '7c1a92' },
      { baseName: 'Finance', outcome: 'ok', tables: 8, fields: 96, records: 9800, volume: '240 MB', runId: '7c1a93' },
      { baseName: 'Support', outcome: 'ok', tables: 5, fields: 61, records: 15600, volume: '300 MB', runId: '7c1a94' },
    ],
    emptyLine: 'Every backup succeeded this period.',
  },
  connectionHealth: {
    tone: 'success', statusLabel: 'Healthy',
    stats: [],
    rows: [
      { name: 'Airtable', kind: 'source', status: 'connected', connectionId: 'src-ops' },
      { name: 'Google Drive', kind: 'destination', status: 'connected', connectionId: 'company-drive' },
      { name: 'Amazon S3', kind: 'destination', status: 'connected', connectionId: 'dst-s3' },
    ],
    emptyLine: 'No connection issues this period.',
  },
  schemaHealth: {
    tone: 'success', statusLabel: '2 changes',
    stats: [
      { label: 'Health score', value: '90', delta: flat() }, { label: 'Changes', value: '2', delta: up('+2') },
    ],
    // Benign additive changes — real schema-lab ids so a row opens the shared EntityPanel (parity).
    rows: [
      { entityId: 'f-dl-stage', entityName: 'Stage', location: 'Sales CRM ▸ Deals', change: 'Option added', tone: 'neutral' },
      { entityId: 'b-deals', entityName: 'Deals', location: 'Sales CRM', change: 'Field added', tone: 'neutral' },
    ],
    emptyLine: 'No schema changes this period.',
  },
  documentation: {
    tone: 'success', statusLabel: '2 updated',
    stats: [],
    rows: [
      { docId: 'doc-pipeline', title: 'Pipeline stages — how deals advance', action: 'updated', at: '2026-07-04T10:15:00', by: 'Reese D.' },
      { docId: 'doc-glossary', title: 'Field glossary', action: 'updated', at: '2026-07-02T16:40:00', by: 'Sam K.' },
    ],
    emptyLine: 'No documentation changes this period.',
  },
  trends: richTrends,
  dataHealth: richDataHealth,
};

export const reportDetails: Record<string, ReportDetail> = {
  'r-2026-07-13': richReport,
  'r-2026-06-29': healthyReport,
  // The scoped "Schema Health on Sales CRM" report's runs resolve to a rendered doc too (so its Most
  // Recent tab + History rows open a real report, not a 404). Reuse the rich/healthy docs — same windows.
  // NOTE: these render all four sections; making a scoped report render ONLY its `sections` is a small
  // follow-up (pass def.sections into ReportBodyKpi).
  'sr-2026-07-13': richReport,
  'sr-2026-07-06': healthyReport,
  // The rolling-window, dataHealth-only report. Its body is scoped by the definition now, so the
  // shared document renders one section here and six on the full report — which is why the same
  // fixture can back both without either one lying about its scope.
  'ar-2026-07-28': richReport,
};

// ── Reports v2: named report DEFINITIONS (each = sections + scope + window + one embedded schedule +
// run history). The old flat `reportList` becomes the default report's run history. ─────────────────

const fullReportSchedule: EmbeddedSchedule = {
  // Default cadence = on each data backup (client's default). Event trigger, so no day/time.
  cadence: 'data_backup',
  recipients: [
    { kind: 'member', email: 'reese@acme.co', name: 'Reese D.' },
    { kind: 'external', email: 'client@bigco.com' },
  ],
  formats: ['pdf'], suppressEmpty: false, enabled: true,
  lastDelivery: { lastSentAt: '2026-07-13T06:00:00', sent: 2, delivered: 2 },
};

const schemaReportSchedule: EmbeddedSchedule = {
  cadence: 'weekly', day: 1, time: '09:00',
  recipients: [{ kind: 'member', email: 'sam@acme.co', name: 'Sam K.' }],
  formats: ['pdf', 'html'], suppressEmpty: true, enabled: true,
  lastDelivery: { lastSentAt: '2026-07-13T09:00:00', sent: 1, delivered: 1 },
};

// A scoped report's own short history (schema-only, one base).
/**
 * The ROLLING-WINDOW definition's one run (2026-08-11). `def-adhoc` had `runs: []`, so the
 * `rolling` branch of `windowLabel()` was unreachable through any page — and the run header had
 * been hard-coding "Since the last report." for every scheduled run, which is true of exactly one
 * of the three window kinds. A branch nothing renders is a branch nothing can be wrong about, and
 * that is not the same as being right.
 *
 * It is also the second SCOPE shape: one section that is not `schema`, on one base.
 */
const adhocRuns: ReportSummary[] = [
  {
    id: 'ar-2026-07-28', windowStart: '2026-06-28T00:00:00', windowEnd: '2026-07-28T00:00:00',
    generatedAt: '2026-07-28T09:00:00', generationState: 'generated',
    trigger: { kind: 'manual', by: 'Reese D.' },
    status: 'issues', backupsOk: 0, backupsFailed: 0,
    // `delivery: null`, not a row of zeros. This definition has `schedule: null` — nobody receives
    // it — so it was never sent, and the model already spells that `ReportDelivery | null`. Zeros
    // would claim a delivery attempt that reached no one; null says there was no delivery to report.
    delivery: null,
  },
];

const schemaRuns: ReportSummary[] = [
  {
    id: 'sr-2026-07-13', windowStart: '2026-07-06T00:00:00', windowEnd: '2026-07-13T00:00:00',
    generatedAt: '2026-07-13T09:00:00', generationState: 'generated',
    trigger: { kind: 'scheduled', by: 'Schema Health on Sales CRM' },
    status: 'issues', backupsOk: 0, backupsFailed: 0,
    delivery: { lastSentAt: '2026-07-13T09:00:00', sent: 1, delivered: 1 },
  },
  {
    id: 'sr-2026-07-06', windowStart: '2026-06-29T00:00:00', windowEnd: '2026-07-06T00:00:00',
    generatedAt: '2026-07-06T09:00:00', generationState: 'generated',
    trigger: { kind: 'scheduled', by: 'Schema Health on Sales CRM' },
    status: 'healthy', backupsOk: 0, backupsFailed: 0,
    delivery: { lastSentAt: '2026-07-06T09:00:00', sent: 1, delivered: 1 },
  },
];

export const reportDefinitions: ReportDefinition[] = [
  {
    id: 'def-full', name: 'Full Core CRM Report', isDefault: true,
    sections: ['backups', 'connections', 'schema', 'docs', 'trends', 'dataHealth'],
    baseScope: null, // all bases
    window: { kind: 'since_last' },
    schedule: fullReportSchedule,
    createdBy: 'Reese D.', createdAt: '2026-05-01T00:00:00',
    runs: reportList, // the existing history is this report's runs
  },
  {
    id: 'def-schema', name: 'Schema Health on Sales CRM',
    sections: ['schema'],
    baseScope: ['b-sales'], // scoped to one base
    window: { kind: 'since_last' },
    schedule: schemaReportSchedule,
    createdBy: 'Sam K.', createdAt: '2026-06-10T00:00:00',
    runs: schemaRuns,
  },
  /*
   * A SECOND DELETABLE report (audit D06 fix pass). The list carried exactly one — `def-full` is the
   * Space's auto-created default and offers no Delete — so the undo toast could never be SUPERSEDED
   * in the preview, and the bug where a superseded toast dropped its pending commit was unreachable
   * here while being trivially reachable in production, where a team accumulates reports.
   *
   * It is also the only unscheduled definition in the set, which is the other branch
   * `describeReportDeletion` has: with no schedule the dialog says "This report is not on a schedule,
   * so nobody stops receiving anything" instead of naming a delivery that stops. That branch had no
   * preview state either. Manual, never run — so it also exercises the "no saved runs yet" lead.
   */
  {
    id: 'def-adhoc', name: 'Attachment Audit',
    sections: ['dataHealth'],
    baseScope: ['b-sales'],
    window: { kind: 'rolling', days: 30 },
    schedule: null,
    createdBy: 'Reese D.', createdAt: '2026-07-28T00:00:00',
    runs: adhocRuns,
  },
];

/** Empty-state fixture: a Space with backups but no report definitions yet. */
export const reportDefinitionsEmpty: ReportDefinition[] = [];
