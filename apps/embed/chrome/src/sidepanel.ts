// Side panel: the thin no-UI wrapper — one full-viewport iframe + the host
// bridge, context streamed from the background worker. All UX lives in the
// embedded Baseout app.
import { mountEmbedHost, type EmbedContext } from '@baseout/embed-core'

const CONTEXT_MESSAGE = 'bo-embed:context'
const CONTEXT_REQUEST = 'bo-embed:context-request'
const APP_ORIGIN = process.env.EMBED_APP_ORIGIN as string

async function initialContext(): Promise<EmbedContext> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: CONTEXT_REQUEST })) as {
      context?: EmbedContext
    }
    return res?.context ?? { host: 'chrome' }
  } catch {
    return { host: 'chrome' }
  }
}

void initialContext().then((context) => {
  mountEmbedHost({
    container: document.getElementById('root') as HTMLElement,
    appOrigin: APP_ORIGIN,
    hostKind: 'chrome',
    getInitialContext: () => context,
    onContextChange: (push) => {
      const listener = (message: unknown) => {
        const m = message as { type?: string; context?: EmbedContext }
        if (m?.type === CONTEXT_MESSAGE && m.context) push(m.context)
      }
      chrome.runtime.onMessage.addListener(listener)
      return () => chrome.runtime.onMessage.removeListener(listener)
    },
    openExternal: (url) => void chrome.tabs.create({ url }),
  })
})
