import { describe, expect, it } from 'vitest';
import {
  attachmentsLine,
  baseCoverage,
  describeRestoreRequest,
  droppedBasesNote,
  nameList,
  newBaseName,
  restoreRunLine,
  snapshotSizeLine,
  snapshotWarning,
  tableCountLabel,
  type RestoreRequest,
  type RestoreRunMeta,
  type RestoreSnapshot,
} from './request';

function snap(over: Partial<RestoreSnapshot> = {}): RestoreSnapshot {
  return {
    runId: 'run-1',
    takenAtLabel: 'Jun 15, 9:12 AM',
    takenOn: '2026-06-15',
    status: 'succeeded',
    tables: 4,
    records: 12_407,
    attachments: 218,
    baseIds: ['b-crm'],
    missedBaseNames: [],
    ...over,
  };
}

describe('baseCoverage', () => {
  it('is restorable when a snapshot holds the base (newest first)', () => {
    const snaps = [
      snap({ runId: 'r2', takenAtLabel: 'Jun 16', baseIds: ['b-crm'] }),
      snap({ runId: 'r1', takenAtLabel: 'Jun 15', baseIds: ['b-crm'] }),
    ];
    const cov = baseCoverage('b-crm', 'Sales CRM', snaps);
    expect(cov.kind).toBe('restorable');
    expect(cov.newest?.runId).toBe('r2');
    expect(cov.snapshots).toHaveLength(2);
    expect(cov.missedBy).toBeNull();
    expect(cov.line).toContain('2 backups');
    expect(cov.line).toContain('Jun 16');
  });

  it('is not-backed-up when no snapshot holds the base', () => {
    const cov = baseCoverage('b-new', 'Brand New', [snap({ baseIds: ['b-crm'] })]);
    expect(cov.kind).toBe('not-backed-up');
    expect(cov.newest).toBeNull();
    expect(cov.snapshots).toEqual([]);
    expect(cov.line.toLowerCase()).toContain('no backup');
  });

  it('is last-attempt-failed when a NEWER run was asked for the base and missed it', () => {
    // newest-first: r3 missed b-crm, r2 captured it.
    const snaps = [
      snap({ runId: 'r3', takenAtLabel: 'Jun 17', baseIds: ['b-other'], missedBaseNames: ['Sales CRM'] }),
      snap({ runId: 'r2', takenAtLabel: 'Jun 16', baseIds: ['b-crm'] }),
    ];
    const cov = baseCoverage('b-crm', 'Sales CRM', snaps);
    expect(cov.kind).toBe('last-attempt-failed');
    expect(cov.newest?.runId).toBe('r2');
    expect(cov.missedBy?.runId).toBe('r3');
    expect(cov.line).toContain('never reached it');
  });
});

describe('snapshotWarning', () => {
  it('is null for a clean snapshot', () => {
    expect(snapshotWarning({ status: 'succeeded', missedBaseNames: [] }, ['Sales CRM'])).toBeNull();
  });
  it('names what a failed snapshot captured and missed', () => {
    const w = snapshotWarning({ status: 'failed', missedBaseNames: ['Marketing'] }, ['Sales CRM']);
    expect(w).toContain('failed part-way');
    expect(w).toContain('It captured Sales CRM.');
    expect(w).toContain('Marketing');
  });
});

describe('attachmentsLine', () => {
  it('reports no attachments when the count is zero', () => {
    expect(
      attachmentsLine({ attachments: 0, attachmentsMode: 'attachments', destinationLabel: 'Drive' }),
    ).toBe('No attachments in the selected tables.');
  });
  it('describes re-upload when mode is attachments', () => {
    expect(
      attachmentsLine({ attachments: 3, attachmentsMode: 'attachments', destinationLabel: 'Drive' }),
    ).toContain('re-uploaded');
  });
  it('drops the destination clause when the destination stores no files', () => {
    const line = attachmentsLine({
      attachments: 3,
      attachmentsMode: 'links',
      destinationLabel: 'Drive',
      destinationStoresFiles: false,
    });
    expect(line).toContain('records only');
    expect(line).not.toContain('Drive');
  });
  it('names the destination for the links mode when it stores files', () => {
    const line = attachmentsLine({
      attachments: 3,
      attachmentsMode: 'links',
      destinationLabel: 'Company Drive',
      destinationStoresFiles: true,
    });
    expect(line).toContain('Company Drive');
  });
});

describe('describeRestoreRequest', () => {
  const base: RestoreRequest = {
    snapshot: snap(),
    baseName: 'Sales CRM',
    tableNames: ['Accounts', 'Contacts'],
    records: 500,
    attachments: 0,
    attachmentsMode: 'attachments',
    destinationLabel: 'Company Drive',
    target: { kind: 'new', name: 'Restored — Sales CRM — 2026-06-15' },
    workspaceName: 'Marketing',
  };

  it('states the new-base target with the chosen workspace', () => {
    const copy = describeRestoreRequest(base);
    expect(copy.where).toContain('new base');
    expect(copy.where).toContain('Marketing');
    expect(copy.what).toContain('2 tables');
    expect(copy.headline).toContain('Restored — Sales CRM');
    expect(copy.line).toContain('(new base)');
  });

  it('drops the workspace clause when none is known', () => {
    const copy = describeRestoreRequest({ ...base, workspaceName: null });
    expect(copy.where).not.toContain('workspace');
  });

  it('describes an existing-base target without a workspace clause', () => {
    const copy = describeRestoreRequest({
      ...base,
      target: { kind: 'existing', name: 'Prod Base' },
    });
    expect(copy.where).toContain('existing base');
    expect(copy.existing).toContain('Restore never writes into an existing table');
    expect(copy.line).not.toContain('(new base)');
  });

  it('surfaces a snapshot warning when the source is not clean', () => {
    const copy = describeRestoreRequest(
      { ...base, snapshot: snap({ status: 'failed', missedBaseNames: ['Marketing'] }) },
      ['Sales CRM'],
    );
    expect(copy.snapshotWarning).not.toBeNull();
    expect(copy.snapshotWarning).toContain('Marketing');
  });
});

describe('restoreRunLine', () => {
  function meta(over: Partial<RestoreRunMeta> = {}): RestoreRunMeta {
    return {
      sourceRunId: 'run-src',
      baseName: 'Sales CRM',
      tableCount: 4,
      targetName: 'Restored — Sales CRM',
      targetIsNew: true,
      outcome: 'complete',
      manualFixups: 0,
      detailHref: '/restore?done=r1',
      ...over,
    };
  }

  it('prints the fixup clause only for settled outcomes', () => {
    expect(restoreRunLine(meta({ outcome: 'complete', manualFixups: 2 }))).toContain('2 items to finish by hand');
    expect(restoreRunLine(meta({ outcome: 'complete', manualFixups: 0 }))).toContain('nothing left to finish by hand');
    // running / none do NOT carry a fixup clause (a count of remaining work is meaningless there).
    expect(restoreRunLine(meta({ outcome: 'running', manualFixups: 0 }))).not.toContain('finish by hand');
    expect(restoreRunLine(meta({ outcome: 'none', manualFixups: 0 }))).not.toContain('finish by hand');
  });

  it('uses the outcome verb and appends a reason when present', () => {
    const line = restoreRunLine(meta({ outcome: 'none', reason: 'no write permission' }));
    expect(line.startsWith('Restored nothing from')).toBe(true);
    expect(line).toContain('· no write permission');
  });
});

describe('small formatters', () => {
  it('tableCountLabel pluralises', () => {
    expect(tableCountLabel(1)).toBe('1 table');
    expect(tableCountLabel(4)).toBe('4 tables');
  });
  it('newBaseName joins base + snapshot date', () => {
    expect(newBaseName('Sales CRM', { takenOn: '2026-06-15' })).toBe('Restored — Sales CRM — 2026-06-15');
  });
  it('nameList names up to max then counts the rest', () => {
    expect(nameList([])).toBe('nothing');
    expect(nameList(['A'])).toBe('A');
    expect(nameList(['A', 'B'])).toBe('A and B');
    expect(nameList(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C, D, E and 1 more');
  });
  it('droppedBasesNote hides at zero and pluralises', () => {
    expect(droppedBasesNote(0)).toBeNull();
    expect(droppedBasesNote(1)).toContain('1 base');
    expect(droppedBasesNote(3)).toContain('3 bases');
  });
  it('snapshotSizeLine joins the three counts', () => {
    expect(snapshotSizeLine({ tables: 4, records: 12_407, attachments: 218 })).toBe(
      '4 tables · 12,407 records · 218 attachments',
    );
  });
});
