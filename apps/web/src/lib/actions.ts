/**
 * Actions — the example operations shown on the /actions landing page (web-actions).
 *
 * Promoted verbatim from the ui-only design fork (ui-only@7502f81, fixtures/actions.ts). These
 * are DRAFTED PROPOSALS pending sign-off (research/plan-readonly-actions.md) — copy them
 * verbatim; do not add, embellish, reword, or phrase one as a benefit. Each is something Baseout
 * could actually do with data it already holds. When the action runtime lands (V2), this list is
 * replaced by the real operation catalog.
 */
export interface ActionExample {
  /** The operation, named the way a person would name it. */
  name: string;
  /** A clause saying what it acts on or where the data comes from. Never a benefit. */
  detail: string;
}

export const ACTION_EXAMPLES: ActionExample[] = [
  {
    name: 'Publish internal notes as Airtable descriptions',
    detail: 'take the notes written in Baseout and write them into Airtable.',
  },
  {
    name: 'Fill missing descriptions',
    detail: 'every field and table that has none.',
  },
  {
    name: 'Delete unused fields',
    detail: 'Schema ▸ Health already flags fields with no values and no references.',
  },
  {
    name: 'Restore a description from an earlier backup',
    detail: 'someone overwrote it; we hold the old one.',
  },
  {
    name: 'Apply a naming convention',
    detail: 'rename fields to a chosen casing across a base.',
  },
  {
    name: 'Copy a description to every base where the same field name appears',
    detail: 'for teams running the same schema in several bases.',
  },
];
