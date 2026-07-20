// Minimal structured logger for apps/api. Worker logs surface via `wrangler tail`
// / Logpush. Centralizes the single console sink so the rest of the app logs
// structurally (per CLAUDE.md §3.5 — a logger utility, not scattered console.*).
// @baseout/shared's logger is still a stub; swap to it when it lands.

type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields?: Fields): void {
  const line = JSON.stringify({ level, event, ...fields });
  // eslint-disable-next-line no-console -- the app's single structured log sink (Worker → Logpush)
  console[level](line);
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};
