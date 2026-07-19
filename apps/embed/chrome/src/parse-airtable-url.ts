// Tab URL → EmbedContext (embed change, design Decision 3). Airtable's URL
// shapes are NOT a public contract — this parser is deliberately forgiving:
// it scans path segments for id-prefixed tokens (app/tbl/viw/pag) wherever
// they appear, and anything unrecognized degrades to {host:'chrome', url}
// (the child shows the dashboard). Derivation is stateless per URL so MV3
// service-worker restarts are harmless.
import type { EmbedContext } from '@baseout/embed-protocol'

const ID_PREFIXES: Record<string, keyof EmbedContext & ('baseId' | 'tableId' | 'viewId' | 'pageId')> = {
  app: 'baseId',
  tbl: 'tableId',
  viw: 'viewId',
  pag: 'pageId',
}

export function parseAirtableUrl(url: string | undefined | null): EmbedContext {
  if (!url) return { host: 'chrome' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { host: 'chrome' }
  }
  const context: EmbedContext = { host: 'chrome', url }
  const host = parsed.hostname.toLowerCase()
  if (host !== 'airtable.com' && !host.endsWith('.airtable.com')) return context

  for (const segment of parsed.pathname.split('/')) {
    const prefix = segment.slice(0, 3)
    const key = ID_PREFIXES[prefix]
    if (key && /^[A-Za-z0-9]{8,}$/.test(segment.slice(3)) && !context[key]) {
      context[key] = segment
    }
  }
  return context
}
