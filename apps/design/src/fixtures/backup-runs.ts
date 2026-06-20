import type { BackupRunSummary } from '@web/lib/backup-runs/types';

const CONNECTION = {
  id: 'conn_design_airtable',
  displayName: 'Demo Airtable Workspace',
};

const CONFIGURATION = {
  storageType: 'byos_google_drive',
  mode: 'all_bases',
};

const INCLUDED_BASES = [
  { id: 'base_design_marketing', name: 'Marketing Calendar' },
  { id: 'base_design_ops', name: 'Operations Pipeline' },
];

function isoMinutesAgo(min: number): string {
  return new Date(
    new Date('2026-06-04T09:00:00.000Z').getTime() - min * 60 * 1000,
  ).toISOString();
}

function isoHoursAgo(h: number): string {
  return isoMinutesAgo(h * 60);
}

function isoDaysAgo(d: number): string {
  return isoMinutesAgo(d * 24 * 60);
}

const BASE_RUNS: BackupRunSummary[] = [
  {
    id: 'run_design_queued',
    status: 'queued',
    isTrial: false,
    triggeredBy: 'user_manual',
    recordCount: null,
    tableCount: null,
    attachmentCount: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    triggerRunIds: null,
    createdAt: isoMinutesAgo(1),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_running',
    status: 'running',
    isTrial: false,
    triggeredBy: 'schedule_daily',
    recordCount: 4_812,
    tableCount: 6,
    attachmentCount: 124,
    startedAt: isoMinutesAgo(8),
    completedAt: null,
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_001'],
    createdAt: isoMinutesAgo(10),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_completed_1',
    status: 'succeeded',
    isTrial: false,
    triggeredBy: 'schedule_daily',
    recordCount: 12_407,
    tableCount: 14,
    attachmentCount: 218,
    startedAt: isoHoursAgo(24),
    completedAt: isoMinutesAgo(24 * 60 - 7),
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_002'],
    createdAt: isoHoursAgo(24),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_completed_2',
    status: 'succeeded',
    isTrial: false,
    triggeredBy: 'schedule_daily',
    recordCount: 12_402,
    tableCount: 14,
    attachmentCount: 217,
    startedAt: isoHoursAgo(48),
    completedAt: isoMinutesAgo(48 * 60 - 9),
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_003'],
    createdAt: isoHoursAgo(48),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_completed_3',
    status: 'succeeded',
    isTrial: false,
    triggeredBy: 'user_manual',
    recordCount: 12_389,
    tableCount: 14,
    attachmentCount: 215,
    startedAt: isoHoursAgo(72),
    completedAt: isoMinutesAgo(72 * 60 - 11),
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_004'],
    createdAt: isoHoursAgo(72),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_completed_trial',
    status: 'trial_succeeded',
    isTrial: true,
    triggeredBy: 'onboarding_trial',
    recordCount: 8_141,
    tableCount: 10,
    attachmentCount: 84,
    startedAt: isoDaysAgo(5),
    completedAt: isoMinutesAgo(5 * 24 * 60 - 4),
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_005'],
    createdAt: isoDaysAgo(5),
    connection: CONNECTION,
    configuration: { storageType: 'r2_managed', mode: 'trial' },
    includedBases: INCLUDED_BASES.slice(0, 1),
  },
  {
    id: 'run_design_failed',
    status: 'failed',
    isTrial: false,
    triggeredBy: 'schedule_daily',
    recordCount: 0,
    tableCount: 0,
    attachmentCount: 0,
    startedAt: isoDaysAgo(3),
    completedAt: isoMinutesAgo(3 * 24 * 60 - 2),
    errorMessage:
      'Airtable returned 429 (rate-limited) for `appMarketing00001`. Retried 3× with exponential backoff. Will retry on the next scheduled tick.',
    triggerRunIds: ['run_trigger_design_006'],
    createdAt: isoDaysAgo(3),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
  {
    id: 'run_design_cancelled',
    status: 'cancelled',
    isTrial: false,
    triggeredBy: 'user_manual',
    recordCount: 2_104,
    tableCount: 4,
    attachmentCount: 32,
    startedAt: isoDaysAgo(6),
    completedAt: isoMinutesAgo(6 * 24 * 60 - 5),
    errorMessage: null,
    triggerRunIds: ['run_trigger_design_007'],
    createdAt: isoDaysAgo(6),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  },
];

// Generated run history so the Backups list has enough rows to demo search /
// status·trigger·date filtering / pagination. Deterministic (index-driven, no
// Date.now/Math.random) — dates are anchored to the same fixed base and the
// harness re-anchors them to "now" on render.
const FAIL_REASONS = [
  'Airtable returned 429 (rate-limited) for `appMarketing00001`. Retried 3x with exponential backoff.',
  'OAuth token for the destination expired mid-run. Reconnect the destination to resume.',
  'Network timeout reading `appSalesCRM00001` after 30s. The base may have been temporarily unavailable.',
  'Destination storage quota exceeded while writing attachments. Free space or upgrade the plan.',
];

const HISTORY_RUNS: BackupRunSummary[] = Array.from({ length: 42 }, (_, i) => {
  const dayAgo = 7 + i * 2; // spans ~7-89 days back, continuing after the hand-written runs
  const startMin = dayAgo * 24 * 60;
  const durMin = 6 + (i % 4); // 6-9 min
  const isFailed = i % 11 === 5;
  const isCancelled = !isFailed && i % 19 === 3;
  const isManual = !isFailed && !isCancelled && i % 6 === 2;
  const status = isFailed ? 'failed' : isCancelled ? 'cancelled' : 'succeeded';
  const ok = status === 'succeeded';
  const records = ok ? 11_900 + ((i * 137) % 900) : isCancelled ? 1_500 + ((i * 53) % 1500) : 0;
  const attachments = ok ? 180 + ((i * 7) % 60) : isCancelled ? 20 + (i % 40) : 0;
  const seq = String(i + 1).padStart(3, '0');
  return {
    id: `run_design_h${seq}`,
    status,
    isTrial: false,
    triggeredBy: isManual ? 'user_manual' : 'schedule_daily',
    recordCount: records,
    tableCount: ok ? 14 : isCancelled ? 4 : 0,
    attachmentCount: attachments,
    startedAt: isoMinutesAgo(startMin),
    completedAt: isoMinutesAgo(startMin - durMin),
    errorMessage: isFailed ? FAIL_REASONS[i % FAIL_REASONS.length] : null,
    triggerRunIds: [`run_trigger_design_h${seq}`],
    createdAt: isoMinutesAgo(startMin),
    connection: CONNECTION,
    configuration: CONFIGURATION,
    includedBases: INCLUDED_BASES,
  };
});

export const FIXTURE_BACKUP_RUNS: BackupRunSummary[] = [...BASE_RUNS, ...HISTORY_RUNS];

export const FIXTURE_BACKUP_RUNS_EMPTY: BackupRunSummary[] = [];

export const FIXTURE_BACKUP_RUNS_FAILED: BackupRunSummary[] = [
  FIXTURE_BACKUP_RUNS.find((r) => r.id === 'run_design_failed')!,
];
