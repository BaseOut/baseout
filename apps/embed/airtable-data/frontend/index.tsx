// Baseout data-layer extension — thin no-UI wrapper (embed change, design
// Decision 4). One full-height iframe of the Baseout app; context from the
// blocks SDK cursor (active table/view), pushed on every cursor move. All UX,
// including sign-in, lives in the embedded app.
import React, { useEffect, useRef } from 'react'
import { initializeBlock, useBase, useCursor, useWatchable } from '@airtable/blocks/ui'
import { mountEmbedHost, type EmbedContext, type EmbedHostHandle } from '@baseout/embed-core'

// Baked per build (design Decision 6) — never runtime-configurable.
const APP_ORIGIN = 'https://baseout.local:4331'

function contextOf(baseId: string, cursor: { activeTableId: string | null; activeViewId: string | null }): EmbedContext {
  return {
    host: 'airtable-data',
    baseId,
    tableId: cursor.activeTableId ?? undefined,
    viewId: cursor.activeViewId ?? undefined,
  }
}

function BaseoutEmbed() {
  const base = useBase()
  const cursor = useCursor()
  useWatchable(cursor, ['activeTableId', 'activeViewId'])

  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<EmbedHostHandle | null>(null)
  const pushRef = useRef<((c: EmbedContext) => void) | null>(null)

  useEffect(() => {
    handleRef.current = mountEmbedHost({
      container: containerRef.current as HTMLElement,
      appOrigin: APP_ORIGIN,
      hostKind: 'airtable-data',
      getInitialContext: () => contextOf(base.id, cursor),
      onContextChange: (push) => {
        pushRef.current = push
        return () => {
          pushRef.current = null
        }
      },
      // Blocks sandbox permits window.open for top-level tabs (sign-in flow).
      openExternal: (url) => void window.open(url, '_blank', 'noopener'),
    })
    return () => handleRef.current?.destroy()
    // mount once — context updates flow through pushRef, not remounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    pushRef.current?.(contextOf(base.id, cursor))
  }, [base.id, cursor.activeTableId, cursor.activeViewId])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}

initializeBlock(() => <BaseoutEmbed />)
