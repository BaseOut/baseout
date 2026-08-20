import { describe, expect, it } from 'vitest';
import {
  deriveSnapshotBases,
  isoDateOnly,
  toHistoryStatus,
  toRestoreOutcome,
  toSnapshotStatus,
} from './ssr-map';

describe('toSnapshotStatus', () => {
  it('maps the restorable backup statuses to succeeded', () => {
    expect(toSnapshotStatus('succeeded')).toBe('succeeded');
    expect(toSnapshotStatus('trial_succeeded')).toBe('succeeded');
    expect(toSnapshotStatus('trial_complete')).toBe('succeeded');
  });
  it('maps the failure/partial/cancel vocab', () => {
    expect(toSnapshotStatus('trial_truncated')).toBe('partial');
    expect(toSnapshotStatus('failed')).toBe('failed');
    expect(toSnapshotStatus('cancelled')).toBe('cancelled');
    expect(toSnapshotStatus('cancelling')).toBe('cancelled');
  });
});

describe('toHistoryStatus', () => {
  it('maps restore_runs statuses to statusMeta keys', () => {
    expect(toHistoryStatus('succeeded')).toBe('succeeded');
    expect(toHistoryStatus('running')).toBe('running');
    expect(toHistoryStatus('queued')).toBe('queued');
    expect(toHistoryStatus('failed')).toBe('failed');
    expect(toHistoryStatus('cancelling')).toBe('cancelled');
    expect(toHistoryStatus('weird')).toBe('cancelled');
  });
});

describe('toRestoreOutcome', () => {
  it('derives complete/running from status alone', () => {
    expect(toRestoreOutcome('succeeded', 0)).toBe('complete');
    expect(toRestoreOutcome('running', 0)).toBe('running');
    expect(toRestoreOutcome('queued', 0)).toBe('running');
  });
  it('uses records written to split partial vs none on a stop', () => {
    expect(toRestoreOutcome('failed', 120)).toBe('partial');
    expect(toRestoreOutcome('failed', 0)).toBe('none');
    expect(toRestoreOutcome('cancelled', 0)).toBe('none');
  });
});

describe('deriveSnapshotBases', () => {
  it('falls back to all in-scope bases when there is no per-base breakdown', () => {
    const out = deriveSnapshotBases([], ['b-crm', 'b-mkt']);
    expect(out.baseIds).toEqual(['b-crm', 'b-mkt']);
    expect(out.missedBaseNames).toEqual([]);
  });

  it('splits captured base ids from missed base names', () => {
    const out = deriveSnapshotBases(
      [
        { atBaseId: 'appCRM', baseName: 'Sales CRM', status: 'succeeded' },
        { atBaseId: 'appMKT', baseName: 'Marketing', status: 'failed' },
        { atBaseId: 'appOPS', baseName: 'Ops', status: 'trial_complete' },
      ],
      ['appCRM', 'appMKT', 'appOPS'],
    );
    expect(out.baseIds).toEqual(['appCRM', 'appOPS']);
    expect(out.missedBaseNames).toEqual(['Marketing']);
  });
});

describe('isoDateOnly', () => {
  it('returns the YYYY-MM-DD component', () => {
    expect(isoDateOnly(new Date('2026-06-15T09:12:00Z'))).toBe('2026-06-15');
    expect(isoDateOnly('2026-06-15T23:00:00Z')).toBe('2026-06-15');
  });
  it('returns empty for null/invalid', () => {
    expect(isoDateOnly(null)).toBe('');
    expect(isoDateOnly('not-a-date')).toBe('');
  });
});
