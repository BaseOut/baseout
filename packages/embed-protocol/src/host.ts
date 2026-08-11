// Host bridge — runs in the outer frame (extension wrapper). The host built
// the iframe URL, so it knows the child's exact origin: every send targets it
// and every receive requires it (design Decision 3). The host retries
// `host:hello` until `child:hello-ack` arrives — the child may still be
// booting when the iframe fires `load`, and its own `child:ready` beacons
// also trigger an immediate hello.

import { createMessage, parseEnvelope } from './messages.js'
import type { EmbedContext, HostKind, MessagePayloads, MessageType } from './messages.js'
import type { MessageListenerTarget, MessagePort } from './child.js'

export interface HostBridgeOptions {
  /** Where message events arrive (the host window). */
  win: MessageListenerTarget
  /** The iframe's content window; a getter because it may not exist at construction. */
  target: () => MessagePort | null
  /** Exact origin of the embedded app (from the configured app URL). */
  childOrigin: string
  hostKind: HostKind
  getContext: () => EmbedContext
  /**
   * child:open-external handler. Only same-origin-with-child URLs are passed
   * through (plus any explicitly allowed extra origins) — anything else is
   * dropped per the protocol spec (hosts must refuse foreign URLs).
   */
  onOpenExternal: (url: string) => void
  /** Extra origins open-external may target (e.g. the marketing site). */
  openExternalExtraOrigins?: string[]
  onStatus?: (authenticated: boolean) => void
  onResize?: (height: number) => void
  onConnected?: (childVersion: string, authenticated: boolean) => void
  /** host:hello retry interval until acked. */
  retryIntervalMs?: number
}

export interface HostBridgeState {
  phase: 'idle' | 'helloing' | 'connected'
  childVersion: string | null
}

export interface HostBridge {
  start(): void
  stop(): void
  /** Push a context update (fire-and-forget; also allowed pre-ack, the child ignores it until locked). */
  sendContext(context: EmbedContext): void
  getState(): HostBridgeState
}

export function createHostBridge(opts: HostBridgeOptions): HostBridge {
  const retryMs = opts.retryIntervalMs ?? 250
  const childOrigin = new URL(opts.childOrigin).origin
  const allowedExternal = new Set(
    [childOrigin, ...(opts.openExternalExtraOrigins ?? [])].map((o) => new URL(o).origin),
  )
  const state: HostBridgeState = { phase: 'idle', childVersion: null }
  let helloTimer: ReturnType<typeof setInterval> | null = null

  const stopHello = () => {
    if (helloTimer !== null) clearInterval(helloTimer)
    helloTimer = null
  }

  const send = <T extends MessageType>(type: T, payload: MessagePayloads[T]) => {
    opts.target()?.postMessage(createMessage(type, payload), childOrigin)
  }

  const sendHello = () =>
    send('host:hello', { hostKind: opts.hostKind, context: opts.getContext() })

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== childOrigin) return
    const msg = parseEnvelope(e.data)
    if (!msg) return

    switch (msg.type) {
      case 'child:ready':
        // Child (re)booted or beat our listener — answer immediately.
        sendHello()
        return
      case 'child:hello-ack': {
        const { version, authenticated } = msg.payload as MessagePayloads['child:hello-ack']
        stopHello()
        state.phase = 'connected'
        state.childVersion = version
        opts.onConnected?.(version, authenticated)
        return
      }
      case 'child:open-external': {
        const { url } = msg.payload as MessagePayloads['child:open-external']
        try {
          if (allowedExternal.has(new URL(url).origin)) opts.onOpenExternal(url)
        } catch {
          // unparseable URL — drop
        }
        return
      }
      case 'child:status':
        opts.onStatus?.((msg.payload as MessagePayloads['child:status']).authenticated)
        return
      case 'child:resize':
        opts.onResize?.((msg.payload as MessagePayloads['child:resize']).height)
        return
    }
  }

  return {
    start() {
      if (state.phase !== 'idle') return
      state.phase = 'helloing'
      opts.win.addEventListener('message', onMessage)
      sendHello()
      helloTimer = setInterval(() => {
        if (state.phase === 'helloing') sendHello()
      }, retryMs)
    },
    stop() {
      stopHello()
      opts.win.removeEventListener('message', onMessage)
      state.phase = 'idle'
      state.childVersion = null
    },
    sendContext(context) {
      send('host:context', { context })
    },
    getState: () => ({ ...state }),
  }
}
