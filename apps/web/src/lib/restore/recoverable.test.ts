import { describe, expect, it } from 'vitest';
import { deriveRecoverable, summariseRecoverable } from './recoverable';
import type { RestoreSnapshot } from './request';

function snap(over: Partial<RestoreSnapshot> = {}): RestoreSnapshot {
  return {
    runId: 'r',
    takenAtLabel: 'Jun 15, 9:12 AM',
    takenOn: '2026-06-15',
    status: 'succeeded',
    tables: 1,
    records: 1,
    attachments: 0,
    baseIds: [],
    missedBaseNames: [],
    ...over,
  };
}

const bases = [
  { id: 'b-crm', name: 'Sales CRM' },
  { id: 'b-mkt', name: 'Marketing' },
  { id: 'b-new', name: 'Brand New' },
];

describe('deriveRecoverable', () => {
  // caller passes newest-first (takenOn descending).
  const snapshots = [
    snap({ runId: 'r3', takenOn: '2026-06-17', baseIds: ['b-crm'], missedBaseNames: ['Marketing'] }),
    snap({ runId: 'r2', takenOn: '2026-06-16', baseIds: ['b-crm', 'b-mkt'] }),
    snap({ runId: 'r1', takenOn: '2026-06-15', baseIds: ['b-crm'] }),
  ];

  it('marks a base restorable from the newest snapshot that captured it', () => {
    const rows = deriveRecoverable(bases, snapshots);
    const crm = rows.find((r) => r.id === 'b-crm')!;
    expect(crm.state).toBe('restorable');
    expect(crm.from?.runId).toBe('r3');
    expect(crm.failedAttempt).toBeNull();
    expect(crm.line).toContain('Restorable from');
  });

  it('marks a base stale when a NEWER run was asked for it and missed', () => {
    const rows = deriveRecoverable(bases, snapshots);
    const mkt = rows.find((r) => r.id === 'b-mkt')!;
    expect(mkt.state).toBe('stale');
    expect(mkt.from?.runId).toBe('r2');
    expect(mkt.failedAttempt?.runId).toBe('r3');
    expect(mkt.line).toContain('Last attempt failed');
  });

  it('marks a base none when no snapshot ever captured it', () => {
    const rows = deriveRecoverable(bases, snapshots);
    const brandNew = rows.find((r) => r.id === 'b-new')!;
    expect(brandNew.state).toBe('none');
    expect(brandNew.from).toBeNull();
    expect(brandNew.line.toLowerCase()).toContain('no backup');
  });
});

describe('summariseRecoverable', () => {
  it('reports all restorable', () => {
    const rows = deriveRecoverable([{ id: 'b-crm', name: 'Sales CRM' }], [snap({ baseIds: ['b-crm'] })]);
    const s = summariseRecoverable(rows);
    expect(s.total).toBe(1);
    expect(s.needsAttention).toBe(0);
    expect(s.headline).toBe('All 1 base is restorable');
  });

  it('counts bases needing attention', () => {
    const rows = deriveRecoverable(bases, [snap({ baseIds: ['b-crm'] })]);
    const s = summariseRecoverable(rows);
    expect(s.total).toBe(3);
    expect(s.needsAttention).toBe(2); // b-mkt + b-new never captured
    expect(s.headline).toContain('2 of 3');
  });

  it('reports the empty case', () => {
    expect(summariseRecoverable([]).headline).toContain('No bases are being backed up');
  });
});
