// Shared no-UI embed wrapper (embed change, design Decision 2). Every host
// wrapper renders EXACTLY one full-viewport iframe of the Baseout app and
// speaks the protocol — nothing else. Host specifics are injected:
// context acquisition and the open-external opener are the only things the
// three host packages implement.
import {
  createHostBridge,
  type EmbedContext,
  type HostBridge,
  type HostKind,
  type MessageListenerTarget,
} from '@baseout/embed-protocol'

export type { EmbedContext, HostKind } from '@baseout/embed-protocol'

export interface EmbedHostOptions {
  /** Where the iframe mounts — the wrapper fills it completely. */
  container: HTMLElement
  /** The Baseout app origin, baked at build time (never runtime-configurable). */
  appOrigin: string
  hostKind: HostKind
  getInitialContext: () => EmbedContext
  /**
   * Subscribe to host-side context changes. Receives a `push` to call with
   * each new context; returns an unsubscribe for destroy().
   */
  onContextChange?: (push: (context: EmbedContext) => void) => () => void
  /** Open a URL top-level (chrome.tabs.create / window.open — per host). */
  openExternal: (url: string) => void
  /** Extra origins open-external may target beyond the app origin. */
  openExternalExtraOrigins?: string[]
}

export interface EmbedHostHandle {
  iframe: HTMLIFrameElement
  bridge: HostBridge
  destroy(): void
}

export function mountEmbedHost(opts: EmbedHostOptions): EmbedHostHandle {
  const appOrigin = new URL(opts.appOrigin).origin
  const doc = opts.container.ownerDocument
  const win = doc.defaultView
  if (!win) throw new Error('embed-core: container is not attached to a window')

  const iframe = doc.createElement('iframe')
  iframe.src = `${appOrigin}/embed?host=${encodeURIComponent(opts.hostKind)}`
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = '0'
  iframe.style.display = 'block'
  iframe.setAttribute('title', 'Baseout')
  opts.container.appendChild(iframe)

  let latestContext = opts.getInitialContext()

  const bridge = createHostBridge({
    win: win as unknown as MessageListenerTarget,
    target: () => iframe.contentWindow,
    childOrigin: appOrigin,
    hostKind: opts.hostKind,
    getContext: () => latestContext,
    onOpenExternal: opts.openExternal,
    openExternalExtraOrigins: opts.openExternalExtraOrigins,
  })
  bridge.start()

  const unsubscribe = opts.onContextChange?.((context) => {
    latestContext = context
    bridge.sendContext(context)
  })

  return {
    iframe,
    bridge,
    destroy() {
      unsubscribe?.()
      bridge.stop()
      iframe.remove()
    },
  }
}
