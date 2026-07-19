// Baseout interface extension — thin no-UI wrapper (embed change, design
// Decision 5). Separate extension package from the data-layer wrapper because
// Airtable registers interface extensions as a distinct type with its own
// context surface. Context maps {baseId, pageId?, recordId?} where the pinned
// SDK exposes them and degrades to {baseId} where it doesn't (design Q2 — the
// interface surface is newer SDK territory; verify hooks against the pinned
// version during the block-run smoke and record findings in the README).
import React, { useEffect, useRef } from 'react'
import { initializeBlock, useBase, useCursor, useWatchable } from '@airtable/blocks/ui'
import { mountEmbedHost, type EmbedContext, type EmbedHostHandle } from '@baseout/embed-core'

// Baked per build (design Decision 6) — never runtime-configurable.
const APP_ORIGIN = 'https://baseout.local:4331'

function contextOf(
  baseId: string,
  cursor: { activeTableId: string | null; selectedRecordIds: string[] },
): EmbedContext {
  // Record scope: when the hosting interface element is record-bound the
  // cursor exposes the selection; a single selected record travels as
  // recordId, anything else degrades (design Q2 default).
  const [recordId] = cursor.selectedRecordIds
  return {
    host: 'airtable-interface',
    baseId,
    tableId: cursor.activeTableId ?? undefined,
    recordId: cursor.selectedRecordIds.length === 1 ? recordId : undefined,
  }
}

function BaseoutEmbed() {
  const base = useBase()
  const cursor = useCursor()
  useWatchable(cursor, ['activeTableId', 'selectedRecordIds'])

  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<EmbedHostHandle | null>(null)
  const pushRef = useRef<((c: EmbedContext) => void) | null>(null)

  useEffect(() => {
    handleRef.current = mountEmbedHost({
      container: containerRef.current as HTMLElement,
      appOrigin: APP_ORIGIN,
      hostKind: 'airtable-interface',
      getInitialContext: () => contextOf(base.id, cursor),
      onContextChange: (push) => {
        pushRef.current = push
        return () => {
          pushRef.current = null
        }
      },
      openExternal: (url) => void window.open(url, '_blank', 'noopener'),
    })
    return () => handleRef.current?.destroy()
    // mount once — context updates flow through pushRef, not remounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    pushRef.current?.(contextOf(base.id, cursor))
  }, [base.id, cursor.activeTableId, cursor.selectedRecordIds])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}

initializeBlock(() => <BaseoutEmbed />)
