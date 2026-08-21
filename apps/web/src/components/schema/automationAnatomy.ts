/**
 * automationAnatomy — the normalized "what fires this, what does it touch" shape,
 * and the defensive reader that produces it.
 *
 * WHY THIS FILE EXISTS SEPARATELY
 * The same automation object is declared in four places (SchemaAutomations.astro,
 * schemaAutomations.ts, schemaReadBody.ts's AutomationLike, and the interface twins),
 * and none of them import from each other. Adding the anatomy fields to each by hand
 * would be a fifth copy waiting to drift. Instead the shape is declared ONCE here and
 * the declarations extend it.
 *
 * WHY IT IS NOT A PARSER (yet)
 * `definition` is an opaque pre-stringified JSON blob whose envelope comes from the
 * baseout MCP spikes — and those envelope fixtures do not exist in this repo. Writing
 * a parser against a shape nobody has recorded would be inventing a contract. So the
 * normalized fields are supplied directly (the same way `tags[].source: 'auto'` already
 * carries engine-derived data), and `readAnatomy()` is the seam: when the real envelope
 * lands, it grows a parse branch and no panel code changes.
 */

/** How much the capture actually gave us. Explicit, because "nothing to show" and
 *  "we could not read this" are different facts that must render differently — and
 *  inferring them from absent fields collapses them into one blank. */
export type CaptureDepth = 'full' | 'inventory' | 'unknown';

export interface AnatomyTrigger {
  /** Human trigger label, Airtable's own vocabulary — "When a record is updated". */
  type: string;
  /** Table the trigger watches. Entity id from the schema index, when resolvable. */
  tableId?: string;
  /** Fields the trigger watches. Entity ids from the schema index. */
  watchedFieldIds?: string[];
}

/** One table the entity reaches, with the fields it reaches inside it. Grouped by
 *  table because a flat list of fields loses the structure that makes it readable. */
export interface AnatomyTouch {
  tableId: string;
  fieldIds?: string[];
}

export interface AnatomyActionSummary {
  /** Total number of actions. Rendered as a count, never as steps. */
  count: number;
  /** Action type labels — "update record", "send email", "run script". */
  types: string[];
}

/** Mixed into SchemaAutomation / SchemaInterface. All optional: an inventory-grade
 *  capture legitimately carries none of it. */
export interface AnatomyFields {
  captureDepth?: CaptureDepth;
  trigger?: AnatomyTrigger;
  touches?: AnatomyTouch[];
  actionSummary?: AnatomyActionSummary;
}

/** What the panel actually renders from. `depth` is always resolved. */
export interface Anatomy {
  depth: CaptureDepth;
  trigger?: AnatomyTrigger;
  touches: AnatomyTouch[];
  actionSummary?: AnatomyActionSummary;
  /** True when an action type reads as a script — the field list is then only what the
   *  configuration declared, and the panel must say so. A script can reach anything. */
  hasScript: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Read the anatomy off an entity. Never throws, never guesses: an unreadable shape
 * resolves to `unknown` (which renders one honest line), and a capture that simply
 * carries nothing resolves to `inventory` (which renders nothing at all).
 */
export function readAnatomy(src: unknown): Anatomy {
  const empty: Anatomy = { depth: 'inventory', touches: [], hasScript: false };
  if (!isObj(src)) return empty;

  // An explicit depth from the capture wins — the engine knows better than we can infer.
  const declared = src.captureDepth;
  if (declared === 'unknown') return { depth: 'unknown', touches: [], hasScript: false };

  const trigger = isObj(src.trigger) && typeof src.trigger.type === 'string'
    ? {
        type: src.trigger.type,
        tableId: typeof src.trigger.tableId === 'string' ? src.trigger.tableId : undefined,
        watchedFieldIds: strArr(src.trigger.watchedFieldIds),
      }
    : undefined;

  const touches: AnatomyTouch[] = Array.isArray(src.touches)
    ? src.touches
        .filter(isObj)
        .filter((t): t is Record<string, unknown> & { tableId: string } => typeof t.tableId === 'string')
        .map((t) => ({ tableId: t.tableId, fieldIds: strArr(t.fieldIds) }))
    : [];

  const rawSummary = src.actionSummary;
  const actionSummary = isObj(rawSummary) && typeof rawSummary.count === 'number'
    ? { count: rawSummary.count, types: strArr(rawSummary.types) }
    : undefined;

  const hasAny = !!trigger || touches.length > 0 || !!actionSummary;
  // Declared 'full' but carrying nothing is itself a shape we could not read — say so
  // rather than rendering a strip of empty sections.
  if (declared === 'full' && !hasAny) return { depth: 'unknown', touches: [], hasScript: false };
  if (!hasAny) return empty;

  return {
    depth: 'full',
    trigger,
    touches,
    actionSummary,
    hasScript: (actionSummary?.types ?? []).some((t) => /script/i.test(t)),
  };
}
