import { MarkerType, type Edge, type Node } from '@xyflow/react'

/**
 * Status vocabulary is the same one architecture/systems-overview.md uses, so a
 * node's colour means exactly what the doc's table says.
 */
export type Status = 'live' | 'built' | 'proposed' | 'external' | 'infra'

/** Index signature keeps this assignable to ReactFlow's Record<string, unknown>. */
export interface ServiceData {
  label: string
  sub?: string
  status?: Status
  /** Short glyph rendered in the corner — plain text, no icon font. */
  tag?: string
  [key: string]: unknown
}

export interface GroupData {
  label: string
  sub?: string
  tone?: 'staging' | 'production' | 'neutral' | 'danger'
  [key: string]: unknown
}

export interface NoteData {
  label: string
  [key: string]: unknown
}

export type ServiceNodeType = Node<ServiceData, 'service'>
export type GroupNodeType = Node<GroupData, 'group'>
export type NoteNodeType = Node<NoteData, 'note'>
export type AnyNode = ServiceNodeType | GroupNodeType | NoteNodeType

export interface Diagram {
  id: string
  label: string
  /** One sentence shown under the tab bar — orients before the reader zooms. */
  blurb: string
  nodes: AnyNode[]
  edges: Edge[]
}

// ── builders ────────────────────────────────────────────────────────────────
// Terse helpers so each diagram file reads as data, not as boilerplate.

export function svc(
  id: string,
  x: number,
  y: number,
  data: ServiceData,
  parentId?: string,
): ServiceNodeType {
  return {
    id,
    type: 'service',
    position: { x, y },
    data,
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
  }
}

export function group(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  data: GroupData,
): GroupNodeType {
  return {
    id,
    type: 'group',
    position: { x, y },
    data,
    style: { width, height },
    // Groups must not intercept clicks meant for their children.
    selectable: false,
    draggable: false,
  }
}

export function note(id: string, x: number, y: number, label: string, width = 260): NoteNodeType {
  return {
    id,
    type: 'note',
    position: { x, y },
    data: { label },
    style: { width },
    selectable: false,
  }
}

/**
 * Every node carries a source AND a target handle on all four sides, so an edge
 * can run in any direction. Ids are prefixed to keep the two kinds distinct at
 * the same position: `s*` = source, `t*` = target.
 */
export type SourceSide = 'sl' | 'st' | 'sr' | 'sb'
export type TargetSide = 'tl' | 'tt' | 'tr' | 'tb'

interface EdgeOpts {
  label?: string
  /** 'solid' = request/data path, 'dashed' = async or build-time, 'thick' = the critical path. */
  kind?: 'solid' | 'dashed' | 'thick'
  from?: SourceSide
  to?: TargetSide
  animated?: boolean
}

export function edge(id: string, source: string, target: string, o: EdgeOpts = {}): Edge {
  const kind = o.kind ?? 'solid'
  return {
    id,
    source,
    target,
    sourceHandle: o.from ?? 'sr',
    targetHandle: o.to ?? 'tl',
    label: o.label,
    animated: o.animated ?? false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    className: `e-${kind}`,
    // Colour + width come from CSS so the two themes stay in one place.
    style: kind === 'thick' ? { strokeWidth: 2.5 } : undefined,
    labelStyle: { fontSize: 10 },
  }
}

export const STATUS_LABEL: Record<Status, string> = {
  live: 'Live',
  built: 'Built',
  proposed: 'Proposed',
  external: 'External',
  infra: 'Infra',
}
