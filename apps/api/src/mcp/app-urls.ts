// appUrl deep-link enrichment (api-search-tools D4). Pure: given a tool name,
// its call args, and the operation's parsed 2xx result, return the result with
// `appUrl` fields added — per-hit on search tools, top-level on entity gets.
// URLs target the web console (`PUBLIC_APP_URL`); the `?entity=` / `?record=`
// params ship in the paired web-entity-deeplinks change. MCP-only by design —
// REST responses stay pure resource representations.

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => v != null && typeof v === "object" && !Array.isArray(v);

function url(base: string, path: string, params: Record<string, string | null | undefined> = {}): string {
  const u = new URL(path, base.endsWith("/") ? base : `${base}/`);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

/** Per-item enrichment over a `{ data: [...] }` envelope. */
function mapData(result: Dict, fn: (item: Dict) => Dict): Dict {
  if (!Array.isArray(result.data)) return result;
  return { ...result, data: result.data.map((item) => (isDict(item) ? fn(item) : item)) };
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/**
 * Enrich a tool result with appUrl deep links. Unknown tools and non-object
 * results pass through untouched; a missing/empty base makes this a no-op
 * (production has no PUBLIC_APP_URL until Dan's env lane lands).
 */
export function enrichWithAppUrl(toolName: string, args: Record<string, unknown>, result: unknown, base: string | undefined): unknown {
  if (!base || !isDict(result)) return result;

  switch (toolName) {
    // ── Search tools: per-hit links ──
    case "search_records":
      // Hits are grouped base → table; each hit gets its record deep link.
      return {
        ...result,
        data: Array.isArray(result.data)
          ? result.data.map((group) =>
              isDict(group) && Array.isArray(group.tables)
                ? {
                    ...group,
                    tables: group.tables.map((t) =>
                      isDict(t) && Array.isArray(t.hits)
                        ? {
                            ...t,
                            hits: t.hits.map((h) =>
                              isDict(h)
                                ? { ...h, appUrl: url(base, "/data", { record: str(h.recordId), table: str(h.tableId) }) }
                                : h,
                            ),
                          }
                        : t,
                    ),
                  }
                : group,
            )
          : result.data,
      };
    case "search_documents":
    case "list_documents":
      return mapData(result, (d) => ({ ...d, appUrl: url(base, "/data", { tab: "docs" }) }));
    case "search_reports":
      return mapData(result, (r) => (str(r.id) ? { ...r, appUrl: url(base, `/reports/${r.id}`) } : r));
    case "search_attachments":
      return mapData(result, (a) => (str(a.id) ? { ...a, appUrl: url(base, "/data", { tab: "attachments", asset: a.id as string }) } : a));
    case "search_schema": {
      // Heterogeneous hits: { type, entity } where the entity carries its
      // type-specific id (baseId/tableId/fieldId/viewId).
      const ID_KEY: Record<string, string> = { base: "baseId", table: "tableId", field: "fieldId", view: "viewId" };
      return mapData(result, (h) => {
        const key = ID_KEY[str(h.type) ?? ""];
        const entity = isDict(h.entity) ? h.entity : undefined;
        const id = key && entity ? str(entity[key]) : undefined;
        return id ? { ...h, appUrl: url(base, "/schema", { entity: id }) } : h;
      });
    }

    // ── Entity gets: top-level link ──
    case "get_base":
    case "get_table":
    case "get_field": {
      const id = str(result.id) ?? str(args.baseId) ?? str(args.tableId) ?? str(args.fieldId);
      return id ? { ...result, appUrl: url(base, "/schema", { entity: id }) } : result;
    }
    case "get_document":
      return { ...result, appUrl: url(base, "/data", { tab: "docs" }) };
    case "get_view":
    case "list_views":
      return isDict(result) && !Array.isArray(result.data) ? { ...result, appUrl: url(base, "/data") } : mapData(result, (v) => ({ ...v, appUrl: url(base, "/data") }));
    case "get_backup_run":
    case "get_backup_status":
    case "get_backup_configuration":
      return { ...result, appUrl: url(base, "/backups") };
    case "list_backup_runs":
      return mapData(result, (r) => ({ ...r, appUrl: url(base, "/backups") }));

    default:
      return result;
  }
}
