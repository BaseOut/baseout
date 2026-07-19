// Child bridge — runs inside the embedded Baseout app (inner frame).
//
// Handshake (design Decision 3): the child cannot know its parent's origin up
// front, so it beacons `child:ready` (payload empty — safe to broadcast) to
// the parent with targetOrigin '*' until a `host:hello` arrives from an
// allowlisted origin. It then LOCKS the bridge to that origin: every later
// send targets it exactly, every later receive requires it. Non-allowlisted
// hellos are dropped and counted. No non-handshake message is sent before the
// handshake completes.

import { PROTO, createMessage, parseEnvelope } from './messages.js'
import type { EmbedContext, HostKind, MessagePayloads, MessageType } from './messages.js'
import { originMatches, type AncestorPattern } from './origins.js'

export interface MessagePort {
  postMessage(data: unknown, targetOrigin: string): void
}

export interface MessageListenerTarget {
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void
}

export interface ChildBridgeOptions {
  /** Where message events arrive (the child window). */
  win: MessageListenerTarget
  /** The outer frame (window.parent). */
  parent: MessagePort
  allowedAncestors: AncestorPattern[]
  /** Read at ack time and on demand — the child's session state, boolean only. */
  authenticated: () => boolean
  /** Initial context (from host:hello) and every host:context update. */
  onContext: (context: EmbedContext, hostKind: HostKind) => void
  /** child:ready re-beacon interval until hello arrives. */
  beaconIntervalMs?: number
}

export interface ChildBridgeState {
  phase: 'idle' | 'beaconing' | 'connected'
  hostOrigin: string | null
  hostKind: HostKind | null
  /** host:hello messages dropped for failing the ancestor allowlist. */
  rejectedHellos: number
}

export interface ChildBridge {
  start(): void
  stop(): void
  /** Post-handshake senders — no-ops (returning false) until connected. */
  sendResize(height: number): boolean
  sendStatus(authenticated: boolean): boolean
  openExternal(url: string): boolean
  getState(): ChildBridgeState
}

export function createChildBridge(opts: ChildBridgeOptions): ChildBridge {
  const beaconMs = opts.beaconIntervalMs ?? 250
  const state: ChildBridgeState = {
    phase: 'idle',
    hostOrigin: null,
    hostKind: null,
    rejectedHellos: 0,
  }
  let beaconTimer: ReturnType<typeof setInterval> | null = null

  const stopBeacon = () => {
    if (beaconTimer !== null) clearInterval(beaconTimer)
    beaconTimer = null
  }

  const sendLocked = <T extends MessageType>(type: T, payload: MessagePayloads[T]): boolean => {
    if (state.phase !== 'connected' || !state.hostOrigin) return false
    opts.parent.postMessage(createMessage(type, payload), state.hostOrigin)
    return true
  }

  const onMessage = (e: MessageEvent) => {
    const msg = parseEnvelope(e.data)
    if (!msg) return

    if (state.phase !== 'connected') {
      if (msg.type !== 'host:hello') return
      if (!originMatches(e.origin, opts.allowedAncestors)) {
        state.rejectedHellos++
        return
      }
      const { hostKind, context } = msg.payload as MessagePayloads['host:hello']
      state.phase = 'connected'
      state.hostOrigin = e.origin
      state.hostKind = hostKind
      stopBeacon()
      sendLocked('child:hello-ack', { version: PROTO, authenticated: opts.authenticated() })
      opts.onContext(context, hostKind)
      return
    }

    // Connected: locked-origin receives only.
    if (e.origin !== state.hostOrigin) return
    if (msg.type === 'host:hello') {
      // Host retry raced our ack — re-ack, idempotent.
      sendLocked('child:hello-ack', { version: PROTO, authenticated: opts.authenticated() })
      return
    }
    if (msg.type === 'host:context') {
      const { context } = msg.payload as MessagePayloads['host:context']
      opts.onContext(context, state.hostKind as HostKind)
    }
  }

  return {
    start() {
      if (state.phase !== 'idle') return
      state.phase = 'beaconing'
      opts.win.addEventListener('message', onMessage)
      const beacon = () => opts.parent.postMessage(createMessage('child:ready', {}), '*')
      beacon()
      beaconTimer = setInterval(beacon, beaconMs)
    },
    stop() {
      stopBeacon()
      opts.win.removeEventListener('message', onMessage)
      state.phase = 'idle'
      state.hostOrigin = null
      state.hostKind = null
    },
    sendResize: (height) => sendLocked('child:resize', { height }),
    sendStatus: (authenticated) => sendLocked('child:status', { authenticated }),
    openExternal: (url) => sendLocked('child:open-external', { url }),
    getState: () => ({ ...state }),
  }
}
