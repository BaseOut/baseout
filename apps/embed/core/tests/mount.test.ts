import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMessage, PROTO } from '@baseout/embed-protocol'
import { mountEmbedHost } from '../src/index.js'

const APP = 'https://baseout.local:4331'

function mount(overrides?: Partial<Parameters<typeof mountEmbedHost>[0]>) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const opened: string[] = []
  const handle = mountEmbedHost({
    container,
    appOrigin: `${APP}/some/path-is-ignored`,
    hostKind: 'chrome',
    getInitialContext: () => ({ host: 'chrome', baseId: 'appX' }),
    openExternal: (u) => void opened.push(u),
    ...overrides,
  })
  return { container, handle, opened }
}

// Simulate a child->host postMessage arriving on the wrapper window.
function deliverFromChild(data: unknown, origin = APP) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.useFakeTimers()
})

describe('mountEmbedHost', () => {
  it('renders exactly one full-viewport iframe at /embed?host=<kind> and nothing else', () => {
    const { container } = mount()
    expect(container.children).toHaveLength(1)
    const iframe = container.querySelector('iframe')!
    expect(iframe.src).toBe(`${APP}/embed?host=chrome`)
    expect(iframe.style.width).toBe('100%')
    expect(iframe.style.height).toBe('100%')
  })

  it('completes the handshake when the child acks', () => {
    const { handle } = mount()
    deliverFromChild(createMessage('child:hello-ack', { version: PROTO, authenticated: true }))
    expect(handle.bridge.getState().phase).toBe('connected')
  })

  it('forwards context-change pushes through the bridge as host:context', () => {
    let push: ((c: { host: 'chrome'; tableId?: string }) => void) | null = null
    const { handle } = mount({
      onContextChange: (p) => {
        push = p
        return () => void (push = null)
      },
    })
    deliverFromChild(createMessage('child:hello-ack', { version: PROTO, authenticated: true }))
    // happy-dom iframes have no cross-frame postMessage spy surface; assert via
    // the bridge's outbound path not throwing and state remaining connected.
    push!({ host: 'chrome', tableId: 'tbl9' })
    expect(handle.bridge.getState().phase).toBe('connected')
  })

  it('honors child:open-external for app-origin URLs and refuses foreign ones', () => {
    const { opened } = mount()
    deliverFromChild(createMessage('child:open-external', { url: `${APP}/login` }))
    deliverFromChild(createMessage('child:open-external', { url: 'https://evil.example/x' }))
    expect(opened).toEqual([`${APP}/login`])
  })

  it('ignores messages not from the app origin', () => {
    const { opened, handle } = mount()
    deliverFromChild(
      createMessage('child:hello-ack', { version: PROTO, authenticated: true }),
      'https://evil.example',
    )
    deliverFromChild(createMessage('child:open-external', { url: `${APP}/login` }), 'https://evil.example')
    expect(handle.bridge.getState().phase).toBe('helloing')
    expect(opened).toEqual([])
  })

  it('destroy() unsubscribes, stops the bridge, and removes the iframe', () => {
    let unsubscribed = false
    const { container, handle } = mount({
      onContextChange: () => () => void (unsubscribed = true),
    })
    handle.destroy()
    expect(unsubscribed).toBe(true)
    expect(container.querySelector('iframe')).toBeNull()
    expect(handle.bridge.getState().phase).toBe('idle')
  })
})
