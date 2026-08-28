/**
 * URL → panel-event deep links (web-entity-deeplinks). Makes MCP `appUrl`s
 * clickable ends: `?entity=<id>` on /schema opens the schema entity panel,
 * `?record=<id>&table=<t>` on /data opens the record panel.
 *
 * The dispatch is DEFERRED past `load` — the DataComments `?comment=` lesson:
 * panel hosts register their listeners in their own bundled module scripts,
 * which run as separate tasks in an order nothing here controls. Dispatching
 * earlier fires into a document with no listener and silently does nothing.
 */

export interface DeepLinkEvent {
  type: string;
  detail: Record<string, unknown>;
}

/** Pure param → event mapping (unit-tested; the wire function just dispatches). */
export function deepLinkEventsFrom(params: URLSearchParams): DeepLinkEvent[] {
  const events: DeepLinkEvent[] = [];
  const entity = params.get('entity');
  if (entity && entity.trim()) {
    events.push({ type: 'schema:openEntity', detail: { id: entity.trim() } });
  }
  const record = params.get('record');
  if (record && record.trim()) {
    const table = params.get('table');
    events.push({
      type: 'data:openRecord',
      detail: { id: record.trim(), ...(table && table.trim() ? { tableId: table.trim() } : {}) },
    });
  }
  return events;
}

/** Dispatch this page's deep-link events once the panel hosts are wired. */
export function wireDeepLinks(win: Window = window): void {
  const fire = () => {
    for (const e of deepLinkEventsFrom(new URLSearchParams(win.location.search))) {
      win.document.dispatchEvent(new CustomEvent(e.type, { detail: e.detail }));
    }
  };
  // Same afterHosts timing as DataComments: setTimeout(0) past `load`.
  if (win.document.readyState === 'complete') setTimeout(fire, 0);
  else win.addEventListener('load', () => setTimeout(fire, 0), { once: true });
}
