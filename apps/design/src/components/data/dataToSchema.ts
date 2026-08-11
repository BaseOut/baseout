/**
 * dataToSchema — adapters that let the Data page REUSE the Schema Docs + Chat surfaces
 * unchanged. Those components are driven by a SchemaEntity index (built from SchemaTable[]),
 * so we project the Data page's own tables/fields into that shape and build the same index.
 * No new Docs/Chat UI — the Data tabs render the exact Schema components, scoped to data.
 */
import type { SchemaTable } from './../schema/SchemaCanvas';
import { buildEntityIndex, type SchemaEntity, type SchemaDoc } from './../schema/schemaEntities';
import type { DataBase, DataTable } from './dataTypes';

/** Project Data tables into the SchemaTable shape the entity index + Docs/Chat expect. */
export function dataTablesToSchema(tables: DataTable[]): SchemaTable[] {
  return tables.map((t) => ({
    id: t.id,
    name: t.name,
    baseId: t.baseId,
    health: 'green' as const,
    fieldCount: t.fields.length,
    recordCount: t.approxRecordCount,
    fields: t.fields.map((f, i) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      isPrimary: i === 0,
      linkedTableId: f.linkedTableId,
    })),
  }));
}

/** Build the shared entity index the Docs/Chat surfaces consume, scoped to Data. */
export function buildDataIndex(bases: DataBase[], tables: DataTable[], docs: SchemaDoc[] = []): SchemaEntity[] {
  return buildEntityIndex(bases, dataTablesToSchema(tables), docs);
}
