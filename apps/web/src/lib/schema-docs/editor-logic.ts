// Pure logic behind the DocsTab island (openspec/changes/shared-schema-docs §5).
// No React / Plate / React Flow imports, so it's unit-testable in plain Node.

import type { SchemaDoc, SchemaDocTargetType } from '../backup-engine'

export interface EditorTag {
  targetType: SchemaDocTargetType
  targetId: string
  addedVia: 'inline' | 'manual'
  entityRemoved?: boolean
}
export interface EditorLink {
  name: string
  url: string
}
/** Structural shape of a serialized React Flow diagram (opaque to the engine). */
export interface DiagramState {
  nodes: unknown[]
  edges: unknown[]
}
export interface EditorDiagram {
  name: string
  state: DiagramState
}
export interface DiagramNode {
  id: string
  position: { x: number; y: number }
  data: { label: string }
}
export interface EditorState {
  id: string
  title: string
  // Plate Value (array of nodes); kept as unknown[] to avoid a Plate import here.
  body: unknown[]
  tags: EditorTag[]
  links: EditorLink[]
  diagrams: EditorDiagram[]
}

const EMPTY_BODY: unknown[] = [{ type: 'p', children: [{ text: '' }] }]

/** Normalize a loaded document into editor state with safe defaults. */
export function toEditorState(doc: SchemaDoc): EditorState {
  return {
    id: doc.id,
    title: doc.title,
    body: Array.isArray(doc.body) && doc.body.length > 0 ? (doc.body as unknown[]) : [...EMPTY_BODY],
    tags: (doc.tags ?? []).map((t) => ({
      targetType: t.targetType as SchemaDocTargetType,
      targetId: t.targetId,
      addedVia: (t.addedVia as 'inline' | 'manual') ?? 'manual',
      entityRemoved: t.entityRemoved,
    })),
    links: (doc.links ?? []).map((l) => ({ name: l.name ?? '', url: l.url })),
    diagrams: (doc.diagrams ?? []).map((d) => ({
      name: d.name ?? 'Diagram',
      state: (d.state as DiagramState) ?? { nodes: [], edges: [] },
    })),
  }
}

/** Append an entity tag unless that (type, id) is already tagged. */
export function addTagUnique(
  tags: EditorTag[],
  targetType: SchemaDocTargetType,
  targetId: string,
): EditorTag[] {
  if (tags.some((t) => t.targetType === targetType && t.targetId === targetId)) return tags
  return [...tags, { targetType, targetId, addedVia: 'manual' }]
}

/** Seed a diagram node per tagged TABLE, laid out in a simple grid. */
export function seedDiagramNodes(
  tags: EditorTag[],
  labelFor: (key: string) => string,
): DiagramNode[] {
  return tags
    .filter((t) => t.targetType === 'table')
    .map((t, i) => ({
      id: t.targetId,
      position: { x: 40 + (i % 3) * 180, y: 40 + Math.floor(i / 3) * 120 },
      data: { label: labelFor(`table:${t.targetId}`) },
    }))
}
