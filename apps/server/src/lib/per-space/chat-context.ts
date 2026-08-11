// Pure chat-context assembly (server-schema-chat).
//
// Builds the metadata-only context the AI sees for a chat turn: the scoped
// schema slice (entity names / types / descriptions — NEVER record data) plus any
// attached doc summaries. Pure (no DB, no AI): the engine reads the rows + docs
// and passes them in; the workflows chat-respond task receives the assembled
// string in its payload. Sovereign-AI: only metadata leaves the Space.

export interface ChatScope {
  baseIds?: string[];
  tableIds?: string[];
  fieldIds?: string[];
}

export interface CtxBase {
  baseId: string;
  name: string;
  description?: string | null;
}
export interface CtxTable {
  tableId: string;
  baseId: string;
  name: string;
  description?: string | null;
}
export interface CtxField {
  fieldId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string;
  description?: string | null;
}
export interface CtxDoc {
  title: string;
  excerpt?: string | null;
}

function hasScope(s: ChatScope | null | undefined): boolean {
  return !!s && ((s.baseIds?.length ?? 0) + (s.tableIds?.length ?? 0) + (s.fieldIds?.length ?? 0) > 0);
}

/**
 * Assemble the metadata-only context string for a chat turn. When `scope` is
 * empty/null the whole Space's schema is included ("Whole Space"); otherwise it
 * is filtered to the scoped bases/tables/fields (a table is in scope if its id or
 * its base is scoped; a field if its id, its table, or its base is scoped).
 * `maxFields` caps the field lines to keep the prompt bounded.
 */
export function assembleChatContext(input: {
  scope?: ChatScope | null;
  bases: CtxBase[];
  tables: CtxTable[];
  fields: CtxField[];
  docs?: CtxDoc[];
  maxFields?: number;
}): string {
  const scope = input.scope ?? null;
  const scoped = hasScope(scope);
  const baseIds = new Set(scope?.baseIds ?? []);
  const tableIds = new Set(scope?.tableIds ?? []);
  const fieldIds = new Set(scope?.fieldIds ?? []);
  const maxFields = input.maxFields ?? 400;

  // A table is also in scope when it holds a scoped field (field-level scope).
  const tablesWithScopedField = new Set(
    input.fields.filter((f) => fieldIds.has(f.fieldId)).map((f) => f.tableId),
  );
  const tableInScope = (t: CtxTable) =>
    !scoped ||
    baseIds.has(t.baseId) ||
    tableIds.has(t.tableId) ||
    tablesWithScopedField.has(t.tableId);
  const fieldInScope = (f: CtxField) =>
    !scoped ||
    baseIds.has(f.baseId) ||
    tableIds.has(f.tableId) ||
    fieldIds.has(f.fieldId);

  const tables = input.tables.filter(tableInScope);
  const tableIdsInScope = new Set(tables.map((t) => t.tableId));
  let fields = input.fields.filter((f) => tableIdsInScope.has(f.tableId) && fieldInScope(f));

  let truncatedNote = "";
  if (fields.length > maxFields) {
    truncatedNote = `\n(${fields.length - maxFields} more fields omitted for length)`;
    fields = fields.slice(0, maxFields);
  }

  const fieldsByTable = new Map<string, CtxField[]>();
  for (const f of fields) {
    const list = fieldsByTable.get(f.tableId);
    if (list) list.push(f);
    else fieldsByTable.set(f.tableId, [f]);
  }
  const tablesByBase = new Map<string, CtxTable[]>();
  for (const t of tables) {
    const list = tablesByBase.get(t.baseId);
    if (list) list.push(t);
    else tablesByBase.set(t.baseId, [t]);
  }

  const lines: string[] = [];
  lines.push(scoped ? "Schema context (scoped):" : "Schema context (whole Space):");

  const bases = input.bases.filter((b) => !scoped || baseIds.has(b.baseId) || tablesByBase.has(b.baseId));
  for (const b of bases) {
    lines.push(`\nBase: ${b.name}${b.description ? ` — ${b.description}` : ""}`);
    for (const t of tablesByBase.get(b.baseId) ?? []) {
      lines.push(`  Table: ${t.name}${t.description ? ` — ${t.description}` : ""}`);
      for (const f of fieldsByTable.get(t.tableId) ?? []) {
        lines.push(`    - ${f.name} (${f.type})${f.description ? `: ${f.description}` : ""}`);
      }
    }
  }
  if (truncatedNote) lines.push(truncatedNote);

  const docs = input.docs ?? [];
  if (docs.length > 0) {
    lines.push("\nAttached docs:");
    for (const d of docs) {
      lines.push(`  • ${d.title}${d.excerpt ? `: ${d.excerpt}` : ""}`);
    }
  }

  return lines.join("\n");
}
