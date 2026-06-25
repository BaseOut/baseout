/**
 * DocDiagram — React Flow mini-diagram canvas for a document
 * (openspec/changes/shared-schema-docs §5). React island. Serializes
 * {nodes, edges} → bo_at_document_diagrams.state (opaque JSON to the engine).
 * Seeded by DocsTab with a node per tagged table; the author arranges them.
 */

import * as React from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DiagramState } from '../../lib/schema-docs/editor-logic'

export interface DocDiagramProps {
  initial?: DiagramState | null
  onChange: (state: DiagramState) => void
}

export default function DocDiagram({ initial, onChange }: DocDiagramProps) {
  const [nodes, , onNodesChange] = useNodesState<Node>((initial?.nodes as Node[]) ?? [])
  const [edges, , onEdgesChange] = useEdgesState<Edge>((initial?.edges as Edge[]) ?? [])

  // Serialize on every node/edge change so DocsTab's save sends current state.
  React.useEffect(() => {
    onChange({ nodes, edges })
  }, [nodes, edges, onChange])

  return (
    <div className="h-64 overflow-hidden rounded-box border border-base-300">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
