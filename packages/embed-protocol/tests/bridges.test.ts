// Bridge handshake tests over a tiny synchronous message bus that plays the
// role of two windows: frame A's postMessage delivers a MessageEvent-shaped
// object to frame B's listeners (with a configurable sender origin), so
// delivery-order races are simulated by simply not starting one side yet.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChildBridge, type ChildBridge } from '../src/child.js'
import { createHostBridge, type HostBridge } from '../src/host.js'
import { parseAllowlist } from '../src/origins.js'
import type { EmbedContext } from '../src/messages.js'

const HOST_ORIGIN = 'https://block-1.airtableblocks.com'
const CHILD_ORIGIN = 'https://baseout.local:4331'
const ALLOWED = parseAllowlist('https://*.airtableblocks.com, chrome-extension://*')

type Listener = (e: MessageEvent) => void

function makeFrame() {
  const listeners = new Set<Listener>()
  return {
    listeners,
    win: {
      addEventListener: (_: 'message', l: Listener) => void listeners.add(l),
      removeEventListener: (_: 'message', l: Listener) => void listeners.delete(l),
    },
    deliver(data: unknown, origin: string) {
      for (const l of [...listeners]) l({ data, origin } as MessageEvent)
    },
  }
}

function wire() {
  const hostFrame = makeFrame()
  const childFrame = makeFrame()
  // each side's postMessage delivers into the OTHER side's listeners
  const parentPort = { postMessage: (data: unknown) => hostFrame.deliver(data, CHILD_ORIGIN) }
  const iframePort = { postMessage: (data: unknown) => childFrame.deliver(data, HOST_ORIGIN) }
  return { hostFrame, childFrame, parentPort, iframePort }
}

function makePair(overrides?: {
  hostOrigin?: string
  onContext?: (c: EmbedContext) => void
  onOpenExternal?: (u: string) => void
}) {
  const { hostFrame, childFrame, parentPort, iframePort } = wire()
  const contexts: EmbedContext[] = []
  const opened: string[] = []

  const child: ChildBridge = createChildBridge({
    win: childFrame.win,
    parent: {
      postMessage: (data) => hostFrame.deliver(data, CHILD_ORIGIN),
    },
    allowedAncestors: ALLOWED,
    authenticated: () => true,
    onContext: (c) => {
      contexts.push(c)
      overrides?.onContext?.(c)
    },
    beaconIntervalMs: 10,
  })

  const host: HostBridge = createHostBridge({
    win: hostFrame.win,
    target: () => ({
      postMessage: (data) => childFrame.deliver(data, overrides?.hostOrigin ?? HOST_ORIGIN),
    }),
    childOrigin: CHILD_ORIGIN,
    hostKind: 'airtable-data',
    getContext: () => ({ host: 'airtable-data', baseId: 'appX', tableId: 'tbl1' }),
    onOpenExternal: (u) => {
      opened.push(u)
      overrides?.onOpenExternal?.(u)
    },
    retryIntervalMs: 10,
  })

  return { host, child, contexts, opened, parentPort, iframePort, hostFrame, childFrame }
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('handshake', () => {
  it('completes host-first: hello answers the ready beacon, channel locks', () => {
    const { host, child, contexts } = makePair()
    host.start() // hello fires into the void — child not listening yet
    child.start() // ready beacon → host answers hello → ack
    expect(child.getState().phase).toBe('connected')
    expect(child.getState().hostOrigin).toBe(HOST_ORIGIN)
    expect(host.getState().phase).toBe('connected')
    expect(contexts).toEqual([{ host: 'airtable-data', baseId: 'appX', tableId: 'tbl1' }])
  })

  it('completes child-first via host hello retry', () => {
    const { host, child } = makePair()
    child.start() // beacons into the void
    host.start() // immediate hello reaches the listening child
    expect(child.getState().phase).toBe('connected')
    expect(host.getState().phase).toBe('connected')
  })

  it('drops hello from a non-allowlisted origin and keeps beaconing', () => {
    const { host, child } = makePair({ hostOrigin: 'https://evil.example' })
    child.start()
    host.start()
    expect(child.getState().phase).toBe('beaconing')
    expect(child.getState().rejectedHellos).toBeGreaterThan(0)
    // and no ack ever reaches the host
    expect(host.getState().phase).toBe('helloing')
  })

  it('re-acks idempotently when a retried hello races the ack', () => {
    const { host, child } = makePair()
    child.start()
    host.start()
    vi.advanceTimersByTime(50) // any straggling retries
    expect(child.getState().phase).toBe('connected')
    expect(host.getState().phase).toBe('connected')
  })
})

describe('post-handshake', () => {
  it('delivers host:context updates and blocks sends before connection', () => {
    const { host, child, contexts } = makePair()
    expect(child.sendStatus(true)).toBe(false) // not connected yet → no-op
    child.start()
    host.start()
    host.sendContext({ host: 'airtable-data', baseId: 'appX', tableId: 'tbl2' })
    expect(contexts.at(-1)).toEqual({ host: 'airtable-data', baseId: 'appX', tableId: 'tbl2' })
    expect(child.sendStatus(false)).toBe(true)
  })

  it('host opens same-origin open-external URLs and refuses foreign ones', () => {
    const { host, child, opened } = makePair()
    child.start()
    host.start()
    expect(child.openExternal(`${CHILD_ORIGIN}/login`)).toBe(true)
    expect(child.openExternal('https://evil.example/phish')).toBe(true) // child sends it...
    expect(opened).toEqual([`${CHILD_ORIGIN}/login`]) // ...host refuses it
  })

  it('ignores foreign postMessage traffic entirely', () => {
    const { host, child, contexts, hostFrame, childFrame } = makePair()
    child.start()
    host.start()
    const before = contexts.length
    // garbage delivered straight into both windows, from locked AND foreign origins
    for (const garbage of [null, 'hi', { source: 'react-devtools' }, { proto: 'baseout-embed/1' }]) {
      childFrame.deliver(garbage, HOST_ORIGIN)
      childFrame.deliver(garbage, 'https://evil.example')
      hostFrame.deliver(garbage, CHILD_ORIGIN)
      hostFrame.deliver(garbage, 'https://evil.example')
    }
    expect(contexts.length).toBe(before)
    expect(child.getState().phase).toBe('connected')
    expect(host.getState().phase).toBe('connected')
  })
})

describe('stop', () => {
  it('stops beaconing and detaches listeners', () => {
    const { child } = makePair()
    child.start()
    child.stop()
    vi.advanceTimersByTime(100)
    expect(child.getState().phase).toBe('idle')
  })
})
