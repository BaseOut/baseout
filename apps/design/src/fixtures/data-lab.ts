/**
 * Fixtures for the Data page (/data) harness — typed against the real apps/web interfaces
 * (`@web/components/data/dataTypes`) so a reshape there surfaces here as a compile error.
 *
 * Phase 1 needs bases + tables (to make the page non-empty) with approximate record counts;
 * records + provenance land in later phases. The `?fixture=` query in data.astro selects a
 * scenario: default (dynamic), empty (no completed backup), big (multi-million-row table),
 * stale (old backup), static (files-only Space).
 */
import type { DataBase, DataTable, DataField, DataRecord, DataChangeEntry, DataComment, DataCommentAuthor, DataCommentMention, SavedView, ViewGroup } from '../components/data/dataTypes';
import type { SchemaDoc } from '../components/schema/schemaEntities';
import type { ChatThread } from '../components/schema/SchemaChat.astro';

const f = (id: string, name: string, type: string, extra: Partial<DataField> = {}): DataField => ({ id, name, type, ...extra });

// The same three bases the rest of the app uses (Schema / Reports): Sales CRM · Marketing · Operations.
export const dataBases: DataBase[] = [
  { id: 'baseCRM', name: 'Sales CRM' },
  { id: 'baseMkt', name: 'Marketing' },
  { id: 'baseOps', name: 'Operations' },
];

// A realistic small table (Contacts), a linked table (Orders), and a big table (Events) that
// exercises the virtualized grid + approximate-count header in later phases.
export const dataTables: DataTable[] = [
  {
    id: 'tblContacts',
    baseId: 'baseCRM',
    name: 'Contacts',
    approxRecordCount: 4820,
    fields: [
      f('fldName', 'Name', 'singleLineText'),
      f('fldEmail', 'Email', 'email'),
      f('fldStatus', 'Status', 'singleSelect'),
      f('fldOrders', 'Orders', 'multipleRecordLinks', { linkedTableId: 'tblOrders' }),
      f('fldLTV', 'Lifetime value', 'rollup', { expression: 'SUM(values)', viaFieldId: 'fldOrders', sourceTableId: 'tblOrders', sourceFieldId: 'fldAmount', aggregation: 'SUM of Amount' }),
      f('fldCreated', 'Created', 'dateTime'),
    ],
  },
  {
    id: 'tblOrders',
    baseId: 'baseCRM',
    name: 'Orders',
    approxRecordCount: 61240,
    fields: [
      f('fldOrderNo', 'Order #', 'singleLineText'),
      f('fldContact', 'Contact', 'multipleRecordLinks', { linkedTableId: 'tblContacts' }),
      f('fldAmount', 'Amount', 'currency'),
      f('fldPaid', 'Paid', 'checkbox'),
      f('fldContactEmail', 'Contact email', 'multipleLookupValues', { viaFieldId: 'fldContact', sourceTableId: 'tblContacts', sourceFieldId: 'fldEmail', expression: 'Contact → Email' }),
      f('fldTotal', 'Total (incl. tax)', 'formula', { expression: 'Amount * 1.2', refs: ['fldAmount'] }),
    ],
  },
  {
    id: 'tblEvents',
    baseId: 'baseOps',
    name: 'Events',
    approxRecordCount: 1240000,
    fields: [
      f('fldEvtType', 'Type', 'singleSelect'),
      f('fldEvtActor', 'Actor', 'singleLineText'),
      f('fldEvtAt', 'At', 'dateTime'),
      f('fldEvtMeta', 'Metadata', 'multilineText'),
    ],
  },
  // More tables so the Table picker is realistic (search + scroll scale to ~100 tables), with the
  // SAME base + table vocabulary as the rest of the app (Schema): Sales CRM · Marketing · Operations.
  // Records for these are generated below by field type.
  // Sales CRM
  { id: 'tblCompanies', baseId: 'baseCRM', name: 'Companies', approxRecordCount: 1280, fields: [f('cName', 'Name', 'singleLineText'), f('cIndustry', 'Industry', 'singleSelect'), f('cEmployees', 'Employees', 'number'), f('cSite', 'Website', 'url')] },
  { id: 'tblDeals', baseId: 'baseCRM', name: 'Deals', approxRecordCount: 3410, fields: [f('dName', 'Name', 'singleLineText'), f('dStage', 'Stage', 'singleSelect'), f('dAmount', 'Amount', 'currency'), f('dClose', 'Close date', 'date')] },
  { id: 'tblLeads', baseId: 'baseCRM', name: 'Leads', approxRecordCount: 5120, fields: [f('lName', 'Name', 'singleLineText'), f('lSource', 'Source', 'singleSelect'), f('lOwner', 'Owner', 'singleLineText'), f('lCreated', 'Created', 'date')] },
  { id: 'tblActivities', baseId: 'baseCRM', name: 'Activities', approxRecordCount: 24800, fields: [f('aSubject', 'Subject', 'singleLineText'), f('aType', 'Type', 'singleSelect'), f('aAt', 'Date', 'dateTime')] },
  // Marketing
  { id: 'tblCampaigns', baseId: 'baseMkt', name: 'Campaigns', approxRecordCount: 142, fields: [f('mName', 'Name', 'singleLineText'), f('mChannel', 'Channel', 'singleSelect'), f('mBudget', 'Budget', 'currency')] },
  { id: 'tblChannels', baseId: 'baseMkt', name: 'Channels', approxRecordCount: 24, fields: [f('hName', 'Name', 'singleLineText'), f('hChannel', 'Channel', 'singleSelect'), f('hSpend', 'Spend', 'currency')] },
  { id: 'tblEmailSends', baseId: 'baseMkt', name: 'Email Sends', approxRecordCount: 88400, fields: [f('eSubject', 'Subject', 'singleLineText'), f('eCampaign', 'Campaign', 'singleLineText'), f('eSent', 'Sent', 'dateTime'), f('eOpens', 'Opens', 'number')] },
  // Operations
  { id: 'tblTickets', baseId: 'baseOps', name: 'Tickets', approxRecordCount: 9870, fields: [f('tSubject', 'Subject', 'singleLineText'), f('tPriority', 'Priority', 'singleSelect'), f('tStatus', 'Status', 'singleSelect'), f('tOpened', 'Opened', 'dateTime')] },
  { id: 'tblAgents', baseId: 'baseOps', name: 'Agents', approxRecordCount: 64, fields: [f('gName', 'Name', 'singleLineText'), f('gTeam', 'Team', 'singleSelect'), f('gEmail', 'Email', 'email')] },
  { id: 'tblQueues', baseId: 'baseOps', name: 'Queues', approxRecordCount: 12, fields: [f('qName', 'Name', 'singleLineText'), f('qTeam', 'Team', 'singleSelect'), f('qOpen', 'Open tickets', 'number')] },
  // A genuinely empty table (0 records in this backup) — exercises the TRUE-empty state, distinct from
  // the filtered-empty "no match" copy (edge-case data-edge-empty-vs-filtered).
  { id: 'tblArchive', baseId: 'baseOps', name: 'Archive', approxRecordCount: 0, fields: [f('rName', 'Name', 'singleLineText'), f('rClosed', 'Closed', 'date'), f('rReason', 'Reason', 'singleSelect')] },
];

/** The big scenario promotes Events to the landing table (virtualization stress). */
export const dataTablesBig: DataTable[] = dataTables;

/** Static-only Space still has the same schema; browsing needs an import (Phase 6). */
export const dataBasesStatic = dataBases;
export const dataTablesStatic = dataTables;

export const lastSyncedAt = '2026-07-14T09:12:00';
export const lastSyncedStale = '2026-06-02T21:40:00';

// ── Records ─────────────────────────────────────────────────────────────────
// Deterministic sample rows (no RNG, so re-renders are stable). The grid pages
// through these in windows on a cursor; `approxRecordCount` above is the honest
// "~total" the header shows, far larger than the sample we ship for the mirror.
const cell = (raw: string, extra: Partial<DataRecord['cells'][string]> = {}) => ({ raw, ...extra });

const FIRST = ['Ada', 'Ben', 'Chidi', 'Dana', 'Efe', 'Farah', 'Gita', 'Hugo', 'Ivy', 'Jae', 'Kofi', 'Lena', 'Mira', 'Noah', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara'];
const LAST = ['Okoye', 'Larsson', 'Musa', 'Reyes', 'Adeyemi', 'Haddad', 'Rao', 'Berg', 'Chen', 'Park', 'Mensah', 'Fischer', 'Costa', 'Klein', 'Farooq', 'Nair', 'Doyle', 'Silva', 'Wu', 'Ito'];
const STATUS = ['Active', 'Trial', 'Churned'];

const contacts: DataRecord[] = Array.from({ length: 138 }, (_, i) => {
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  const status = STATUS[i % 3];
  // recC0 is the flagship: a big linked set (2,340 orders) to exercise provenance search + paging.
  const orders = i === 0 ? 2340 : (i * 13) % 40;
  const ltv = i === 0 ? 318420 : orders * ((i % 5) + 1) * 137;
  // Real linked order ids we ship a sample of (the panel synthesizes the rest up to the count).
  const linkedIds = Array.from({ length: Math.min(orders, 12) }, (_, k) => `recO${(i * 5 + k) % 164}`);
  return {
    id: `recC${i}`,
    tableId: 'tblContacts',
    primary: name,
    cells: {
      fldName: cell(name),
      fldEmail: cell(`${FIRST[i % FIRST.length].toLowerCase()}.${LAST[(i * 7) % LAST.length].toLowerCase()}@example.com`),
      fldStatus: cell(status),
      fldOrders: cell(orders === 0 ? '' : `${orders} linked`, { linkedCount: orders, empty: orders === 0 }),
      fldLTV: cell(`$${ltv.toLocaleString()}`),
      fldCreated: cell(`2026-0${(i % 6) + 1}-${String((i % 27) + 1).padStart(2, '0')}`),
    },
    linked: { fldOrders: linkedIds },
    // A rich cross-backup history on the flagship record; others fall back to a "created" entry.
    history: i === 0 ? [
      { runId: 'run_8f2a1c', at: '2026-07-14T09:12:00', type: 'updated', fields: [
        { fieldId: 'fldStatus', before: 'Trial', after: 'Active' },
        { fieldId: 'fldLTV', before: '$298,140', after: '$318,420' },
      ] },
      { runId: 'run_7b1d04', at: '2026-07-07T09:10:00', type: 'updated', fields: [
        { fieldId: 'fldOrders', before: '2,310 linked', after: '2,340 linked' },
      ] },
      { runId: 'run_5c9e11', at: '2026-06-23T09:08:00', type: 'updated', fields: [
        { fieldId: 'fldEmail', before: 'ada.okoye@old.com', after: 'ada.okoye@example.com' },
      ] },
      { runId: 'run_1a0b02', at: '2026-06-02T09:05:00', type: 'created' },
    ] : undefined,
  };
});

const orders: DataRecord[] = Array.from({ length: 164 }, (_, i) => {
  const amount = ((i * 97) % 900) + 20;
  const paid = i % 3 !== 0;
  return {
    id: `recO${i}`,
    tableId: 'tblOrders',
    primary: `ORD-${1000 + i}`,
    cells: {
      fldOrderNo: cell(`ORD-${1000 + i}`),
      fldContact: cell(`1 linked`, { linkedCount: 1 }),
      fldAmount: cell(`$${amount.toLocaleString()}`),
      fldPaid: cell(paid ? 'Yes' : 'No'),
      fldContactEmail: cell(`${FIRST[(i * 3) % FIRST.length].toLowerCase()}@example.com`),
      fldTotal: cell(`$${Math.round(amount * 1.2).toLocaleString()}`),
    },
    linked: { fldContact: [`recC${(i * 3) % 138}`] },
    history: i === 0 ? [
      { runId: 'run_8f2a1c', at: '2026-07-14T09:12:00', type: 'updated', fields: [
        { fieldId: 'fldPaid', before: 'No', after: 'Yes' },
      ] },
      { runId: 'run_1a0b02', at: '2026-06-02T09:05:00', type: 'created' },
    ] : undefined,
  };
});

const EVT = ['record.created', 'record.updated', 'automation.run', 'view.opened', 'field.changed'];
const events: DataRecord[] = Array.from({ length: 220 }, (_, i) => ({
  id: `recE${i}`,
  tableId: 'tblEvents',
  primary: `${EVT[i % EVT.length]} #${i}`,
  cells: {
    fldEvtType: cell(EVT[i % EVT.length]),
    fldEvtActor: cell(`${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`),
    fldEvtAt: cell(`2026-07-${String((i % 14) + 1).padStart(2, '0')} 0${i % 9}:${String((i * 7) % 60).padStart(2, '0')}`),
    fldEvtMeta: cell(`{ "ip": "10.0.${i % 255}.${(i * 3) % 255}", "ok": ${i % 2 === 0} }`),
  },
}));

// Generic records for the extra tables (Companies, Deals, Tickets, …) so selecting any of them in
// the picker shows a working grid. Values are filled by field type.
const SELVALS: Record<string, string[]> = {
  Industry: ['SaaS', 'Retail', 'Finance', 'Healthcare', 'Media'],
  Stage: ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'],
  Type: ['Call', 'Email', 'Meeting', 'Note'],
  Channel: ['Email', 'Social', 'Search', 'Events'],
  Source: ['Website', 'Referral', 'Ad', 'Event', 'Cold outreach'],
  Priority: ['Low', 'Medium', 'High', 'Urgent'],
  Status: ['Open', 'Pending', 'Resolved'],
  Team: ['Tier 1', 'Tier 2', 'Escalations'],
  Category: ['Hardware', 'Software', 'License'],
  Region: ['NA', 'EU', 'APAC'],
};
const WORDS = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka', 'Cyberdyne', 'Soylent', 'Vandelay', 'Prestige', 'Pied Piper', 'Aperture', 'Massive'];
const genCell = (field: DataField, i: number) => {
  const t = field.type; const name = field.name;
  if (t === 'singleSelect') { const opts = SELVALS[name] || ['A', 'B', 'C']; return cell(opts[i % opts.length]); }
  if (t === 'number') return cell(String(((i * 37) % 900) + 10));
  if (t === 'currency') return cell(`$${(((i * 53) % 9000) + 100).toLocaleString()}`);
  if (t === 'url') return cell(`https://${WORDS[i % WORDS.length].toLowerCase().replace(/\s/g, '')}.example.com`);
  if (t === 'email') return cell(`${FIRST[i % FIRST.length].toLowerCase()}@example.com`);
  if (t === 'checkbox') return cell(i % 2 === 0 ? 'Yes' : 'No');
  if (t === 'date') return cell(`2026-0${(i % 6) + 1}-${String((i % 27) + 1).padStart(2, '0')}`);
  if (t === 'dateTime') return cell(`2026-07-${String((i % 14) + 1).padStart(2, '0')} 0${i % 9}:${String((i * 7) % 60).padStart(2, '0')}`);
  return cell(`${WORDS[i % WORDS.length]} ${WORDS[(i * 3) % WORDS.length]}`);
};
const extraTables = dataTables.filter((t) => !['tblContacts', 'tblOrders', 'tblEvents'].includes(t.id));
const extraRecords: DataRecord[] = extraTables.flatMap((t) =>
  // A table whose backup captured 0 records generates no rows (true-empty state).
  Array.from({ length: t.approxRecordCount === 0 ? 0 : 60 }, (_, i) => {
    const cells = Object.fromEntries(t.fields.map((fld) => [fld.id, genCell(fld, i)]));
    return { id: `rec_${t.id}_${i}`, tableId: t.id, primary: cells[t.fields[0].id].raw, cells };
  }),
);

// LONG primary values (Oleh, 2026-07-30). Every generated primary above is two words
// ("Umbrella Soylent"), so the state where a record NAME is a whole sentence never existed in the
// harness — and it is the common case in real Airtable, where the primary field of a Tickets or
// Tasks table is the subject line, not an id. Without these, every surface that prints a record
// name looks comfortable in review and truncates badly in production. Three lengths on purpose:
// long, longer, and one absurd, so the failure is visible before a customer finds it.
const LONG_PRIMARIES = [
  'Customer cannot complete checkout when the billing address country differs from the card country',
  'Duplicate invoice generated for the March renewal — finance asked us to hold the credit note until the audit closes',
  'Follow up with the reseller about the unsigned amendment, the expired W-9, and whether the November shipment was ever received; they have not replied to three emails',
];
const longRecords: DataRecord[] = LONG_PRIMARIES.map((primary, i) => {
  const t = dataTables.find((x) => x.id === 'tblTickets')!;
  const cells = Object.fromEntries(t.fields.map((fld) => [fld.id, genCell(fld, 900 + i)]));
  cells[t.fields[0].id] = cell(primary);
  return { id: `rec_tblTickets_long${i}`, tableId: t.id, primary, cells };
});

export const dataRecords: DataRecord[] = [...contacts, ...orders, ...events, ...extraRecords, ...longRecords];

// ── Saved views (iteration-2 Views/Tabs shell) ───────────────────────────────
// A handful of pinned views across bases/tables (each carrying its own filters / hidden
// fields / sort) + one temporary "Scratch" the user hasn't pinned yet. The shell seeds the
// bar/rail from these; "New" / "Duplicate" add throwaway (unpinned) views at runtime.
// All seeded here are `saved: true` — they represent presets a user already saved (hence
// LOCKED to their base + table on load, per the Save/Discard/lock/Draft model, Dan 2026-07-23).
// A Draft (an unsaved preset) only comes from ＋ New blank preset / Duplicate current at runtime.
export const dataViews: SavedView[] = [
  // Pinned + ungrouped — a daily working lens.
  {
    id: 'view-churned', name: 'Churned contacts', tableId: 'tblContacts', pinned: true, saved: true,
    filters: [{ fieldId: 'fldStatus', op: 'is', val: 'Churned' }],
    sortFieldId: 'fldLTV', sortDir: -1,
    hiddenFieldIds: ['fldCreated'],
  },
  // Pinned AND in a group — proves pin ⊥ group (shows in Pinned + under Billing audit).
  {
    id: 'view-unpaid', name: 'Unpaid orders', tableId: 'tblOrders', pinned: true, groupId: 'grp-billing', saved: true,
    filters: [{ fieldId: 'fldPaid', op: 'unchecked' }],
    sortFieldId: 'fldAmount', sortDir: -1,
  },
  // Grouped, not pinned — lives only under its group.
  {
    id: 'view-refunds', name: 'High-value orders', tableId: 'tblOrders', pinned: false, groupId: 'grp-billing', saved: true,
    filters: [{ fieldId: 'fldAmount', op: 'gt', val: '500' }],
    sortFieldId: 'fldAmount', sortDir: -1,
  },
  {
    id: 'view-hot-leads', name: 'Referral leads', tableId: 'tblLeads', pinned: false, groupId: 'grp-q3', saved: true,
    filters: [{ fieldId: 'lSource', op: 'is', val: 'Referral' }],
  },
  {
    id: 'view-active', name: 'Active contacts', tableId: 'tblContacts', pinned: false, groupId: 'grp-q3', saved: true,
    filters: [{ fieldId: 'fldStatus', op: 'is', val: 'Active' }],
  },
  // Unpinned, ungrouped, but still SAVED — a saved preset the user just hasn't pinned or filed yet.
  { id: 'view-scratch', name: 'Scratch', tableId: 'tblContacts', pinned: false, saved: true },
];

/** Thematic groups (folders) for the saved views — Dan's "projects" layer. */
export const dataViewGroups: ViewGroup[] = [
  { id: 'grp-billing', name: 'Billing audit' },
  { id: 'grp-q3', name: 'Q3 investigation' },
];

// ── Data changelog ───────────────────────────────────────────────────────────
// Space-wide record changes grouped by backup run (pattern-data-changelog). Each row
// references a real record id so clicking opens the record panel with History focused.
const ch = (id: string, recordId: string, tableId: string, runId: string, at: string, type: DataChangeEntry['type'], fieldCount?: number): DataChangeEntry => {
  const rec = dataRecords.find((r) => r.id === recordId);
  return { id, recordId, primary: rec?.primary || recordId, tableId, runId, at, type, fieldCount };
};

export const dataChangelog: DataChangeEntry[] = [
  // Run Jul 20 — a BIG import: thousands of records created (proves the per-run collapse).
  // Only a sample of entries ships; the real counts come from `dataRunTotals` below.
  ch('dc0a', 'recE200', 'tblEvents', 'run_a1b2c3', '2026-07-20T09:14:00', 'created'),
  ch('dc0b', 'recE201', 'tblEvents', 'run_a1b2c3', '2026-07-20T09:14:00', 'created'),
  ch('dc0c', 'recO120', 'tblOrders', 'run_a1b2c3', '2026-07-20T09:14:00', 'created'),
  ch('dc0d', 'recC0', 'tblContacts', 'run_a1b2c3', '2026-07-20T09:14:00', 'updated', 3),
  ch('dc0e', 'recO90', 'tblOrders', 'run_a1b2c3', '2026-07-20T09:14:00', 'deleted'),
  // Run Jul 14 — the latest sync
  ch('dc1', 'recC0', 'tblContacts', 'run_8f2a1c', '2026-07-14T09:12:00', 'updated', 2),
  ch('dc2', 'recO0', 'tblOrders', 'run_8f2a1c', '2026-07-14T09:12:00', 'updated', 1),
  ch('dc3', 'recC5', 'tblContacts', 'run_8f2a1c', '2026-07-14T09:12:00', 'updated', 1),
  ch('dc4', 'recO120', 'tblOrders', 'run_8f2a1c', '2026-07-14T09:12:00', 'created'),
  ch('dc5', 'recO121', 'tblOrders', 'run_8f2a1c', '2026-07-14T09:12:00', 'created'),
  ch('dc6', 'recE200', 'tblEvents', 'run_8f2a1c', '2026-07-14T09:12:00', 'created'),
  ch('dc7', 'recC12', 'tblContacts', 'run_8f2a1c', '2026-07-14T09:12:00', 'deleted'),
  // DANGLING ref (edge-case data-edge-dangling-record): a deleted record NOT in the shipped sample —
  // clicking it must surface the "This record isn't in this backup." toast, not silently no-op.
  ch('dc-dangling', 'recDELETED404', 'tblOrders', 'run_8f2a1c', '2026-07-14T09:12:00', 'deleted'),
  // Run Jul 7
  ch('dc8', 'recC0', 'tblContacts', 'run_7b1d04', '2026-07-07T09:10:00', 'updated', 1),
  ch('dc9', 'recO40', 'tblOrders', 'run_7b1d04', '2026-07-07T09:10:00', 'updated', 2),
  ch('dc10', 'recC30', 'tblContacts', 'run_7b1d04', '2026-07-07T09:10:00', 'created'),
  ch('dc11', 'recO90', 'tblOrders', 'run_7b1d04', '2026-07-07T09:10:00', 'deleted'),
  // Run Jun 23
  ch('dc12', 'recC0', 'tblContacts', 'run_5c9e11', '2026-06-23T09:08:00', 'updated', 1),
  ch('dc13', 'recC7', 'tblContacts', 'run_5c9e11', '2026-06-23T09:08:00', 'updated', 3),
  ch('dc14', 'recO12', 'tblOrders', 'run_5c9e11', '2026-06-23T09:08:00', 'created'),
  // Run Jun 16 — a MASS DELETE (640 records gone; possible accidental data loss) — drives the
  // attention flag on the changelog. Only a sample of the deletions ships; runTotals carries the true 640.
  ch('dcd0', 'recO10', 'tblOrders', 'run_del99', '2026-06-16T09:07:00', 'deleted'),
  ch('dcd1', 'recO11', 'tblOrders', 'run_del99', '2026-06-16T09:07:00', 'deleted'),
  ch('dcd2', 'recO12', 'tblOrders', 'run_del99', '2026-06-16T09:07:00', 'deleted'),
  ch('dcd3', 'recO13', 'tblOrders', 'run_del99', '2026-06-16T09:07:00', 'deleted'),
  ch('dcd4', 'recC0', 'tblContacts', 'run_del99', '2026-06-16T09:07:00', 'updated', 1),
  // Run Jun 9 — routine sync, nothing deleted (exercises a zero DELETED column)
  ch('dc15', 'recO12', 'tblOrders', 'run_3d4e05', '2026-06-09T09:06:00', 'created'),
  ch('dc16', 'recE201', 'tblEvents', 'run_3d4e05', '2026-06-09T09:06:00', 'created'),
  ch('dc17', 'recC0', 'tblContacts', 'run_3d4e05', '2026-06-09T09:06:00', 'updated', 2),
  ch('dc18', 'recC5', 'tblContacts', 'run_3d4e05', '2026-06-09T09:06:00', 'updated', 1),
  // Run May 26 — a large import (hundreds created); only a sample of entries ships
  ch('dc19', 'recE200', 'tblEvents', 'run_9f8a16', '2026-05-26T09:04:00', 'created'),
  ch('dc20', 'recO120', 'tblOrders', 'run_9f8a16', '2026-05-26T09:04:00', 'created'),
  ch('dc21', 'recO121', 'tblOrders', 'run_9f8a16', '2026-05-26T09:04:00', 'created'),
  ch('dc22', 'recC0', 'tblContacts', 'run_9f8a16', '2026-05-26T09:04:00', 'updated', 3),
  ch('dc23', 'recO90', 'tblOrders', 'run_9f8a16', '2026-05-26T09:04:00', 'deleted'),
  // Run May 12
  ch('dc24', 'recC30', 'tblContacts', 'run_6c2d27', '2026-05-12T09:03:00', 'created'),
  ch('dc25', 'recO40', 'tblOrders', 'run_6c2d27', '2026-05-12T09:03:00', 'updated', 1),
  ch('dc26', 'recC7', 'tblContacts', 'run_6c2d27', '2026-05-12T09:03:00', 'updated', 2),
  ch('dc27', 'recC12', 'tblContacts', 'run_6c2d27', '2026-05-12T09:03:00', 'deleted'),
  // Run Apr 28 — creates + updates, nothing deleted (zero DELETED column)
  ch('dc28', 'recO120', 'tblOrders', 'run_b7e438', '2026-04-28T09:07:00', 'created'),
  ch('dc29', 'recE200', 'tblEvents', 'run_b7e438', '2026-04-28T09:07:00', 'created'),
  ch('dc30', 'recC0', 'tblContacts', 'run_b7e438', '2026-04-28T09:07:00', 'updated', 1),
  // Run Apr 14 — no new records this run (exercises a zero CREATED column)
  ch('dc31', 'recC5', 'tblContacts', 'run_4a1f49', '2026-04-14T09:05:00', 'updated', 2),
  ch('dc32', 'recO0', 'tblOrders', 'run_4a1f49', '2026-04-14T09:05:00', 'updated', 1),
  ch('dc33', 'recO90', 'tblOrders', 'run_4a1f49', '2026-04-14T09:05:00', 'deleted'),
  // Run Mar 31 — a medium import
  ch('dc34', 'recO121', 'tblOrders', 'run_e5c65a', '2026-03-31T09:09:00', 'created'),
  ch('dc35', 'recE201', 'tblEvents', 'run_e5c65a', '2026-03-31T09:09:00', 'created'),
  ch('dc36', 'recC7', 'tblContacts', 'run_e5c65a', '2026-03-31T09:09:00', 'updated', 1),
  ch('dc37', 'recC12', 'tblContacts', 'run_e5c65a', '2026-03-31T09:09:00', 'deleted'),
  // Run Mar 17
  ch('dc38', 'recO12', 'tblOrders', 'run_2b8d6b', '2026-03-17T09:06:00', 'created'),
  ch('dc39', 'recC30', 'tblContacts', 'run_2b8d6b', '2026-03-17T09:06:00', 'created'),
  ch('dc40', 'recC0', 'tblContacts', 'run_2b8d6b', '2026-03-17T09:06:00', 'updated', 1),
  // Run Mar 3 — first backup: all creates (zero UPDATED and DELETED columns)
  ch('dc41', 'recC0', 'tblContacts', 'run_8f3a7c', '2026-03-03T09:04:00', 'created'),
  ch('dc42', 'recO0', 'tblOrders', 'run_8f3a7c', '2026-03-03T09:04:00', 'created'),
  ch('dc43', 'recE200', 'tblEvents', 'run_8f3a7c', '2026-03-03T09:04:00', 'created'),
  // Run Jul 20 — pager depth: >2 pages of SAMPLED entries on the big import so the drill panel's
  // 50-per-page pager is real (100 event creates + 30 order creates + 17 contact updates + 3
  // deletes). Still far below the run's TRUE created total (2,340) so the honesty note shows.
  ...Array.from({ length: 100 }, (_, i) => ch(`dcg${i}`, `recE${i}`, 'tblEvents', 'run_a1b2c3', '2026-07-20T09:14:00', 'created' as const)),
  ...Array.from({ length: 30 }, (_, i) => ch(`dcg${100 + i}`, `recO${130 + i}`, 'tblOrders', 'run_a1b2c3', '2026-07-20T09:14:00', 'created' as const)),
  ...Array.from({ length: 17 }, (_, i) => ch(`dcg${130 + i}`, `recC${40 + i}`, 'tblContacts', 'run_a1b2c3', '2026-07-20T09:14:00', 'updated' as const, (i % 3) + 1)),
  ...Array.from({ length: 3 }, (_, i) => ch(`dcg${147 + i}`, `recO${91 + i}`, 'tblOrders', 'run_a1b2c3', '2026-07-20T09:14:00', 'deleted' as const)),
];

/**
 * Per-run TRUE totals (iteration-2 per-run changelog). A backup run can create thousands of
 * records; we only ship a handful of sample entries, so the count columns read from this map
 * (falling back to the shipped entry counts when a run is absent). The drill-in sidebar shows
 * the sample entries + a "showing N of M" note when a run's total exceeds its samples.
 */
export const dataRunTotals: Record<string, { created: number; updated: number; deleted: number }> = {
  run_a1b2c3: { created: 2340, updated: 18, deleted: 4 },
  run_3d4e05: { created: 2, updated: 4, deleted: 0 },
  run_9f8a16: { created: 812, updated: 33, deleted: 7 },
  run_del99: { created: 0, updated: 12, deleted: 640 },
  run_6c2d27: { created: 1, updated: 2, deleted: 1 },
  run_b7e438: { created: 46, updated: 12, deleted: 0 },
  run_4a1f49: { created: 0, updated: 5, deleted: 2 },
  run_e5c65a: { created: 128, updated: 9, deleted: 3 },
  run_2b8d6b: { created: 3, updated: 1, deleted: 0 },
  run_8f3a7c: { created: 5, updated: 0, deleted: 0 },
};

// ── Data Docs (reuse SchemaDocs, scoped to data) ─────────────────────────────
export const dataDocs: SchemaDoc[] = [
  {
    id: 'ddoc-contacts', title: 'Contacts dataset — how to read it', author: 'Dana',
    updatedAt: '2026-07-10T11:20:00',
    excerpt: 'What each Contacts field means, which are computed, and how Orders roll up into Lifetime value.',
    body: [
      { type: 'p', content: [
        'The ', { entity: 'tblContacts' }, ' table is the customer hub. ', { entity: 'fldStatus' },
        ' drives most segments, and ', { entity: 'fldLTV' }, ' is a rollup over linked ', { entity: 'tblOrders' }, '.',
      ] },
      { type: 'h2', content: ['Computed fields'] },
      { type: 'p', content: [
        { entity: 'fldLTV' }, ' sums Amount across every linked order — it is read-only and recomputed at each backup.',
      ] },
      { type: 'ul', items: [
        ['Treat ', { entity: 'fldStatus' }, ' as the source of truth for lifecycle.'],
        ['A blank ', { entity: 'fldOrders' }, ' link means the contact has no orders yet.'],
      ] },
      // B4 record tagging: an inline RECORD chip (real record id) + the recordIds list below.
      { type: 'p', content: [
        'Our flagship account ', { record: 'recC0' }, ' is the reference example — 2,340 linked orders and the largest lifetime value.',
      ] },
    ],
    // 12 entity tags (real ids) so the panel's >6-gated search + max-height scroll are actually
    // demonstrable in the harness (Oleh 2026-07-21: "5 elements — where's the search and scroll?").
    entityIds: ['tblContacts', 'tblOrders', 'tblEvents', 'fldStatus', 'fldLTV', 'fldOrders', 'fldName', 'fldEmail', 'fldCreated', 'fldAmount', 'fldPaid', 'fldOrderNo'],
    recordIds: ['recC0'],
    links: [{ label: 'Segment definitions', url: 'https://example.com/segments' }],
    diagrams: [],
  },
  {
    id: 'ddoc-orders', title: 'Orders: totals and lookups', author: 'Sam',
    updatedAt: '2026-07-08T16:05:00',
    excerpt: 'How Total is computed from Amount, and where Contact email is looked up from.',
    body: [
      { type: 'p', content: [
        { entity: 'fldTotal' }, ' is a formula (Amount × 1.2). ', { entity: 'fldContactEmail' },
        ' is a lookup that travels the ', { entity: 'fldContact' }, ' link to the Contacts table.',
      ] },
      { type: 'p', content: [
        'A worked example: ', { record: 'recO0' }, ' belongs to ', { record: 'recC5' }, ' — trace the lookup on it.',
      ] },
    ],
    entityIds: ['tblOrders', 'fldTotal', 'fldContactEmail', 'fldContact'],
    recordIds: ['recO0', 'recC5'],
    links: [],
    diagrams: [],
  },
];

// ── Data Chat threads (reuse SchemaChat, scoped to data) ─────────────────────
export const dataThreads: ChatThread[] = [
  {
    id: 'dchat-1', title: 'Which contacts churned this quarter?', updatedAt: '2026-07-13T14:20:00',
    scope: [{ kind: 'entity', id: 'tblContacts', name: 'Contacts', entityKind: 'table' }],
    messages: [
      { id: 'm1', role: 'user', text: 'How many contacts are Churned, and what is their combined lifetime value?' },
      { id: 'm2', role: 'assistant', text: 'Across the latest backup, 46 contacts have Status = Churned, with a combined Lifetime value of about $1.2M. The largest is Ada Okoye ($318,420). The Status field is the lifecycle source of truth.', refs: [
        { kind: 'entity', id: 'fldStatus', name: 'Status', entityKind: 'field', fieldType: 'singleSelect' },
        { kind: 'entity', id: 'fldLTV', name: 'Lifetime value', entityKind: 'field', fieldType: 'rollup' },
        // A RECORD reference — its chip opens the record sidebar (data-page spec).
        { kind: 'record', id: 'recC0', name: 'Ada Okoye' },
      ] },
    ],
  },
  {
    id: 'dchat-2', title: 'Orders without a paid flag', updatedAt: '2026-07-11T09:05:00',
    scope: [{ kind: 'entity', id: 'tblOrders', name: 'Orders', entityKind: 'table' }],
    messages: [
      { id: 'm1', role: 'user', text: 'Which orders are still unpaid?' },
      { id: 'm2', role: 'assistant', text: 'Filter Orders where Paid is unchecked — that is the set awaiting payment. The Total field already includes tax, so it reflects the amount owed.', refs: [
        { kind: 'entity', id: 'fldPaid', name: 'Paid', entityKind: 'field', fieldType: 'checkbox' },
        { kind: 'entity', id: 'fldTotal', name: 'Total (incl. tax)', entityKind: 'field', fieldType: 'formula' },
      ] },
    ],
  },
];

// ── Record comments (comments-explorer) ──────────────────────────────────────
// Captured Airtable record comments. Shapes mirror the real payload
// (`GET /v0/{baseId}/{table}/{recordId}/comments`): author {id,email,name?}, raw `@[usrXXX]`
// tokens inside `text` + a `mentioned` map to resolve them, `lastUpdatedTime` null until edited,
// `attachments` / `reactions` carried but not rendered in this slice.
//
// `lastSeenAt` is OURS, not Airtable's: the latest capture in which the comment was still
// present. A comment whose lastSeenAt is older than `lastSyncedAt` has left the source since —
// which is all we can honestly observe, since Airtable exposes no deleted flag on a comment.

const AUTHORS: Record<string, DataCommentAuthor> = {
  dana: { id: 'usrDana01', email: 'dana.reyes@example.com', name: 'Dana Reyes' },
  sam: { id: 'usrSam02', email: 'sam.silva@example.com', name: 'Sam Silva' },
  priya: { id: 'usrPriya3', email: 'priya.nair@example.com', name: 'Priya Nair' },
  hugo: { id: 'usrHugo04', email: 'hugo.berg@example.com', name: 'Hugo Berg' },
  // Author-fallback case A: an EMAIL-ONLY author (no `name` in the payload) — the row must read
  // the email, not an empty cell. Used ONLY in the volume block now, not in the readable set:
  // mixing "some have names, some don't" into the enterprise fixture blurred the one comparison
  // the handoff exists to make (Oleh, 2026-07-30). The email-only state is what the whole
  // `?fixture=emailcomments` scenario shows.
  emailOnly: { id: 'usrNoName5', email: 'k.mensah@example.com' },
  // Author-fallback case B: neither name NOR email. Kept in the readable set as the ONE
  // exception, because its cause is plan-independent: a collaborator removed from the workspace
  // after commenting, or an automation rather than a person (Airtable's own mention model has an
  // `appAgent` kind). So even with an enterprise account a person can be unresolvable — a
  // different fact from "this plan doesn't return names", and worth not collapsing into it.
  anonymous: { id: 'usrGhost06' },
};

const cm = (
  id: string,
  recordId: string,
  tableId: string,
  authorKey: keyof typeof AUTHORS,
  text: string,
  createdAt: string,
  extra: Partial<DataComment> = {},
): DataComment => ({
  id,
  recordId,
  tableId,
  author: AUTHORS[authorKey],
  text,
  createdAt,
  lastUpdatedAt: null,
  // Default = still present in the newest capture. A no-longer-seen comment overrides this.
  lastSeenAt: lastSyncedAt,
  ...extra,
});

// A resolvable mention pair — the token inside `text` and the map entry that names it.
const MENTION_DANA: Record<string, DataCommentMention> = {
  usrDana01: { id: 'usrDana01', type: 'user', displayName: 'Dana Reyes', email: 'dana.reyes@example.com' },
};
const MENTION_GROUP: Record<string, DataCommentMention> = {
  grpBilling: { id: 'grpBilling', type: 'userGroup', displayName: 'Billing team' },
  usrSam02: { id: 'usrSam02', type: 'user', displayName: 'Sam Silva', email: 'sam.silva@example.com' },
};

// The 12-comment thread (one root + 11 replies) on the flagship contact — the volume a thread view
// will have to carry, and the place the edited + no-longer-seen states live.
const THREAD_ROOT = 'cmt-thread-00';
const threadTexts = [
  'Flagging this account for the Q3 renewal review — lifetime value jumped again after the July import.',
  'Agreed. The rollup looks right but the linked order count moved by 30 in one run, which is more than usual.',
  'That was the bulk import on the 20th. Nothing manual.',
  'Do we want to hold the renewal until the invoice reconciliation finishes?',
  'I would rather not — the customer already asked twice about the timeline.',
  'Then we send the draft renewal now and reconcile in parallel.',
  'Careful: the address on file is the old one. It was corrected in Airtable but not in the billing system.',
  'Good catch. I updated it here so the next capture picks it up.',
  'Renewal draft is out. Waiting on countersignature.',
  'Countersigned this morning.',
  'Closing this out. @[usrDana01] please move the account to the Active segment.',
  'Done — segment updated and the finance note is filed.',
];

const commentThread: DataComment[] = threadTexts.map((text, i) =>
  cm(
    i === 0 ? THREAD_ROOT : `cmt-thread-${String(i).padStart(2, '0')}`,
    'recC0',
    'tblContacts',
    (['dana', 'sam', 'priya', 'hugo', 'dana'] as const)[i % 5],
    text,
    // Oldest first over four days, so the thread interleaves with the rest of the stream.
    `2026-07-${String(9 + Math.floor(i / 4)).padStart(2, '0')}T${String(9 + (i % 4) * 2).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    {
      ...(i === 0 ? {} : { parentCommentId: THREAD_ROOT }),
      // ONE edited comment in the thread. `lastUpdatedAt` is the only edit evidence Airtable
      // returns — the previous text is never sent, so there is nothing to "view previous version".
      ...(i === 6 ? { lastUpdatedAt: '2026-07-11T14:02:00' } : {}),
      // ONE no-longer-seen comment: last observed two captures ago, absent since.
      ...(i === 4 ? { lastSeenAt: '2026-06-23T09:08:00' } : {}),
      ...(i === 10 ? { mentioned: MENTION_DANA } : {}),
    },
  ),
);

// Volume block — 520 comments so the pager, the search and the day grouping are exercised at a
// scale a chatty base actually reaches. Spread across three bases / four tables / fourteen days.
const VOLUME_TABLES: [string, string][] = [
  ['tblContacts', 'recC'],
  ['tblOrders', 'recO'],
  ['tblTickets', 'rec_tblTickets_'],
  ['tblCampaigns', 'rec_tblCampaigns_'],
];
const VOLUME_TEXTS = [
  'Checked against the source sheet — matches.',
  'Duplicate of the record created last week; merging.',
  'Owner reassigned after the territory change.',
  'Amount corrected: the tax line was double-counted.',
  'Waiting on the customer to confirm the shipping address.',
  'This came in through the web form, not the importer.',
  'Escalated — SLA breach risk before end of day.',
  'Closed. No further action needed.',
];
const VOLUME_AUTHORS = ['dana', 'sam', 'priya', 'hugo', 'emailOnly', 'anonymous'] as const;
const commentVolume: DataComment[] = Array.from({ length: 520 }, (_, i) => {
  const [tableId, prefix] = VOLUME_TABLES[i % VOLUME_TABLES.length];
  // Index kept inside each table's real shipped record range so every reference resolves.
  const n = tableId === 'tblContacts' ? i % 138 : tableId === 'tblOrders' ? i % 164 : i % 60;
  const day = 1 + (i % 14);
  return cm(
    `cmt-vol-${i}`,
    `${prefix}${n}`,
    tableId,
    VOLUME_AUTHORS[i % VOLUME_AUTHORS.length],
    VOLUME_TEXTS[i % VOLUME_TEXTS.length],
    `2026-07-${String(day).padStart(2, '0')}T${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}:00`,
    // A slice of the volume has also left the source, so the status filter has real matches
    // beyond the single hand-written one.
    i % 47 === 0 ? { lastSeenAt: '2026-07-07T09:10:00' } : {},
  );
});

export const dataComments: DataComment[] = [
  // ── Hand-written cases, newest first ──
  // Mentions AND reactions on one comment: the resolvable `@[usrSam02]` + a userGroup token, plus
  // the reaction payload we carry but deliberately do not render in this slice.
  cm(
    'cmt-rich',
    'recO0',
    'tblOrders',
    'priya',
    'Refund approved. @[usrSam02] can you confirm with @[grpBilling] before the next run?',
    '2026-07-14T08:41:00',
    {
      mentioned: MENTION_GROUP,
      reactions: [
        { emoji: { unicodeCharacter: '👍' }, reactingUser: AUTHORS.sam },
        { emoji: { unicodeCharacter: '🎉' }, reactingUser: AUTHORS.dana },
      ],
      attachments: [{ id: 'attRefund01', filename: 'refund-approval.pdf', url: 'https://example.com/refund-approval.pdf', type: 'application/pdf', size: 88213 }],
    },
  ),
  // MALFORMED payload: a mention TOKEN with no `mentioned` map to resolve it, written by an author
  // with neither name nor email. Both degradations have to hold at once — the token is stripped
  // rather than leaked as a raw id, and the author reads "Airtable user".
  cm('cmt-malformed', 'rec_tblTickets_3', 'tblTickets', 'anonymous', 'Reassigning to @[usrUNKNOWN99] — please pick this up today.', '2026-07-13T17:05:00'),
  // Email-only author, in a third base.
  cm('cmt-mkt-1', 'rec_tblCampaigns_7', 'tblCampaigns', 'hugo', 'Budget was cut mid-flight; the spend column will not reconcile with the plan.', '2026-07-12T11:20:00'),
  cm('cmt-mkt-2', 'rec_tblCampaigns_12', 'tblCampaigns', 'hugo', 'Creative swapped on the 9th. Anything before that date is the old variant.', '2026-07-10T15:48:00'),
  cm('cmt-ops-1', 'rec_tblTickets_18', 'tblTickets', 'sam', 'Customer replied on the old thread — merging the two tickets.', '2026-07-08T09:15:00'),
  // A comment that has left the source: last observed in the June 23 capture.
  cm('cmt-gone-1', 'rec_tblTickets_21', 'tblTickets', 'dana', 'Internal note — remove before sharing this record with the customer.', '2026-07-05T13:02:00', { lastSeenAt: '2026-06-23T09:08:00' }),
  // Edited outside a thread: created on the 5th, corrected on the 6th.
  cm('cmt-edited-1', 'recO40', 'tblOrders', 'priya', 'Amount corrected — the original figure included the cancelled line item.', '2026-07-05T10:30:00', { lastUpdatedAt: '2026-07-06T08:12:00' }),
  // ── DANGLING ref (edge-case data-edge-dangling-record), exactly ONE, mirroring `ch('dc-dangling')`
  // above: the commented record is NOT in the shipped sample, so the location must say so and the
  // click must surface the "This record isn't in this backup." toast rather than silently no-op.
  cm('cmt-dangling', 'recDELETED404', 'tblOrders', 'sam', 'Cancelled before fulfilment — keeping the note for the audit trail.', '2026-07-04T16:44:00'),
  // The THIRD status, and the only one we cannot resolve: the comment is gone from the latest
  // capture AND so is its record. `cmt-gone-1` above is the certain case — its record came back
  // without the comment, so "Deleted" is a fact. Here there was nothing to re-read, so the row has
  // to hedge with "Last seen". Without this fixture the unverified state has no way to be seen.
  cm('cmt-unverified', 'recPURGED77', 'tblOrders', 'hugo', 'Chasing the finance team on this one — will update once they confirm.', '2026-07-03T11:26:00', { lastSeenAt: '2026-06-23T09:08:00' }),
  // Comments on the LONG-primary records, so the Record column's truncation is exercised in the
  // feed and not only in the Browse grid. Short comment text on purpose: the row must fail (or
  // hold) because of the RECORD name, with nothing else competing for the space.
  cm('cmt-long-1', 'rec_tblTickets_long0', 'tblTickets', 'priya', 'Reproduced on a UK card with a US billing address.', '2026-07-14T10:05:00'),
  cm('cmt-long-2', 'rec_tblTickets_long1', 'tblTickets', 'dana', 'Finance confirmed — hold until the audit closes.', '2026-07-13T14:40:00'),
  cm('cmt-long-3', 'rec_tblTickets_long2', 'tblTickets', 'sam', 'Fourth email sent.', '2026-07-12T09:12:00'),
  ...commentThread,
  ...commentVolume,
];

/**
 * The LOW-VOLUME scenario (`?fixture=fewcomments`): the hand-written cases + the 12-comment
 * thread, without the 520-comment block. Every edge the feed has to survive is still in here —
 * the dangling record reference, the no-longer-seen rows, both edited comments, both author
 * fallbacks, the mentions/reactions comment and the malformed one — so it is the state to read
 * the rows in, while the default (`dataComments`, 540) is the state to stress the pager in.
 */
export const dataCommentsFew: DataComment[] = dataComments.filter((c) => !c.id.startsWith('cmt-vol-'));

/**
 * The NO-NAMES world (`?fixture=emailcomments`).
 *
 * Founder, 2026-07-30: *"we will only get the email of the user and the ID… we would display the
 * email unless it's an enterprise Airtable account then we can get the names."* Airtable's public
 * comments docs DO document a `name` on the author and a `displayName` on a mention, so which of
 * the two worlds a customer lands in depends on the capture path, not on our code — and the code
 * already handles both through `authorLabel`'s name → email → "Airtable user" chain.
 *
 * What was NOT covered is the SCREEN. Every hand-written author in this file has a name, so the
 * demo showed the comfortable world and the Author column was only ever sized for "Dana Reyes".
 * An email is roughly twice as wide and reads completely differently down twenty rows. This
 * scenario strips every name — author AND mention — so the column can be judged in the state the
 * founder says is common, instead of being discovered by a customer.
 */
const stripNames = (c: DataComment): DataComment => ({
  ...c,
  author: { id: c.author.id, ...(c.author.email ? { email: c.author.email } : {}) },
  mentioned: c.mentioned
    ? Object.fromEntries(
        Object.entries(c.mentioned).map(([k, m]) => [k, { id: m.id, type: m.type, ...(m.email ? { email: m.email } : {}) }]),
      )
    : undefined,
});
export const dataCommentsEmailOnly: DataComment[] = dataCommentsFew.map(stripNames);
