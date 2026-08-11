// Pure mapping from captured Airtable field options (bo_at_fields.options jsonb)
// to the flat per-field config the schema-read broker emits
// (server-schema-read-enrichment). Option keys mirror the shapes already handled
// by lib/per-space/relationships.ts: linkedTableId, recordLinkFieldId,
// fieldIdInLinkedTable, referencedFieldIds. Never throws — malformed or absent
// options degrade to all-null config.

export interface FieldConfig {
  linkedTableId: string | null;
  /** Link fields only: false when Airtable prefersSingleRecordLink, true otherwise. */
  allowsMultiple: boolean | null;
  inverseFieldId: string | null;
  formula: string | null;
  referencedFieldIds: string[] | null;
  lookupViaFieldId: string | null;
  lookupTargetFieldId: string | null;
  /** Select-type fields only: the choice names. */
  choices: string[] | null;
}

const NULL_CONFIG: FieldConfig = {
  linkedTableId: null,
  allowsMultiple: null,
  inverseFieldId: null,
  formula: null,
  referencedFieldIds: null,
  lookupViaFieldId: null,
  lookupTargetFieldId: null,
  choices: null,
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string");
  return out;
}

export function extractFieldConfig(type: string, options: unknown): FieldConfig {
  const opts = asRecord(options);

  switch (type) {
    case "multipleRecordLinks": {
      const linkedTableId = str(opts.linkedTableId);
      if (!linkedTableId) return { ...NULL_CONFIG };
      return {
        ...NULL_CONFIG,
        linkedTableId,
        allowsMultiple: opts.prefersSingleRecordLink !== true,
        inverseFieldId: str(opts.inverseLinkFieldId),
      };
    }
    case "singleSelect":
    case "multipleSelects": {
      if (!Array.isArray(opts.choices)) return { ...NULL_CONFIG };
      const choices = opts.choices
        .map((c) => str(asRecord(c).name))
        .filter((n): n is string => n !== null);
      return { ...NULL_CONFIG, choices };
    }
    case "formula": {
      return {
        ...NULL_CONFIG,
        formula: str(opts.formula),
        referencedFieldIds: strArray(opts.referencedFieldIds),
      };
    }
    case "rollup":
    case "multipleLookupValues": {
      return {
        ...NULL_CONFIG,
        lookupViaFieldId: str(opts.recordLinkFieldId),
        lookupTargetFieldId: str(opts.fieldIdInLinkedTable),
      };
    }
    case "count": {
      return { ...NULL_CONFIG, lookupViaFieldId: str(opts.recordLinkFieldId) };
    }
    default:
      return { ...NULL_CONFIG };
  }
}
