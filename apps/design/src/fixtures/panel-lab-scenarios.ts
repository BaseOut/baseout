// Panel Lab scenarios — the curated button list for /panels, plus a lab-only
// worst-case table so we can stress-test the canon (Dan: a formula can reference 50 fields).
// The panels themselves are the REAL @web components; only this fixture augmentation is lab-local.
// Logic lives here (not in panels.astro frontmatter) to keep the .astro thin.
import type { SchemaTable } from '../components/schema/SchemaCanvas';
import { multiTables } from './schema-lab';

// A lab-only "Kitchen Sink" table on Sales CRM: 50 plain fields + one formula that
// references ALL of them — the worst-case References list Goal 3 will cap with "+N more".
const KS_FIELDS = Array.from({ length: 50 }, (_, i) => ({
  id: `f-ks-${i + 1}`,
  name: `Metric ${String(i + 1).padStart(2, '0')}`,
  type: 'number' as const,
}));
const kitchenSink: SchemaTable = {
  id: 'b-kitchen', name: 'Kitchen Sink (lab)', baseId: 'b-sales', health: 'amber',
  recordCount: 12, fieldCount: 51,
  description: 'Lab-only table used by the Panel Lab to exercise worst-case data volumes.',
  fields: [
    { id: 'f-ks-name', name: 'Name', type: 'single_line_text', isPrimary: true },
    ...KS_FIELDS,
    {
      id: 'f-ks-mega', name: 'Mega Formula', type: 'formula',
      formula: KS_FIELDS.map((f) => `{${f.name}}`).join(' + '),
      referencedFieldIds: KS_FIELDS.map((f) => f.id),
      airtableDescription:
        ('Worst-case demo: a formula that sums 50 fields. This description is intentionally enormous so the panel exercises the grow-to-max-then-inner-scroll rule from the canon. '
          + 'In a real base a field description can run to many paragraphs of context: what the field means, how it is calculated, which reports read it, the edge cases teammates keep hitting, and the history of why it was changed. ').repeat(6),
    },
  ],
};

/** Tables passed to the Lab's SchemaView — the real Space plus the worst-case table. */
export const labTables: SchemaTable[] = [...multiTables, kitchenSink];

// `tab` (optional) = a Schema tab to activate BEFORE opening, for panels nested inside a
// tab section (Automations/Interfaces drawers, Changelog detail) that are display:none until
// their tab is active. Page-level panels (EntityPanel/Relationship/Chat) don't need it.
export type LabTrigger =
  | { kind: 'event'; event: string; id: string; tab?: string }
  | { kind: 'click'; selector: string; tab?: string }
  | { kind: 'clickMatch'; selector: string; attr: string; contains: string; tab?: string }
  | { kind: 'attr'; selector: string; attr: string; value: string; tab?: string }
  // Multi-panel (pattern-multi-panel-drawer): run steps in order with a short wait between
  // each (open an anchor, then click a reference row inside it to spawn the focus panel).
  | { kind: 'sequence'; steps: LabTrigger[]; tab?: string };

export interface LabScenario {
  label: string;
  note?: string;
  trigger: LabTrigger;
}
export interface LabGroup {
  panel: string;
  hint: string;
  scenarios: LabScenario[];
}

const ev = (event: string, id: string, tab?: string): LabTrigger => ({ kind: 'event', event, id, ...(tab ? { tab } : {}) });

export const SCENARIOS: LabGroup[] = [
  {
    panel: 'Multi-panel (Anchor + Focus)',
    hint: 'Side-by-side drawers, capped at 2. Opens an anchor then drills a reference inside it to spawn the focus — then keep drilling inside the focus (it navigates in place, never a 3rd panel). Drag a panel’s left edge to resize; the round button on the anchor balances 50/50.',
    scenarios: [
      {
        label: 'Anchor + Focus (table → field)',
        note: 'Companies pinned left · a field opens right',
        trigger: { kind: 'sequence', steps: [
          ev('schema:openEntity', 'b-companies'),
          { kind: 'click', selector: '.ep-sheet[data-ep-role="anchor"] [data-ep-push="f-co-pipeline"]' },
        ] },
      },
      {
        label: 'Anchor + Focus (formula → reference)',
        note: 'drill a formula, then its referenced field in the focus',
        trigger: { kind: 'sequence', steps: [
          ev('schema:openEntity', 'f-co-pipeline'),
          { kind: 'click', selector: '.ep-sheet[data-ep-role="anchor"] [data-ep-push]' },
        ] },
      },
    ],
  },
  {
    panel: 'EntityPanel',
    hint: 'The field / table / base detail sidecart (schema:openEntity).',
    scenarios: [
      { label: 'Field — currency', trigger: ev('schema:openEntity', 'f-dl-amount') },
      { label: 'Field — formula (2 refs)', trigger: ev('schema:openEntity', 'f-dl-weighted') },
      { label: 'Field — LARGE formula (50 refs)', note: 'worst-case References list', trigger: ev('schema:openEntity', 'f-ks-mega') },
      { label: 'Field — long paragraph description', note: 'grow-to-max then inner-scroll', trigger: ev('schema:openEntity', 'f-ks-mega') },
      { label: 'Field — rollup (dual)', trigger: ev('schema:openEntity', 'f-co-pipeline') },
      { label: 'Field — lookup', trigger: ev('schema:openEntity', 'f-dl-coindustry') },
      { label: 'Field — removed', trigger: ev('schema:openEntity', 'f-co-legacy') },
      { label: 'Table — Companies', trigger: ev('schema:openEntity', 'b-companies') },
      { label: 'Table — many children (Deals · 12)', trigger: ev('schema:openEntity', 'b-deals') },
      { label: 'Base — Sales CRM', trigger: ev('schema:openEntity', 'b-sales') },
    ],
  },
  {
    panel: 'RelationshipPanel',
    hint: 'The relationship detail overlay (schema:openRelationship).',
    scenarios: [
      { label: 'Valid — linked records', trigger: ev('schema:openRelationship', 'rel-deals-companies') },
      { label: 'Inferred — Confirm/Dismiss', trigger: ev('schema:openRelationship', 'rel-tickets-queues') },
      { label: 'Invalid / removed history', trigger: ev('schema:openRelationship', 'rel-quotes-deals') },
      { label: 'Formula — linked fields', trigger: ev('schema:openRelationship', 'rel-deals-weighted') },
      { label: 'Rollup — dual (cross + same table)', trigger: ev('schema:openRelationship', 'rel-companies-pipeline') },
    ],
  },
  {
    panel: 'Automations drawer',
    hint: 'The #au-modal read drawer (schema:openAutomation).',
    scenarios: [
      { label: 'Read — subscribers + JSON', trigger: ev('schema:openAutomation', 'autA1b2C3d4E5f6G7', 'automations') },
      { label: 'Minimal — no description', trigger: ev('schema:openAutomation', 'autV2w3X4y5Z6a7B8', 'automations') },
      { label: 'Removed', trigger: ev('schema:openAutomation', 'autC9d0E1f2G3h4I5', 'automations') },
    ],
  },
  {
    panel: 'Interfaces drawer',
    hint: 'The #if-modal read drawer (schema:openInterface).',
    scenarios: [
      { label: 'Interface — Sales dashboard', trigger: ev('schema:openInterface', 'pblSalesDash00001', 'interfaces') },
      { label: 'Page — with breadcrumb', trigger: ev('schema:openInterface', 'pgePipeline00001', 'interfaces') },
      { label: 'Page — not published', trigger: ev('schema:openInterface', 'pgeMktOverview01', 'interfaces') },
      { label: 'Page — removed', trigger: ev('schema:openInterface', 'pgeForecast000001', 'interfaces') },
    ],
  },
  {
    panel: 'Changelog detail',
    hint: 'The .cl-detail entry overlay (no event — clicks a feed row).',
    scenarios: [
      { label: 'Added — new table', trigger: { kind: 'clickMatch', selector: '[data-cl-entry]', attr: 'summary', contains: 'Q2 Forecast', tab: 'changelog' } },
      { label: 'Before → After — formula', trigger: { kind: 'clickMatch', selector: '[data-cl-entry]', attr: 'summary', contains: 'Weighted Value formula', tab: 'changelog' } },
      { label: 'With warning — type changed', trigger: { kind: 'clickMatch', selector: '[data-cl-entry]', attr: 'summary', contains: 'Status” type changed', tab: 'changelog' } },
    ],
  },
  {
    panel: 'Chat quick-ask drawer',
    hint: 'The .scd right drawer (data-chat="drawer").',
    scenarios: [
      { label: 'Open quick-ask', trigger: { kind: 'click', selector: '[data-sch-ask]' } },
    ],
  },
];
