/**
 * Schema page first paint — Browse + Visualize only need getSchema.
 * Per-base relationships / changelog / health are O(bases) engine calls and
 * must not run before the shell swaps (they belong on SchemaAux).
 */
import type {
  GetSchemaResult,
  ListDocumentsResult,
  SchemaDocSummary,
  SchemaEntityBase,
  SchemaEntityField,
  SchemaEntityTable,
  SchemaEntityView,
} from '../backup-engine'

export interface SchemaFirstPaintEngine {
  getSchema(spaceId: string): Promise<GetSchemaResult>
  listDocuments?(spaceId: string): Promise<ListDocumentsResult>
}

export interface SchemaFirstPaint {
  docs: SchemaDocSummary[]
  schema: {
    bases: SchemaEntityBase[]
    tables: SchemaEntityTable[]
    fields: SchemaEntityField[]
    views: SchemaEntityView[]
  }
  viewState: 'ok' | 'not_ready' | 'unconfigured' | 'error'
}

const emptySchema = {
  bases: [] as SchemaEntityBase[],
  tables: [] as SchemaEntityTable[],
  fields: [] as SchemaEntityField[],
  views: [] as SchemaEntityView[],
}

export async function loadSchemaFirstPaint(
  engine: SchemaFirstPaintEngine,
  spaceId: string,
  opts: { includeDocuments?: boolean } = {},
): Promise<SchemaFirstPaint> {
  const docsP =
    opts.includeDocuments && engine.listDocuments
      ? engine.listDocuments(spaceId)
      : Promise.resolve(null)
  const [schemaRes, docsRes] = await Promise.all([engine.getSchema(spaceId), docsP])

  let viewState: SchemaFirstPaint['viewState'] = 'ok'
  if (docsRes && !docsRes.ok && docsRes.code === 'space_db_not_ready') viewState = 'not_ready'
  else if (!schemaRes.ok && docsRes && !docsRes.ok) viewState = 'error'

  return {
    docs: docsRes?.ok ? docsRes.documents : [],
    schema: schemaRes.ok
      ? {
          bases: schemaRes.bases,
          tables: schemaRes.tables,
          fields: schemaRes.fields,
          views: schemaRes.views,
        }
      : emptySchema,
    viewState,
  }
}
