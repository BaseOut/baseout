// TODO(multi-platform): v1 is Airtable-only, so every platform-scoped path
// resolves to this constant. When a second platform ships, the MCP dispatch
// must take platform as a tool arg (or derive it from the Space's connected
// platforms) and requirePlatform must validate against the Space's actual
// platform codes instead of this constant.
export const DEFAULT_PLATFORM = "at";
