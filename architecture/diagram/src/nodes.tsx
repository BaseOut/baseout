import { Handle, Position, type NodeProps } from '@xyflow/react'
import { STATUS_LABEL, type GroupNodeType, type NoteNodeType, type ServiceNodeType } from './types'

/**
 * A source AND a target handle on every side, so an edge can run in any
 * direction — including right-to-left and bottom-to-top, which the runtime
 * callback flow needs. Ids are consumed by `edge()` in types.ts; the two kinds
 * share a position, so they are offset slightly to stay individually hoverable.
 */
function Ports() {
  return (
    <>
      <Handle type="target" id="tl" position={Position.Left} style={{ top: '40%' }} />
      <Handle type="target" id="tt" position={Position.Top} style={{ left: '40%' }} />
      <Handle type="target" id="tr" position={Position.Right} style={{ top: '40%' }} />
      <Handle type="target" id="tb" position={Position.Bottom} style={{ left: '40%' }} />
      <Handle type="source" id="sl" position={Position.Left} style={{ top: '60%' }} />
      <Handle type="source" id="st" position={Position.Top} style={{ left: '60%' }} />
      <Handle type="source" id="sr" position={Position.Right} style={{ top: '60%' }} />
      <Handle type="source" id="sb" position={Position.Bottom} style={{ left: '60%' }} />
    </>
  )
}

export function ServiceNode({ data, selected }: NodeProps<ServiceNodeType>) {
  const status = data.status ?? 'live'
  return (
    <div className={`n-svc s-${status}${selected ? ' is-sel' : ''}`}>
      <Ports />
      <div className="n-head">
        <span className="n-label">{data.label}</span>
        {data.tag ? <span className="n-tag">{data.tag}</span> : null}
      </div>
      {data.sub ? <div className="n-sub">{data.sub}</div> : null}
      <span className="n-status">{STATUS_LABEL[status]}</span>
    </div>
  )
}

export function GroupNode({ data }: NodeProps<GroupNodeType>) {
  return (
    <div className={`n-group g-${data.tone ?? 'neutral'}`}>
      <div className="g-label">
        {data.label}
        {data.sub ? <span className="g-sub">{data.sub}</span> : null}
      </div>
    </div>
  )
}

export function NoteNode({ data }: NodeProps<NoteNodeType>) {
  return (
    <div className="n-note">
      <Ports />
      {data.label}
    </div>
  )
}

export const nodeTypes = {
  service: ServiceNode,
  group: GroupNode,
  note: NoteNode,
}
