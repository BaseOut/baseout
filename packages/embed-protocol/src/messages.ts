// Message envelope + catalog for the baseout-embed protocol
// (openspec/changes/shared-embed-protocol — spec embed-messaging-protocol).
//
// Receivers MUST ignore anything that isn't a well-formed envelope of a
// supported proto version with a known type: never throw, never reply to
// garbage. New message types are additive within a version; breaking payload
// changes bump PROTO.

export const PROTO = 'baseout-embed/1'

export type HostKind = 'airtable-data' | 'airtable-interface' | 'chrome'

/**
 * Where the user is, as the host sees it. Airtable IDs verbatim; everything
 * optional except `host` (a Chrome host on a non-Airtable tab knows only the
 * URL). Payloads never carry tokens, emails, or record data — the only
 * session-derived value in the protocol is the `authenticated` boolean.
 */
export interface EmbedContext {
  host: HostKind
  baseId?: string
  tableId?: string
  viewId?: string
  pageId?: string
  recordId?: string
  url?: string
}

export interface MessagePayloads {
  'child:ready': Record<string, never>
  'host:hello': { hostKind: HostKind; context: EmbedContext }
  'child:hello-ack': { version: string; authenticated: boolean }
  'host:context': { context: EmbedContext }
  'child:resize': { height: number }
  'child:open-external': { url: string }
  'child:status': { authenticated: boolean }
}

export type MessageType = keyof MessagePayloads

export interface Envelope<T extends MessageType = MessageType> {
  proto: typeof PROTO
  type: T
  /** Correlation id — reserved for future request/response; unused in V1. */
  id: string
  payload: MessagePayloads[T]
}

const MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'child:ready',
  'host:hello',
  'child:hello-ack',
  'host:context',
  'child:resize',
  'child:open-external',
  'child:status',
] satisfies MessageType[])

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

export function createMessage<T extends MessageType>(
  type: T,
  payload: MessagePayloads[T],
): Envelope<T> {
  return { proto: PROTO, type, id: randomId(), payload }
}

/**
 * Parse unknown postMessage data into an envelope, or null. Null for: wrong
 * or missing proto, unknown type, or malformed shape — the caller drops it
 * silently (foreign postMessage traffic is normal on both sides).
 */
export function parseEnvelope(data: unknown): Envelope | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (d.proto !== PROTO) return null
  if (typeof d.type !== 'string' || !MESSAGE_TYPES.has(d.type)) return null
  if (typeof d.id !== 'string') return null
  if (typeof d.payload !== 'object' || d.payload === null) return null
  return d as unknown as Envelope
}
