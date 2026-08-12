// Shared Schema fixtures — single source for /schema and the /panels review lab.
// Moved out of pages/schema.astro so the Panel Lab can reuse the SAME data (not a mock).

import type { SchemaTable } from '../components/schema/SchemaCanvas';
import type { BaseHealth } from '../components/schema/SchemaHealth.astro';
import type { SchemaRelationship } from '../components/schema/SchemaRelationships.astro';
import type { SchemaAutomation } from '../components/schema/SchemaAutomations.astro';
import type { SchemaInterface } from '../components/schema/SchemaInterfaces.astro';
import type { ChatThread } from '../components/schema/SchemaChat.astro';
import type { ChangelogEntry } from '../components/schema/SchemaChangelog.astro';
import type { SchemaDoc } from '../components/schema/schemaEntities';

// The demo Space is multi-base (Sales CRM + Marketing + Operations) so the Visualize base
// filter is always live and the Health console always has a populated base list.
const schemaBases = [
  { id: 'b-sales', name: 'Sales CRM' },
  { id: 'b-mktg', name: 'Marketing' },
  { id: 'b-ops', name: 'Operations' },
];

// Core CRM schema — Companies is the hub; linked-record fields carry the edges.
// `fields` is the FULL list (the side panel shows all; the node surfaces primary +
// linked-record rows and collapses the rest into "+N more"). A couple of fields/tables
// carry an AI-generated `description` to show the "has description" state.
const tables: SchemaTable[] = [
  {
    id: 'b-companies', name: 'Companies', health: 'green', recordCount: 340, fieldCount: 10,
    description: 'Organizations you sell to — the account record that deals and contacts roll up to.',
    technicalDescription:
      'Hub table of the CRM base: the account-level entity that Deals (via `Company`) and Contacts (via `Company`) reference through linked-record fields, so most rollups and lookups resolve through it. 8 fields, ~340 records as of the last backup. Primary field is `Name` (free text — use the trading name for searchability); industry is a constrained single-select. Deleting or merging a Companies record cascades to every linked Deal and Contact, so treat it as the canonical account of record.',
    fields: [
      { id: 'f-co-name', name: 'Name', type: 'single_line_text', isPrimary: true, airtableDescription: 'Legal company name.', userDescription: 'Use the trading name, not the legal entity, so it matches how reps search.' },
      { id: 'f-co-industry', name: 'Industry', type: 'single_select', options: ['SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Manufacturing', 'Other'] },
      { id: 'f-co-website', name: 'Website', type: 'url' },
      { id: 'f-co-employees', name: 'Employees', type: 'number' },
      { id: 'f-co-owner', name: 'Account Owner', type: 'collaborator' },
      { id: 'f-co-deals', name: 'Deals', type: 'link', linkedTableId: 'b-deals', allowsMultiple: true, inverseFieldId: 'f-dl-company' },
      { id: 'f-co-contacts', name: 'Contacts', type: 'link', linkedTableId: 'b-contacts' },
      { id: 'f-co-adjustment', name: 'Adjustment', type: 'number', airtableDescription: 'Manual multiplier applied to the rolled-up pipeline (e.g. 0.9 to haircut an unreliable account).' },
      { id: 'f-co-pipeline', name: 'Pipeline Value', type: 'rollup', lookupViaFieldId: 'f-co-deals', lookupTargetFieldId: 'f-dl-amount', formula: 'SUM(values) * {Adjustment}', referencedFieldIds: ['f-co-adjustment'], airtableDescription: 'Sum of linked Deal amounts, scaled by the local Adjustment factor.' },
      { id: 'f-co-created', name: 'Created', type: 'created_time' },
      { id: 'f-co-legacy', name: 'Legacy ID', type: 'single_line_text', removed: true, removedAt: '2026-05-14', airtableDescription: 'Import identifier carried over from the previous CRM.' },
    ],
  },
  {
    id: 'b-contacts', name: 'Contacts', health: 'green', recordCount: 1480, fieldCount: 8,
    fields: [
      { id: 'f-ct-name', name: 'Full Name', type: 'single_line_text', isPrimary: true },
      { id: 'f-ct-email', name: 'Email', type: 'email' },
      { id: 'f-ct-phone', name: 'Phone', type: 'phone_number' },
      { id: 'f-ct-title', name: 'Job Title', type: 'single_line_text', description: 'The contact’s role at their company.', technicalDescription: 'Free-text single-line field — not a constrained select, so values are unnormalized (e.g. “VP Eng”, “VP of Engineering”, “vp engineering” all coexist). Commonly used for persona/seniority segmentation in views and automations; expect to normalize on import or via a downstream formula/lookup rather than relying on exact-match grouping. No validation or referential link to any other table.' },
      { id: 'f-ct-company', name: 'Company', type: 'link', linkedTableId: 'b-companies' },
      { id: 'f-ct-deals', name: 'Deals', type: 'link', linkedTableId: 'b-deals' },
      { id: 'f-ct-activities', name: 'Activities', type: 'link', linkedTableId: 'b-activities' },
      { id: 'f-ct-last', name: 'Last Contacted', type: 'date' },
    ],
  },
  {
    id: 'b-deals', name: 'Deals', health: 'amber', recordCount: 980, fieldCount: 12,
    fields: [
      { id: 'f-dl-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'f-dl-stage', name: 'Stage', type: 'single_select', options: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'], airtableDescription: 'Current pipeline stage.', description: 'The deal’s position in the sales pipeline, from first lead through to a closed (won or lost) outcome.', technicalDescription: 'Single-select enum with a fixed six-value option set: Lead → Qualified → Proposal → Negotiation → {Closed Won | Closed Lost}. The last two are terminal states (Closed Won / Closed Lost); the first four are open-pipeline. Drives the Kanban board grouping and forecast/weighted-value reporting, and is advanced by automation as cards move between columns — avoid editing the value directly. Changing the option set is a schema change and may orphan records on retired values.' },
      { id: 'f-dl-amount', name: 'Amount', type: 'currency' },
      { id: 'f-dl-close', name: 'Close Date', type: 'date' },
      { id: 'f-dl-prob', name: 'Probability', type: 'percent' },
      { id: 'f-dl-company', name: 'Company', type: 'link', linkedTableId: 'b-companies', allowsMultiple: false, inverseFieldId: 'f-co-deals' },
      { id: 'f-dl-contact', name: 'Primary Contact', type: 'link', linkedTableId: 'b-contacts' },
      { id: 'f-dl-activities', name: 'Activities', type: 'link', linkedTableId: 'b-activities' },
      { id: 'f-dl-notes', name: 'Notes', type: 'link', linkedTableId: 'b-notes' },
      { id: 'f-dl-owner', name: 'Deal Owner', type: 'collaborator' },
      { id: 'f-dl-weighted', name: 'Weighted Value', type: 'formula', formula: '{Amount} * {Probability}', referencedFieldIds: ['f-dl-amount', 'f-dl-prob'], airtableDescription: 'Amount × Probability — the pipeline-weighted value.' },
      { id: 'f-dl-score', name: 'Deal Score', type: 'formula', formula: 'weighted heuristic across Amount, Probability, Stage, Close Date, Company Industry', referencedFieldIds: ['f-dl-amount', 'f-dl-prob', 'f-dl-stage', 'f-dl-close', 'f-dl-coindustry'], airtableDescription: 'Composite deal-quality score derived from five signals — used to prioritise the pipeline.' },
      { id: 'f-dl-coindustry', name: 'Company Industry', type: 'lookup', lookupViaFieldId: 'f-dl-company', lookupTargetFieldId: 'f-co-industry' },
    ],
  },
  {
    // Deleted in Airtable, kept for history — hidden in Browse until "Include deleted" is on.
    id: 'b-quotes', name: 'Quotes', health: 'amber', recordCount: 0, fieldCount: 4,
    removed: true, removedAt: '2026-05-02',
    description: 'Retired quoting table — superseded by line items on Deals.',
    fields: [
      { id: 'f-qt-name', name: 'Quote ID', type: 'single_line_text', isPrimary: true },
      { id: 'f-qt-deal', name: 'Deal', type: 'link', linkedTableId: 'b-deals' },
      { id: 'f-qt-amount', name: 'Amount', type: 'currency' },
      { id: 'f-qt-status', name: 'Status', type: 'single_select', options: ['Draft', 'Sent', 'Accepted', 'Rejected'] },
    ],
  },
  {
    id: 'b-leads', name: 'Leads', health: 'green', recordCount: 1120, fieldCount: 6,
    fields: [
      { id: 'f-ld-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'f-ld-source', name: 'Source', type: 'single_select' },
      { id: 'f-ld-status', name: 'Status', type: 'single_select' },
      { id: 'f-ld-email', name: 'Email', type: 'email' },
      { id: 'f-ld-company', name: 'Company', type: 'link', linkedTableId: 'b-companies' },
      { id: 'f-ld-score', name: 'Score', type: 'number' },
    ],
  },
  {
    id: 'b-activities', name: 'Activities', health: 'green', recordCount: 270, fieldCount: 6,
    fields: [
      { id: 'f-ac-subject', name: 'Subject', type: 'single_line_text', isPrimary: true },
      { id: 'f-ac-type', name: 'Type', type: 'single_select' },
      { id: 'f-ac-date', name: 'Date', type: 'date' },
      { id: 'f-ac-done', name: 'Done', type: 'checkbox' },
      { id: 'f-ac-deal', name: 'Deal', type: 'link', linkedTableId: 'b-deals' },
      { id: 'f-ac-contact', name: 'Contact', type: 'link', linkedTableId: 'b-contacts' },
    ],
  },
  {
    id: 'b-notes', name: 'Notes', health: 'red', recordCount: 156, fieldCount: 4,
    fields: [
      { id: 'f-nt-title', name: 'Title', type: 'single_line_text', isPrimary: true },
      { id: 'f-nt-body', name: 'Body', type: 'long_text' },
      { id: 'f-nt-created', name: 'Created', type: 'created_time' },
      { id: 'f-nt-deal', name: 'Deal', type: 'link', linkedTableId: 'b-deals' },
    ],
  },
  {
    // Newly-added table (see changelog cl-1) — exists in the current schema so the changelog
    // entry can drill into its full EntityPanel. Empty (0 records), 3 sample fields.
    id: 'b-q2forecast', name: 'Q2 Forecast', health: 'amber', recordCount: 0, fieldCount: 3,
    fields: [
      { id: 'f-q2-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'f-q2-quarter', name: 'Quarter', type: 'single_select', options: ['Q1', 'Q2', 'Q3', 'Q4'] },
      { id: 'f-q2-amount', name: 'Forecast Amount', type: 'currency' },
    ],
  },
];

// A second base (Marketing) — self-contained ER cluster — used only by ?bases=multi to
// demo the base-filter. Links stay WITHIN a base (Airtable links never cross bases).
const marketingTables: SchemaTable[] = [
  {
    id: 'm-campaigns', name: 'Campaigns', health: 'green', recordCount: 48, fieldCount: 8, baseId: 'b-mktg',
    description: 'Marketing campaigns — budget, channel, and the leads each one drives.',
    fields: [
      { id: 'mc-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'mc-channel', name: 'Channel', type: 'link', linkedTableId: 'm-channels' },
      { id: 'mc-audiences', name: 'Audiences', type: 'link', linkedTableId: 'm-audiences' },
      { id: 'mc-status', name: 'Status', type: 'single_select' },
      { id: 'mc-acqchannel', name: 'Acquisition Channel', type: 'single_select' },
      { id: 'mc-budget', name: 'Budget', type: 'currency' },
      { id: 'mc-start', name: 'Start Date', type: 'date' },
      { id: 'mc-leads', name: 'Leads', type: 'number' },
    ],
  },
  {
    id: 'm-channels', name: 'Channels', health: 'green', recordCount: 12, fieldCount: 5, baseId: 'b-mktg',
    fields: [
      { id: 'mch-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'mch-campaigns', name: 'Campaigns', type: 'link', linkedTableId: 'm-campaigns' },
      { id: 'mch-audiences', name: 'Audiences', type: 'link', linkedTableId: 'm-audiences' },
      { id: 'mch-type', name: 'Type', type: 'single_select' },
      { id: 'mch-spend', name: 'Monthly Spend', type: 'currency' },
    ],
  },
  {
    id: 'm-audiences', name: 'Audiences', health: 'amber', recordCount: 26, fieldCount: 5, baseId: 'b-mktg',
    fields: [
      { id: 'ma-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'ma-channel', name: 'Channel', type: 'link', linkedTableId: 'm-channels' },
      { id: 'ma-size', name: 'Size', type: 'number' },
      { id: 'ma-rate', name: 'Match Rate', type: 'percent' },
      { id: 'ma-created', name: 'Created', type: 'created_time' },
    ],
  },
  {
    // Newly-added table (see changelog cl-9) — exists in the current schema so the changelog
    // entry drills into its full EntityPanel. 8 sample fields, 142 records.
    id: 'm-sequences', name: 'Email Sequences', health: 'amber', recordCount: 142, fieldCount: 8, baseId: 'b-mktg',
    fields: [
      { id: 'mes-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'mes-campaign', name: 'Campaign', type: 'link', linkedTableId: 'm-campaigns' },
      { id: 'mes-step', name: 'Step', type: 'number' },
      { id: 'mes-subject', name: 'Subject', type: 'single_line_text' },
      { id: 'mes-delay', name: 'Delay (days)', type: 'number' },
      { id: 'mes-status', name: 'Status', type: 'single_select' },
      { id: 'mes-sent', name: 'Sent', type: 'number' },
      { id: 'mes-openrate', name: 'Open Rate', type: 'percent' },
    ],
  },
];

// A third base (Operations) — self-contained ER cluster — so the Space has three bases.
const opsTables: SchemaTable[] = [
  {
    id: 'o-tickets', name: 'Tickets', health: 'amber', recordCount: 1820, fieldCount: 7, baseId: 'b-ops',
    description: 'Support tickets — status, priority, and who is handling each.',
    fields: [
      { id: 'ot-name', name: 'Subject', type: 'single_line_text', isPrimary: true },
      { id: 'ot-agent', name: 'Assignee', type: 'link', linkedTableId: 'o-agents' },
      { id: 'ot-queue', name: 'Queue', type: 'link', linkedTableId: 'o-queues' },
      { id: 'ot-status', name: 'Status', type: 'single_select' },
      { id: 'ot-priority', name: 'Priority', type: 'single_select' },
      { id: 'ot-created', name: 'Created', type: 'created_time' },
      { id: 'ot-resolved', name: 'Resolved', type: 'date' },
    ],
  },
  {
    id: 'o-agents', name: 'Agents', health: 'green', recordCount: 24, fieldCount: 4, baseId: 'b-ops',
    fields: [
      { id: 'oa-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'oa-email', name: 'Email', type: 'email' },
      { id: 'oa-tickets', name: 'Tickets', type: 'link', linkedTableId: 'o-tickets' },
      { id: 'oa-active', name: 'Active', type: 'checkbox' },
    ],
  },
  {
    id: 'o-queues', name: 'Queues', health: 'green', recordCount: 8, fieldCount: 4, baseId: 'b-ops',
    fields: [
      { id: 'oq-name', name: 'Name', type: 'single_line_text', isPrimary: true },
      { id: 'oq-tickets', name: 'Tickets', type: 'link', linkedTableId: 'o-tickets' },
      { id: 'oq-sla', name: 'SLA Hours', type: 'number' },
      { id: 'oq-lead', name: 'Lead', type: 'link', linkedTableId: 'o-agents' },
    ],
  },
];
// Tag the Sales tables with their base and assemble the full multi-base Space.
const salesTables: SchemaTable[] = tables.map((t) => ({ ...t, baseId: 'b-sales' }));
const multiTables: SchemaTable[] = [...salesTables, ...marketingTables, ...opsTables];

// Per-base health (Health tab). 0–100 + band; issues reference real tables and deep-link
// to Airtable. Engine computes these after each backup; the page only reads.
// H3 — system-default scoring prompts per metric (the engine's catalog defaults).
const MP: Record<string, string> = {
  'Field naming': 'Rate how clear and consistent field names are across the base. Penalize cryptic abbreviations, duplicates, and inconsistent casing; reward descriptive, consistently-cased names.',
  'Descriptions': 'Rate documentation coverage. Penalize tables and key fields without descriptions; reward clear, current descriptions on the entities people rely on.',
  'Broken links': 'Detect linked-record fields that point to deleted or invalid records. Penalize each broken reference; reward fully valid links.',
  'Empty primary fields': 'Detect records whose primary field is empty (they are hard to identify and reference). Penalize tables with empty primaries; reward fully-populated primary fields.',
  'Formula errors': 'Detect formula, rollup, and lookup fields returning errors. Penalize each erroring computed field; reward error-free computations.',
};
const LG = '2026-06-22T14:05:00';
// System-default insight prompt (the catalog default behind every base's insights).
const INSIGHT_SYS = 'Write a short list of concrete, advisory observations about this base’s schema — circular or high-fan-out relationships, naming inconsistencies, unused or undocumented fields, and structural risks for restore. Phrase each as an observation with a suggestion ("consider…"), reference the specific tables and fields involved, and never be alarmist or pejorative.';
const health: BaseHealth[] = [
  {
    baseId: 'b-sales', baseName: 'Sales CRM', score: 74, band: 'amber', assessedAt: '2026-06-22T14:03:00', trend: [80, 78, 76, 74],
    metrics: [
      { name: 'Field naming', tiers: ['Field'], score: 78, weight: 20, systemPrompt: MP['Field naming'], lastGenerated: LG, findings: [{ text: '14 fields could use clearer names', severity: 'low' }] },
      { name: 'Descriptions', tiers: ['Base', 'Table', 'Field'], score: 70, weight: 20, systemPrompt: MP['Descriptions'], spacePrompt: 'Rate documentation coverage, but only flag tables and fields that are customer-facing or used in reports — internal scratch fields are fine without descriptions.', lastGenerated: LG, findings: [{ text: '9 fields are missing descriptions', severity: 'low' }] },
      { name: 'Broken links', tiers: ['Field'], score: 55, weight: 25, systemPrompt: MP['Broken links'], lastGenerated: LG, promptStale: true, findings: [{ text: 'Linked field “Deal” in Notes points to deleted records (12 records)', severity: 'high', airtableUrl: 'https://airtable.com/appSalesCRM/tblNotes' }] },
      { name: 'Empty primary fields', tiers: ['Table'], score: 68, weight: 20, systemPrompt: MP['Empty primary fields'], lastGenerated: LG, findings: [{ text: 'Empty primary field in Deals (8 records)', severity: 'high', airtableUrl: 'https://airtable.com/appSalesCRM/tblDeals' }] },
      { name: 'Formula errors', tiers: ['Field'], score: 92, weight: 15, enabled: false, systemPrompt: MP['Formula errors'], lastGenerated: LG },
    ],
    issues: [
      { severity: 'high', text: 'Linked field “Deal” in Notes points to deleted records', count: '12 records', airtableUrl: 'https://airtable.com/appSalesCRM/tblNotes' },
      { severity: 'high', text: 'Empty primary field in Deals', count: '8 records', airtableUrl: 'https://airtable.com/appSalesCRM/tblDeals' },
      { severity: 'med', text: '3 unnamed fields in Activities', count: '3 fields', airtableUrl: 'https://airtable.com/appSalesCRM/tblActivities' },
      { severity: 'low', text: '14 fields could use clearer names', count: '14 fields' },
      { severity: 'low', text: '9 fields are missing descriptions', count: '9 fields' },
    ],
    insightConfig: { systemPrompt: INSIGHT_SYS, spacePrompt: 'Focus on relationships and reporting fields that downstream forecasts depend on. Skip cosmetic naming nits unless they affect rollups.', lastGenerated: '2026-06-22T14:03:00' },
    insights: [
      {
        id: 'ins-s1', category: 'Circular reference', generatedAt: '2026-06-22T14:03:00',
        text: 'Companies and Deals reference each other through linked fields. Restoring one table without the other can leave links pointing at records that aren’t back yet, so consider restoring them together.',
        evidence: '2 link fields form the cycle · seen in the Jun 22 snapshot',
        tags: [{ id: 'b-companies', name: 'Companies', kind: 'table' }, { id: 'b-deals', name: 'Deals', kind: 'table' }],
      },
      {
        id: 'ins-s2', category: 'Missing descriptions', generatedAt: '2026-06-22T14:03:00',
        text: 'Some reporting fields on Deals have no description, so teammates may not realize Weighted Value is derived from Amount and Probability. Consider documenting the fields reports depend on.',
        tags: [{ id: 'f-dl-weighted', name: 'Weighted Value', kind: 'field', fieldType: 'formula' }, { id: 'f-dl-prob', name: 'Probability', kind: 'field', fieldType: 'percent' }],
      },
      {
        id: 'ins-s3', category: 'High cardinality', generatedAt: '2026-06-22T14:03:00',
        text: 'Activities fan out heavily from Deals — most deals carry many activity rows. That’s expected for an activity log, but worth knowing before a partial restore of either table.',
        tags: [{ id: 'b-activities', name: 'Activities', kind: 'table' }, { id: 'b-deals', name: 'Deals', kind: 'table' }],
      },
      {
        id: 'ins-s-arc1', category: 'Naming inconsistency', generatedAt: '2026-05-30T09:00:00', archived: true,
        text: 'An earlier note about inconsistent casing on Leads fields was retired after the fields were renamed in a later backup.',
        tags: [{ id: 'b-leads', name: 'Leads', kind: 'table' }],
      },
    ],
  },
  {
    baseId: 'b-mktg', baseName: 'Marketing', score: 92, band: 'green', assessedAt: '2026-06-22T14:05:00', trend: [85, 87, 90, 92],
    metrics: [
      { name: 'Field naming', tiers: ['Field'], score: 95, weight: 20, systemPrompt: MP['Field naming'], lastGenerated: LG },
      { name: 'Descriptions', tiers: ['Base', 'Table', 'Field'], score: 88, weight: 20, systemPrompt: MP['Descriptions'], lastGenerated: LG, findings: [{ text: '2 fields are missing descriptions', severity: 'low' }] },
      { name: 'Broken links', tiers: ['Field'], score: 96, weight: 25, systemPrompt: MP['Broken links'], lastGenerated: LG },
      { name: 'Empty primary fields', tiers: ['Table'], score: 94, weight: 20, systemPrompt: MP['Empty primary fields'], lastGenerated: LG },
      { name: 'Formula errors', tiers: ['Field'], score: 90, weight: 15, systemPrompt: MP['Formula errors'], lastGenerated: LG },
    ],
    issues: [
      { severity: 'low', text: '2 fields are missing descriptions', count: '2 fields' },
    ],
    insightConfig: { systemPrompt: INSIGHT_SYS, spacePrompt: 'Focus on relationships and reporting fields that downstream forecasts depend on. Skip cosmetic naming nits unless they affect rollups.', lastGenerated: '2026-06-22T14:05:00' },
    insights: [
      {
        id: 'ins-m1', category: 'Naming inconsistency', generatedAt: '2026-06-22T14:05:00',
        text: 'Acquisition Channel uses a few spellings of the same value (“Email”, “e-mail”), which can split attribution rollups across Campaigns. Consider standardizing the option set.',
        evidence: '3 near-duplicate option values detected',
        tags: [{ id: 'm-campaigns', name: 'Campaigns', kind: 'table' }, { id: 'mc-acqchannel', name: 'Acquisition Channel', kind: 'field', fieldType: 'single_select' }],
      },
      {
        id: 'ins-m2', category: 'High cardinality', generatedAt: '2026-06-22T14:05:00',
        text: 'Email Sequences holds the most records in this base and links back to Campaigns. It’s healthy, but it dominates restore size — useful to know when scoping a partial restore.',
        tags: [{ id: 'm-sequences', name: 'Email Sequences', kind: 'table' }],
      },
    ],
  },
  {
    baseId: 'b-ops', baseName: 'Operations', score: 48, band: 'red', assessedAt: '2026-06-22T14:07:00', trend: [60, 56, 52, 48],
    metrics: [
      { name: 'Field naming', tiers: ['Field'], score: 62, weight: 20, systemPrompt: MP['Field naming'], lastGenerated: LG, findings: [{ text: '3 unnamed fields in “Imports”', severity: 'med', airtableUrl: 'https://airtable.com/appOps/tblImports' }] },
      { name: 'Descriptions', tiers: ['Base', 'Table', 'Field'], score: 58, weight: 20, systemPrompt: MP['Descriptions'], lastGenerated: LG, findings: [{ text: '12 fields are missing descriptions', severity: 'low' }] },
      { name: 'Broken links', tiers: ['Field'], score: 30, weight: 25, systemPrompt: MP['Broken links'], lastGenerated: LG, findings: [{ text: 'Linked field “Owner” points to deleted records (23 records)', severity: 'high', airtableUrl: 'https://airtable.com/appOps/tblTasks' }] },
      { name: 'Empty primary fields', tiers: ['Table'], score: 35, weight: 20, systemPrompt: MP['Empty primary fields'], lastGenerated: LG, findings: [{ text: 'Empty primary field — 47 records in “Tasks”', severity: 'high', airtableUrl: 'https://airtable.com/appOps/tblTasks' }] },
      { name: 'Formula errors', tiers: ['Field'], score: 55, weight: 15, systemPrompt: MP['Formula errors'], lastGenerated: LG, findings: [{ text: 'Formula error in “Status” roll-up (5 fields)', severity: 'med', airtableUrl: 'https://airtable.com/appOps/tblTasks' }] },
    ],
    issues: [
      { severity: 'high', text: 'Empty primary field — 47 records in “Tasks”', count: '47 records', airtableUrl: 'https://airtable.com/appOps/tblTasks' },
      { severity: 'high', text: 'Linked field “Owner” points to deleted records', count: '23 records', airtableUrl: 'https://airtable.com/appOps/tblTasks' },
      { severity: 'med', text: '3 unnamed fields in “Imports”', count: '3 fields', airtableUrl: 'https://airtable.com/appOps/tblImports' },
      { severity: 'med', text: 'Formula error in “Status” roll-up', count: '5 fields', airtableUrl: 'https://airtable.com/appOps/tblTasks' },
      { severity: 'low', text: '12 fields are missing descriptions', count: '12 fields' },
    ],
    // Operations demonstrates a per-base override + a stale prompt → the Re-run path.
    insightConfig: {
      systemPrompt: INSIGHT_SYS,
      spacePrompt: 'Focus on relationships and reporting fields that downstream forecasts depend on. Skip cosmetic naming nits unless they affect rollups.',
      basePrompt: 'Operations is our support workspace. Prioritize ticket-routing integrity (links between Tickets, Agents, and Queues) and flag any field that SLA dashboards read. Be stricter about undocumented status fields.',
      lastGenerated: '2026-06-22T14:07:00', promptStale: true,
    },
    insights: [
      {
        id: 'ins-o1', category: 'High cardinality', generatedAt: '2026-06-22T14:07:00',
        text: 'Tickets fan out to Queues at a high ratio — a single queue holds most open tickets, so it dominates the size of any restore that includes it. Consider scoping restores per queue.',
        evidence: 'One queue accounts for ~70% of linked tickets',
        tags: [{ id: 'o-tickets', name: 'Tickets', kind: 'table' }, { id: 'o-queues', name: 'Queues', kind: 'table' }],
      },
      {
        id: 'ins-o2', category: 'Missing descriptions', generatedAt: '2026-06-22T14:07:00',
        text: 'Most fields in Tickets have no description, including Status, which recently changed type. Documenting Status would help teammates interpret multi-value records correctly.',
        tags: [{ id: 'o-tickets', name: 'Tickets', kind: 'table' }, { id: 'ot-status', name: 'Status', kind: 'field', fieldType: 'multiple_select' }],
      },
      {
        id: 'ins-o3', category: 'Naming inconsistency', generatedAt: '2026-06-22T14:07:00',
        text: 'Priority gained several options after its type change, and a few records didn’t map to a current value. Consider consolidating the option set and re-checking unmapped records.',
        evidence: '3 records hold a value that isn’t a current option',
        tags: [{ id: 'ot-priority', name: 'Priority', kind: 'field', fieldType: 'single_select' }],
      },
      {
        id: 'ins-o4', category: 'Circular reference', generatedAt: '2026-06-22T14:07:00',
        text: 'Tickets and Agents reference each other (assigned agent ↔ an agent’s tickets). A restore of one without the other can leave assignments dangling, so consider restoring the pair together.',
        tags: [{ id: 'o-tickets', name: 'Tickets', kind: 'table' }, { id: 'o-agents', name: 'Agents', kind: 'table' }],
      },
      {
        id: 'ins-o5', category: 'Unused field', generatedAt: '2026-06-22T14:07:00',
        text: 'Several fields on Agents haven’t been populated in recent records, which suggests they may no longer be used. Review them before they drift further out of date.',
        tags: [{ id: 'o-agents', name: 'Agents', kind: 'table' }],
      },
      {
        id: 'ins-o6', category: 'Duplicate fields', generatedAt: '2026-06-22T14:07:00',
        text: 'Two fields on Tickets carry overlapping status information, which can disagree over time. Consider consolidating to a single source of truth to avoid conflicting reports.',
        tags: [{ id: 'o-tickets', name: 'Tickets', kind: 'table' }, { id: 'ot-status', name: 'Status', kind: 'field', fieldType: 'multiple_select' }],
      },
      {
        id: 'ins-o7', category: 'Missing descriptions', generatedAt: '2026-06-22T14:07:00',
        text: 'The Operations base itself has no description, so its purpose and ownership aren’t documented for new teammates. Consider adding a short base description.',
        tags: [{ id: 'b-ops', name: 'Operations', kind: 'base' }],
      },
      {
        id: 'ins-o-arc1', category: 'High cardinality', generatedAt: '2026-05-28T10:00:00', archived: true,
        text: 'An earlier observation about queue backlog was retired after the queues were rebalanced in a later backup.',
        tags: [{ id: 'o-queues', name: 'Queues', kind: 'table' }],
      },
    ],
  },
];
// Changelog feed — schema diffs from backup snapshots (engine pre-renders the strings).
// A ⚠️ warning flags a change that may have invalidated existing data.
const changelog: ChangelogEntry[] = [
  { id: 'cl-1', at: '2026-06-21T09:14:00', base: 'Sales CRM', table: 'Q2 Forecast', type: 'added', summary: 'New table “Q2 Forecast” added (3 fields, 0 records)', aiSummary: 'A new table joined this base. It starts empty, so nothing references it yet. Add a description and link it to related tables if it is part of an existing workflow.' },
  { id: 'cl-2', at: '2026-06-21T08:40:00', base: 'Marketing', table: 'Campaigns', field: 'Lead Source', entityId: 'mc-acqchannel', fieldType: 'single_select', type: 'renamed', summary: 'Field renamed', before: 'Lead Source', after: 'Acquisition Channel', aiSummary: 'Only the field name changed; its data and type are untouched. Views, formulas, or automations that reference it by name may need updating.' },
  { id: 'cl-3', at: '2026-06-20T16:02:00', base: 'Operations', table: 'Tickets', field: 'Status', entityId: 'ot-status', fieldType: 'multiple_select', type: 'typed', summary: 'Field “Status” type changed', before: 'Single select', after: 'Multiple select', warning: '12 records may now have invalid values', aiSummary: 'Status can now hold more than one value. 12 records had a single value that no longer matches an available option, so they may read as blank until someone re-selects. Existing valid records are unaffected.' },
  { id: 'cl-4', at: '2026-06-20T11:30:00', base: 'Sales CRM', table: 'Deals', field: 'Probability', entityId: 'f-dl-prob', fieldType: 'percent', type: 'added', summary: 'New field “Probability” (percent) added to Deals', aiSummary: 'A new percent field was added to Deals. Existing records have it empty; back-fill or set a default if downstream reports expect a value.' },
  { id: 'cl-10', at: '2026-06-19T15:25:00', base: 'Sales CRM', table: 'Deals', field: 'Stage', entityId: 'f-dl-stage', fieldType: 'single_select', type: 'config', summary: 'Stage single-select gained the “Negotiation” option', before: '5 options', after: '6 options', aiSummary: 'A new choice was added to the Stage single-select. Existing records keep their values; the new option is now available to pick. No data was invalidated.' },
  { id: 'cl-11', at: '2026-06-19T11:40:00', base: 'Sales CRM', table: 'Deals', field: 'Weighted Value', entityId: 'f-dl-weighted', fieldType: 'formula', type: 'config', summary: 'Weighted Value formula updated', before: '{Amount}', after: '{Amount} * {Probability}', aiSummary: 'The formula now multiplies by Probability, so computed values changed for every record. Reports that read this field will reflect the new calculation.' },
  { id: 'cl-5', at: '2026-06-18T14:20:00', base: 'Sales CRM', table: 'Contacts', field: 'Legacy ID', fieldType: 'single_line_text', type: 'removed', summary: 'Field “Legacy ID” removed from Contacts', aiSummary: 'This field and its values are gone from the live base. Past backups still hold the data, so a restore can recover it if it is needed.' },
  { id: 'cl-6', at: '2026-06-18T10:05:00', base: 'Marketing', table: 'Campaigns', entityKind: 'view', entityName: 'Active Campaigns', type: 'added', summary: 'View “Active Campaigns” added to Campaigns', aiSummary: 'A new view changes how records are displayed, not the data itself. No records are affected.' },
  { id: 'cl-7', at: '2026-06-15T13:48:00', base: 'Operations', table: 'Tickets', field: 'Priority', entityId: 'ot-priority', fieldType: 'single_select', type: 'typed', summary: 'Field “Priority” type changed', before: 'Number', after: 'Single select', warning: '3 records didn’t map to a select option', aiSummary: 'Priority switched from free numbers to a fixed set of options. 3 records held a number that is not one of the new options, so they did not map and may show as blank.' },
  { id: 'cl-8', at: '2026-06-15T09:12:00', base: 'Sales CRM', table: 'Deals', field: 'Owner', entityId: 'f-dl-owner', fieldType: 'collaborator', type: 'renamed', summary: 'Field renamed', before: 'Owner', after: 'Account Owner', aiSummary: 'A rename only; the collaborator data is intact. Update anything that looks the field up by its old name.' },
  { id: 'cl-9', at: '2026-06-12T17:30:00', base: 'Marketing', table: 'Email Sequences', type: 'added', summary: 'New table “Email Sequences” added (8 fields, 142 records)', aiSummary: 'A new table with 8 fields and 142 records joined this base. Review its links and descriptions so it is covered by your backups and schema docs.' },
  // App-layer changes (automations / interfaces / pages) — Airtable's API can't export these, so
  // they enter the changelog from the manual registry / inbound API (Dan 2026-07-01).
  { id: 'cl-au1', at: '2026-06-21T10:20:00', base: 'Sales CRM', entityKind: 'automation', entityName: 'Notify owner on stage change', entityId: 'autA1b2C3d4E5f6G7', type: 'added', summary: 'Automation “Notify owner on stage change” registered', aiSummary: 'A new automation was registered. It posts a Slack message to the deal owner when a deal changes stage. Review the tables it touches so a restore keeps them together.' },
  { id: 'cl-au2', at: '2026-06-20T09:05:00', base: 'Sales CRM', entityKind: 'automation', entityName: 'Weekly pipeline digest', entityId: 'autH8i9J0k1L2m3N4', type: 'config', summary: 'Automation turned off', before: 'Active', after: 'Inactive', aiSummary: 'The automation was switched off in Airtable, so the weekly digest no longer sends. It stays in the registry — turn it back on to resume.' },
  { id: 'cl-if1', at: '2026-06-19T14:10:00', base: 'Sales CRM', entityKind: 'interface', entityName: 'Sales dashboard', entityId: 'pblSalesDash00001', type: 'renamed', summary: 'Interface renamed', before: 'Sales overview', after: 'Sales dashboard', aiSummary: 'Only the interface name changed. Anything that references it by name may need updating.' },
  { id: 'cl-if2', at: '2026-06-18T16:45:00', base: 'Marketing', entityKind: 'page', entityName: 'Channel overview', entityId: 'pgeMktOverview01', type: 'config', summary: 'Page unpublished', before: 'Published', after: 'Not published', aiSummary: 'The page was unpublished, so the team can no longer see it until it is published again.' },
  { id: 'cl-au3', at: '2026-05-14T12:00:00', base: 'Sales CRM', entityKind: 'automation', entityName: 'Old lead-scoring flow', entityId: 'autC9d0E1f2G3h4I5', type: 'removed', summary: 'Automation “Old lead-scoring flow” removed from Airtable', aiSummary: 'This automation no longer exists in Airtable. It is kept as history in the registry.' },
  { id: 'cl-if3', at: '2026-04-30T10:00:00', base: 'Sales CRM', entityKind: 'page', entityName: 'Forecast (archived)', entityId: 'pgeForecast000001', type: 'removed', summary: 'Page “Forecast (archived)” removed from Airtable', aiSummary: 'This page no longer exists in Airtable; kept as history.' },
];

// Relationships — the Space's relationship graph (relationships-tab). Declared ones
// (linked records / formulas / lookups / lastModified) come from field types; synced
// views are INFERRED (the Airtable metadata API doesn't expose sync links) → Confirm/Dismiss.
const relationships: SchemaRelationship[] = [
  {
    id: 'rel-deals-companies', type: 'linkedRecords', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-dl-company', name: 'Company', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Deals' },
    b: { id: 'f-co-deals', name: 'Deals', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Companies' },
    cardinality: 'm:1', direction: 'two', validity: 'valid', hasRemovedHistory: true,
    provenance: 'Declared by the “Company” linked-record field on Deals, with a reciprocal “Deals” field on Companies.',
    links: [
      { from: { id: 'f-dl-company', name: 'Company', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Deals' }, to: { id: 'b-companies', name: 'Companies', kind: 'table' }, firstSeen: '2025-11-02' },
      { from: { id: 'f-co-deals', name: 'Deals', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Companies' }, to: { id: 'b-deals', name: 'Deals', kind: 'table' }, removed: true, removedAt: '2026-05-18', note: 'reciprocal field was briefly removed' },
    ],
  },
  {
    id: 'rel-contacts-companies', type: 'linkedRecords', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-ct-company', name: 'Company', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Contacts' },
    b: { id: 'f-co-contacts', name: 'Contacts', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Companies' },
    cardinality: 'm:1', direction: 'two', validity: 'valid',
    provenance: 'Declared by the “Company” linked-record field on Contacts.',
    links: [{ from: { id: 'f-ct-company', name: 'Company', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Contacts' }, to: { id: 'b-companies', name: 'Companies', kind: 'table' }, firstSeen: '2025-11-02' }],
  },
  {
    id: 'rel-deals-weighted', type: 'formulas', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-dl-weighted', name: 'Weighted Value', kind: 'field', fieldType: 'formula', tableName: 'Deals' },
    b: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' },
    direction: 'one', validity: 'valid',
    provenance: 'The “Weighted Value” formula references Amount and Probability — editing either changes its result.',
    links: [
      { from: { id: 'f-dl-weighted', name: 'Weighted Value', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' } },
      { from: { id: 'f-dl-weighted', name: 'Weighted Value', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-prob', name: 'Probability', kind: 'field', fieldType: 'percent', tableName: 'Deals' } },
    ],
  },
  {
    // A many-field formula (5 referenced fields) — exercises the B1 "+N more" cap: the summary
    // shows 3 chips then a "+2 more" hover popover, each field click-through to its panel.
    id: 'rel-deals-score', type: 'formulas', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' },
    b: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' },
    direction: 'one', validity: 'valid',
    provenance: 'The “Deal Score” formula references five fields — Amount, Probability, Stage, Close Date, and Company Industry — editing any of them changes its result.',
    links: [
      { from: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' } },
      { from: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-prob', name: 'Probability', kind: 'field', fieldType: 'percent', tableName: 'Deals' } },
      { from: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-stage', name: 'Stage', kind: 'field', fieldType: 'singleSelect', tableName: 'Deals' } },
      { from: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-close', name: 'Close Date', kind: 'field', fieldType: 'date', tableName: 'Deals' } },
      { from: { id: 'f-dl-score', name: 'Deal Score', kind: 'field', fieldType: 'formula', tableName: 'Deals' }, to: { id: 'f-dl-coindustry', name: 'Company Industry', kind: 'field', fieldType: 'multipleLookupValues', tableName: 'Deals' } },
    ],
  },
  {
    id: 'rel-deals-industry', type: 'lookups', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-dl-coindustry', name: 'Company Industry', kind: 'field', fieldType: 'multipleLookupValues', tableName: 'Deals' },
    b: { id: 'f-co-industry', name: 'Industry', kind: 'field', fieldType: 'singleSelect', tableName: 'Companies' },
    direction: 'one', validity: 'valid',
    provenance: 'Looks up Industry from the linked Company record — read-only, follows the source.',
    links: [{ from: { id: 'f-dl-coindustry', name: 'Company Industry', kind: 'field', fieldType: 'multipleLookupValues', tableName: 'Deals' }, to: { id: 'f-co-industry', name: 'Industry', kind: 'field', fieldType: 'singleSelect', tableName: 'Companies' } }],
  },
  {
    // Rollup — the dual nature Dan flagged: a cross-table link (rolls up Deals.Amount via the
    // Deals link) PLUS a same-table formula that references another local field (Adjustment).
    id: 'rel-companies-pipeline', type: 'rollups', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-co-pipeline', name: 'Pipeline Value', kind: 'field', fieldType: 'rollup', tableName: 'Companies' },
    b: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' },
    cardinality: 'm:1', direction: 'one', validity: 'valid',
    provenance: 'Rolls up SUM of Deals.Amount across the linked Deals, then scales the result by the local Adjustment field — so it depends on both a linked table and a same-table field.',
    links: [
      { from: { id: 'f-co-pipeline', name: 'Pipeline Value', kind: 'field', fieldType: 'rollup', tableName: 'Companies' }, to: { id: 'f-dl-amount', name: 'Amount', kind: 'field', fieldType: 'currency', tableName: 'Deals' }, firstSeen: '2026-01-10' },
      { from: { id: 'f-co-pipeline', name: 'Pipeline Value', kind: 'field', fieldType: 'rollup', tableName: 'Companies' }, to: { id: 'f-co-adjustment', name: 'Adjustment', kind: 'field', fieldType: 'number', tableName: 'Companies' }, firstSeen: '2026-01-10' },
    ],
  },
  {
    id: 'rel-contacts-last', type: 'lastModified', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-ct-last', name: 'Last Activity', kind: 'field', fieldType: 'lastModifiedTime', tableName: 'Contacts' },
    b: { id: 'f-ct-activities', name: 'Activities', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Contacts' },
    direction: 'one', validity: 'valid',
    provenance: 'A “last modified time” field watching the Activities link — updates whenever a contact’s activities change.',
    links: [{ from: { id: 'f-ct-last', name: 'Last Activity', kind: 'field', fieldType: 'lastModifiedTime', tableName: 'Contacts' }, to: { id: 'f-ct-activities', name: 'Activities', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Contacts' } }],
  },
  {
    id: 'rel-quotes-deals', type: 'linkedRecords', baseId: 'b-sales', baseName: 'Sales CRM',
    a: { id: 'f-qt-deal', name: 'Deal', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Quotes' },
    b: { id: 'b-deals', name: 'Deals', kind: 'table' },
    cardinality: 'm:1', direction: 'one', validity: 'invalid', hasRemovedHistory: true,
    provenance: 'The Quotes table was removed from the base, so this link no longer resolves. Kept as history — a restore can bring it back.',
    links: [{ from: { id: 'f-qt-deal', name: 'Deal', kind: 'field', fieldType: 'multipleRecordLinks', tableName: 'Quotes' }, to: { id: 'b-deals', name: 'Deals', kind: 'table' }, removed: true, firstSeen: '2025-11-02', removedAt: '2026-06-10' }],
  },
  {
    id: 'rel-tickets-queues', type: 'syncedViews', baseId: 'b-ops', baseName: 'Operations',
    a: { id: 'o-tickets', name: 'Tickets', kind: 'table' },
    b: { id: 'o-queues', name: 'Queues', kind: 'table' },
    direction: 'two', inferred: true, validity: 'valid',
    provenance: 'Inferred from a read-only “Sync source” field and matching field structure. Airtable’s metadata API doesn’t expose sync links, so this is a best guess — confirm if Tickets is synced from Queues.',
    links: [{ from: { id: 'o-tickets', name: 'Tickets', kind: 'table' }, to: { id: 'o-queues', name: 'Queues', kind: 'table' }, firstSeen: '2026-03-14' }],
  },
  {
    id: 'rel-campaigns-audiences', type: 'syncedViews', baseId: 'b-mktg', baseName: 'Marketing',
    a: { id: 'm-campaigns', name: 'Campaigns', kind: 'table' },
    b: { id: 'm-audiences', name: 'Audiences', kind: 'table' },
    direction: 'two', inferred: true, validity: 'valid',
    provenance: 'Inferred from read-only mirrored fields. This may instead be a normal linked-record relationship — confirm or dismiss.',
    links: [{ from: { id: 'm-campaigns', name: 'Campaigns', kind: 'table' }, to: { id: 'm-audiences', name: 'Audiences', kind: 'table' }, firstSeen: '2026-04-01' }],
  },
];

// Docs — long-form documentation ABOUT the schema. Each tags real entity ids (the
// reverse side surfaces in each entity's "Documentation" panel section), with
// external links and saved React-Flow mini-diagrams (scoped to a few tables).
const schemaDocs: SchemaDoc[] = [
  {
    id: 'doc-crm', title: 'Sales CRM — how it fits together', author: 'Dana',
    updatedAt: '2026-06-22T11:20:00',
    excerpt: 'How Companies, Contacts, and Deals link up, and which fields downstream reports depend on.',
    body: [
      { type: 'p', content: [
        'The Sales CRM is built around ', { entity: 'b-companies' }, ' as the hub. Every ',
        { entity: 'b-deals' }, ' and ', { entity: 'b-contacts' }, ' rolls up to a company, so keep the company record clean before anything else.',
      ] },
      { type: 'h2', content: ['Deal stages'] },
      { type: 'p', content: [
        'The pipeline lives in ', { entity: 'f-dl-stage' }, '. Reporting reads ', { entity: 'f-dl-amount' },
        ' and ', { entity: 'f-dl-prob' }, ' together to compute weighted forecast, so a blank stage breaks the forecast view.',
      ] },
      { type: 'ul', items: [
        ['Always set ', { entity: 'f-dl-stage' }, ' when a deal is created.'],
        ['Link the ', { entity: 'f-dl-contact' }, ' so activity history is attributable.'],
      ] },
      { type: 'diagram', diagramId: 'dg-crm' },
    ],
    entityIds: ['b-companies', 'b-deals', 'b-contacts', 'f-dl-stage', 'f-dl-amount', 'f-dl-prob', 'f-dl-contact'],
    links: [
      { label: 'Pipeline definitions (Notion)', url: 'https://example.com/pipeline' },
      { label: 'Revenue model spreadsheet', url: 'https://example.com/revenue' },
    ],
    diagrams: [
      { id: 'dg-crm', name: 'Companies ▸ Deals ▸ Contacts', tableIds: ['b-companies', 'b-deals', 'b-contacts'] },
      { id: 'dg-crm-leads', name: 'Leads ▸ Activities', tableIds: ['b-leads', 'b-activities', 'b-companies'] },
    ],
  },
  {
    id: 'doc-ops', title: 'Operations: ticket routing', author: 'Sam',
    updatedAt: '2026-06-19T16:05:00',
    excerpt: 'How tickets flow through queues to agents, and the SLA fields the dashboards read.',
    body: [
      { type: 'p', content: [
        { entity: 'o-tickets' }, ' are assigned to an ', { entity: 'o-agents' }, ' via a ',
        { entity: 'o-queues' }, '. The ', { entity: 'ot-priority' }, ' field drives SLA timers.',
      ] },
      { type: 'diagram', diagramId: 'dg-ops' },
    ],
    entityIds: ['o-tickets', 'o-agents', 'o-queues', 'ot-priority'],
    links: [{ label: 'SLA policy', url: 'https://example.com/sla' }],
    diagrams: [{ id: 'dg-ops', name: 'Ticket routing', tableIds: ['o-tickets', 'o-agents', 'o-queues'] }],
  },
  // Extra Space docs — enough that the "Add to doc" list scrolls + the search box appears (>5).
  {
    id: 'doc-mkt', title: 'Marketing attribution model', author: 'Priya',
    updatedAt: '2026-06-20T09:40:00',
    excerpt: 'How campaign spend ties back to closed-won deals, and which fields the attribution rollups read.',
    body: [{ type: 'p', content: ['First-touch attribution joins campaigns to deals through the lead source. Keep the channel field consistent so the rollups stay accurate.'] }],
    entityIds: [], links: [], diagrams: [],
  },
  {
    id: 'doc-retention', title: 'Data retention & cleanup policy', author: 'Sam',
    updatedAt: '2026-06-18T13:15:00',
    excerpt: 'What we keep, for how long, and the GFS schedule the cleanup job follows.',
    body: [{ type: 'p', content: ['Backups follow a daily → weekly → monthly tiering with a five-year cutoff. This doc records the retention decisions behind that schedule.'] }],
    entityIds: [], links: [], diagrams: [],
  },
  {
    id: 'doc-onboarding', title: 'Onboarding: new rep checklist', author: 'Dana',
    updatedAt: '2026-06-15T10:05:00',
    excerpt: 'The steps a new sales rep follows in their first week, and the records they should not edit by hand.',
    body: [{ type: 'p', content: ['Read the pipeline definitions before touching deals. Stage advances from the board, not by editing the field directly.'] }],
    entityIds: [], links: [], diagrams: [],
  },
  {
    id: 'doc-finance', title: 'Finance: revenue recognition', author: 'Marco',
    updatedAt: '2026-06-12T17:30:00',
    excerpt: 'When revenue is recognized against a closed deal, and the fields finance reconciles each month.',
    body: [{ type: 'p', content: ['Revenue is recognized on the close date, not the create date. Weighted value is for forecasting only and is never booked.'] }],
    entityIds: [], links: [], diagrams: [],
  },
  {
    id: 'doc-naming', title: 'Field naming conventions', author: 'Priya',
    updatedAt: '2026-06-09T08:50:00',
    excerpt: 'How fields are named across bases so lookups and formulas stay readable.',
    body: [{ type: 'p', content: ['Use trading names over legal entities, title-case labels, and keep linked-record fields named after the table they point to.'] }],
    entityIds: [], links: [], diagrams: [],
  },
];

// Chat threads — AI conversations about the schema (chat-tab). Scope chips + references
// use real entity/doc ids so the chips open the shared sidebar / docs.
const chatThreads: ChatThread[] = [
  {
    id: 'chat-1', title: 'How do Deals link to Companies?', updatedAt: '2026-06-22T15:10:00',
    scope: [
      { kind: 'entity', id: 'b-deals', name: 'Deals', entityKind: 'table' },
      { kind: 'entity', id: 'b-companies', name: 'Companies', entityKind: 'table' },
      { kind: 'doc', id: 'doc-crm', name: 'Sales CRM — how it fits together' },
    ],
    messages: [
      { id: 'm1', role: 'user', text: 'How do Deals link to Companies, and which fields do reports depend on?' },
      { id: 'm2', role: 'assistant', text: 'Deals link to Companies through the Company field (a linked-record field), with a reciprocal Deals field on Companies, so the two are two-way. Reporting reads Amount and Probability together to compute Weighted Value, so a blank Stage breaks the forecast view.', refs: [
        { kind: 'entity', id: 'f-dl-company', name: 'Company', entityKind: 'field', fieldType: 'multipleRecordLinks' },
        { kind: 'entity', id: 'f-dl-weighted', name: 'Weighted Value', entityKind: 'field', fieldType: 'formula' },
        { kind: 'doc', id: 'doc-crm', name: 'Sales CRM — how it fits together' },
      ] },
      { id: 'm3', role: 'user', text: 'Save this as a doc for the team.' },
      { id: 'm4', role: 'assistant', text: '', convertedDoc: { id: 'doc-crm', title: 'Deals ↔ Companies — link & reporting fields' } },
      { id: 'm5', role: 'user', text: 'Which fields would break the forecast if someone left them blank?' },
      { id: 'm6', role: 'assistant', text: 'Three fields drive the forecast: Stage (a blank stage drops the deal from the pipeline view), Amount, and Probability — Weighted Value multiplies the last two, so a blank in either reads as 0. None of them are required at the field level today, which is why blanks slip through.', refs: [
        { kind: 'entity', id: 'f-dl-stage', name: 'Stage', entityKind: 'field', fieldType: 'singleSelect' },
        { kind: 'entity', id: 'f-dl-amount', name: 'Amount', entityKind: 'field', fieldType: 'currency' },
        { kind: 'entity', id: 'f-dl-prob', name: 'Probability', entityKind: 'field', fieldType: 'percent' },
      ] },
      { id: 'm7', role: 'user', text: 'Does anything else read Amount besides Weighted Value?' },
      { id: 'm8', role: 'assistant', text: 'Yes — the Quotes table looked up Amount through its Deal link, but that table was removed in a later backup, so the lookup no longer resolves. Inside Sales CRM, Weighted Value is the only field that reads Amount directly today.', refs: [
        { kind: 'entity', id: 'b-deals', name: 'Deals', entityKind: 'table' },
        { kind: 'entity', id: 'f-dl-amount', name: 'Amount', entityKind: 'field', fieldType: 'currency' },
      ] },
      { id: 'm9', role: 'user', text: 'Got it. How many deals are missing a Stage right now?' },
      { id: 'm10', role: 'assistant', text: 'I can see the schema, not the live record values, so I can\'t count blanks directly — that needs a view filtered to empty Stage in Airtable. What I can tell you is that Stage has no default and isn\'t required, so blanks are possible. Want me to draft a doc describing the forecast-critical fields and the guardrails to add?' },
    ],
  },
  {
    id: 'chat-2', title: 'Undocumented fields in Operations', updatedAt: '2026-06-21T09:30:00',
    scope: [{ kind: 'entity', id: 'b-ops', name: 'Operations', entityKind: 'base' }],
    messages: [
      { id: 'n1', role: 'user', text: 'What is undocumented in Operations?' },
      { id: 'n2', role: 'assistant', text: 'Most fields in Tickets have no description, including Status, which recently changed type. Documenting Status would help teammates interpret multi-value records.', refs: [
        { kind: 'entity', id: 'o-tickets', name: 'Tickets', entityKind: 'table' },
        { kind: 'entity', id: 'ot-status', name: 'Status', entityKind: 'field', fieldType: 'multiple_select' },
      ] },
      { id: 'n3', role: 'user', text: 'Which tables in Operations have the most undocumented fields?' },
      { id: 'n4', role: 'assistant', text: 'Tickets leads by a wide margin — almost none of its fields carry a description, and it\'s also the largest table. Agents and Queues are smaller and mostly self-explanatory, so they\'re lower priority. If you document one table first, make it Tickets.', refs: [
        { kind: 'entity', id: 'o-tickets', name: 'Tickets', entityKind: 'table' },
        { kind: 'entity', id: 'o-agents', name: 'Agents', entityKind: 'table' },
        { kind: 'entity', id: 'o-queues', name: 'Queues', entityKind: 'table' },
      ] },
      { id: 'n5', role: 'user', text: 'Is Status linked to anything, or is it standalone?' },
      { id: 'n6', role: 'assistant', text: 'Status is a multiple-select field on Tickets, so it\'s standalone — not a linked record. It recently changed from single to multiple select, which means older records may carry a value that is no longer a valid option until someone re-picks it. That\'s the main reason it\'s worth a clear description.', refs: [
        { kind: 'entity', id: 'ot-status', name: 'Status', entityKind: 'field', fieldType: 'multiple_select' },
      ] },
      { id: 'n7', role: 'user', text: 'Makes sense. Can you save a short doc listing what to document first?' },
      { id: 'n8', role: 'assistant', text: 'Sure — I\'d title it "Operations: documentation backlog", lead with Tickets (especially Status and the agent link), then note Agents and Queues as lower priority. Use Convert to doc above and I\'ll drop the linked doc into this thread.' },
    ],
  },
  {
    id: 'chat-arc', title: 'Naming cleanup ideas', updatedAt: '2026-05-30T10:00:00', archived: true, scope: [],
    messages: [
      { id: 'a1', role: 'user', text: 'Suggest naming cleanups for the Leads table.' },
      { id: 'a2', role: 'assistant', text: 'Those suggestions were applied in a later backup, so this thread is archived.' },
    ],
  },
];

// Automations — registered manually (Airtable API can't export them). Grouped by `group`;
// tags reference real table/field ids so the tag-picker + reverse surfacing resolve.
const automations: SchemaAutomation[] = [
  { id: 'autA1b2C3d4E5f6G7', name: 'Notify owner on stage change', baseId: 'b-sales', triggerType: 'When a record matches conditions', status: 'active', enabled: true,
    airtableDescription: 'Notifies the deal owner in Slack whenever a deal moves to a new stage.',
    internalDescription: 'When a deal moves to a new stage, posts a Slack message to the deal owner so nothing stalls silently. Owned by RevOps — if Slack gets noisy we may switch it to a daily digest.',
    subscribers: ['deal-owners@acme.com', 'revops@acme.com'],
    definition: '{\n  "trigger": "recordMatchesConditions",\n  "table": "Deals",\n  "actions": ["slackMessage"]\n}',
    tags: [{ entityId: 'f-dl-company', source: 'auto' }, { entityId: 'b-deals', source: 'manual' }] },
  { id: 'autH8i9J0k1L2m3N4', name: 'Weekly pipeline digest', baseId: 'b-sales', triggerType: 'At a scheduled time', status: 'active', enabled: false,
    airtableDescription: 'Sends a weekly email summary of the sales pipeline.',
    internalDescription: 'Every Monday at 8am, emails the sales team a summary of open deals grouped by stage.',
    subscribers: ['sales-team@acme.com'],
    tags: [{ entityId: 'b-deals', source: 'auto' }] },
  { id: 'autO5p6Q7r8S9t0U1', name: 'Sync new contact to CRM', baseId: 'b-sales', triggerType: 'When a record is created', status: 'active', enabled: true,
    internalDescription: 'When a contact is created, pushes it to the external CRM and links it back to its company.',
    tags: [{ entityId: 'f-ct-company', source: 'auto' }, { entityId: 'b-contacts', source: 'manual' }] },
  { id: 'autV2w3X4y5Z6a7B8', name: 'Archive stale companies', baseId: 'b-sales', status: 'active', enabled: true, triggerType: 'At a scheduled time', tags: [] },
  { id: 'autC9d0E1f2G3h4I5', name: 'Old lead-scoring flow', baseId: 'b-sales', status: 'removed', enabled: false, removedAt: '2026-05-14', tags: [{ entityId: 'b-contacts', source: 'auto' }] },
  { id: 'autMkt00000000A1', name: 'Tag new leads by campaign', baseId: 'b-mktg', triggerType: 'When a record is created', status: 'active', enabled: true,
    internalDescription: 'When a lead comes in, sets its acquisition channel from the campaign that generated it.',
    tags: [{ entityId: 'm-campaigns', source: 'auto' }] },
  { id: 'autOps00000000B2', name: 'Escalate aging tickets', baseId: 'b-ops', triggerType: 'When a record matches conditions', status: 'active', enabled: true,
    internalDescription: 'Escalates a ticket to a lead agent when it stays open past its SLA.',
    subscribers: ['support-leads@acme.com'],
    tags: [{ entityId: 'o-tickets', source: 'auto' }] },
];

// Interfaces — registered manually; Pages nest under their parent Interface.
const interfaces: SchemaInterface[] = [
  { id: 'pblSalesDash00001', name: 'Sales dashboard', type: 'interface', baseId: 'b-sales', status: 'active', published: true,
    internalDescription: 'The main dashboard the sales team uses day-to-day instead of the raw grid — pipeline health, forecasts, and per-deal drill-in.',
    definition: '{\n  "type": "dashboard",\n  "tables": ["Deals", "Companies"]\n}',
    tags: [{ entityId: 'b-deals', source: 'auto' }, { entityId: 'f-dl-company', source: 'manual' }] },
  { id: 'pgePipeline00001', name: 'Pipeline overview', type: 'page', baseId: 'b-sales', parentId: 'pblSalesDash00001', status: 'active', published: true,
    internalDescription: 'A funnel chart of open deals by stage, filterable by owner.',
    tags: [{ entityId: 'b-deals', source: 'auto' }], triggers: ['autH8i9J0k1L2m3N4'] },
  { id: 'pgeDealDetail0001', name: 'Deal detail', type: 'page', baseId: 'b-sales', parentId: 'pblSalesDash00001', status: 'active', published: true,
    internalDescription: 'A record-review screen for a single deal — its company, contacts, and activity.',
    tags: [{ entityId: 'f-dl-company', source: 'auto' }], triggers: ['autA1b2C3d4E5f6G7'] },
  { id: 'pgeForecast000001', name: 'Forecast (archived)', type: 'page', baseId: 'b-sales', parentId: 'pblSalesDash00001', status: 'removed', published: false, removedAt: '2026-04-30', tags: [] },
  { id: 'pblContactPortal1', name: 'Contact portal', type: 'interface', baseId: 'b-sales', status: 'active', published: true,
    internalDescription: 'A lightweight portal for the support team to look up contacts without touching the base.',
    tags: [{ entityId: 'f-ct-company', source: 'manual' }] },
  { id: 'pgeContactHome001', name: 'Contact home', type: 'page', baseId: 'b-sales', parentId: 'pblContactPortal1', status: 'active', published: true, tags: [] },
  { id: 'pblMktMonitor0001', name: 'Campaign monitor', type: 'interface', baseId: 'b-mktg', status: 'active', published: true,
    internalDescription: 'A live view of campaign performance for the marketing team.',
    tags: [{ entityId: 'm-campaigns', source: 'auto' }] },
  { id: 'pgeMktOverview01', name: 'Channel overview', type: 'page', baseId: 'b-mktg', parentId: 'pblMktMonitor0001', status: 'active', published: false,
    internalDescription: 'Spend and conversions by acquisition channel. Still a work in progress — not yet published to the team.',
    tags: [{ entityId: 'm-channels', source: 'auto' }] },
];

export {
  schemaBases, multiTables, health, changelog, relationships,
  schemaDocs, chatThreads, automations, interfaces,
};
