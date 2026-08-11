import { describe, expect, it } from 'vitest'
import { PROTO, createMessage, parseEnvelope } from '../src/messages.js'

describe('createMessage / parseEnvelope', () => {
  it('round-trips a catalog message', () => {
    const msg = createMessage('host:context', { context: { host: 'chrome', baseId: 'appX' } })
    const parsed = parseEnvelope(msg)
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBe('host:context')
    expect(parsed!.proto).toBe(PROTO)
    expect(parsed!.id).toBeTruthy()
  })

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['no proto', { type: 'child:ready', id: 'x', payload: {} }],
    ['wrong proto version', { proto: 'baseout-embed/2', type: 'child:ready', id: 'x', payload: {} }],
    ['unknown type', { proto: PROTO, type: 'host:teleport', id: 'x', payload: {} }],
    ['missing id', { proto: PROTO, type: 'child:ready', payload: {} }],
    ['missing payload', { proto: PROTO, type: 'child:ready', id: 'x' }],
  ])('rejects %s as null (silent ignore)', (_label, data) => {
    expect(parseEnvelope(data)).toBeNull()
  })
})
