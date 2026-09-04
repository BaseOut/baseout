import { useMemo, useState } from 'react'
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from './nodes'
import { STATUS_LABEL, type Status } from './types'
import { overview } from './diagrams/overview'
import { environments } from './diagrams/environments'
import { workers } from './diagrams/workers'
import { dataNetwork } from './diagrams/data-network'
import { storage } from './diagrams/storage'
import { auth } from './diagrams/auth'
import { codeDeployment } from './diagrams/code-deployment'
import { backgroundCicd } from './diagrams/background-cicd'

// Overview first — it is the tab the URL lands on.
const DIAGRAMS = [overview, environments, workers, auth, dataNetwork, storage, backgroundCicd, codeDeployment]

const LEGEND: Status[] = ['live', 'built', 'proposed', 'external', 'infra']

/** Hash routing so a tab is linkable — #workers opens the Workers tab. */
function initialIndex(): number {
  const id = window.location.hash.replace(/^#/, '')
  const i = DIAGRAMS.findIndex((d) => d.id === id)
  return i >= 0 ? i : 0
}

export default function App() {
  const [index, setIndex] = useState(initialIndex)
  const active = DIAGRAMS[index]

  // Remount ReactFlow per tab so fitView recomputes for the new extent instead
  // of keeping the previous tab's viewport.
  const flow = useMemo(
    () => (
      <ReactFlow
        key={active.id}
        nodes={active.nodes}
        edges={active.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.75}
        proOptions={{ hideAttribution: false }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Diagram minimap" />
      </ReactFlow>
    ),
    [active],
  )

  return (
    <div className="app">
      <header className="hd">
        <div className="hd-top">
          <h1>
            Baseout <span className="hd-dim">architecture</span>
          </h1>
          <div className="legend">
            {LEGEND.map((s) => (
              <span key={s} className={`lg s-${s}`}>
                <i />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <nav className="tabs" aria-label="Architecture sections">
          {DIAGRAMS.map((d, i) => (
            <button
              key={d.id}
              className={i === index ? 'tab is-on' : 'tab'}
              aria-current={i === index}
              onClick={() => {
                setIndex(i)
                window.location.hash = d.id
              }}
            >
              {d.label}
            </button>
          ))}
        </nav>

        <p className="blurb">{active.blurb}</p>
      </header>

      <main className="canvas">{flow}</main>

      <footer className="ft">
        Generated from <code>architecture/systems-overview.md</code> — that document is the source
        of truth. Edit <code>src/diagrams/*.ts</code> and redeploy; the diagram has no runtime data
        source.
      </footer>
    </div>
  )
}
