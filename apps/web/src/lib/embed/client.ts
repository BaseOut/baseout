// Embed client — boots the protocol child bridge on every page load while
// embed mode is active, so host messaging survives full-page navigation
// (the handshake is re-run each load; the host's hello-retry makes that free).
//
// Navigation rule: apply resolveEmbedRoute output only when it differs from
// the current path+search — context re-sends and re-handshakes must never
// cause a reload loop.
import {
  createChildBridge,
  parseAllowlist,
  type ChildBridge,
  type EmbedContext,
} from '@baseout/embed-protocol'
import { $embed, hydrateEmbedFromSession, setEmbedState } from '../../stores/embed'
import { resolveEmbedRoute } from './resolve-route'

export interface EmbedClientOptions {
  /** PUBLIC_EMBED_ALLOWED_ANCESTORS, threaded from the server render. */
  allowedAncestors: string
  authenticated: boolean
  /**
   * Entering via /embed: activates embed mode with a fresh bases snapshot.
   * Omitted on ordinary pages, which only re-boot an already-active session.
   */
  enter?: { bases: { atBaseId: string; isIncluded: boolean }[] }
  navigate?: (route: string) => void
}

// Page-load singleton: the embed page boots with `enter` and the shared
// Layout boots bare — both import this module, only the first call wins
// (double bridges would double-ack every hello).
let activeBridge: ChildBridge | null = null

export function initEmbedClient(opts: EmbedClientOptions): ChildBridge | null {
  if (activeBridge) return activeBridge
  const prior = hydrateEmbedFromSession()
  if (!opts.enter && !prior.active) return null
  if (window.self === window.top) return null // not framed — standalone wins

  const bases = opts.enter?.bases ?? prior.bases
  const navigate =
    opts.navigate ?? ((route: string) => window.location.assign(route))

  const applyContext = (context: EmbedContext) => {
    setEmbedState({ active: true, host: context.host, context, bases })
    document.documentElement.setAttribute('data-embed', context.host)
    const route = resolveEmbedRoute(context, bases)
    // Route only when authenticated (the /embed sign-in prompt must not be
    // navigated away from) and only on a PATHNAME change — param-level context
    // moves (table/view switches) update the store for surfaces to react to,
    // never trigger reload churn.
    const targetPath = route.split('?')[0]
    if (opts.authenticated && window.location.pathname !== targetPath) {
      navigate(route)
    }
  }

  const bridge = createChildBridge({
    win: window,
    parent: window.parent,
    allowedAncestors: parseAllowlist(opts.allowedAncestors),
    authenticated: () => opts.authenticated,
    onContext: applyContext,
  })
  bridge.start()
  activeBridge = bridge

  // Embedded layout flag — ClientRouter swaps replace <html> attributes, so
  // re-stamp after every soft navigation (same pattern as the theme script).
  const stamp = () => {
    const s = $embed.get()
    if (s.active) document.documentElement.setAttribute('data-embed', s.host ?? '1')
  }
  stamp()
  document.addEventListener('astro:after-swap', stamp)

  return bridge
}

export { $embed }
