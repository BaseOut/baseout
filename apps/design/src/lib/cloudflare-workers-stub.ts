/**
 * Stand-in for the `cloudflare:workers` virtual module. apps/web has a
 * handful of components that read feature-gate env vars (e.g. StoragePicker
 * checks `BOX_OAUTH_CLIENT_ID` to decide whether to enable that radio).
 *
 * Under apps/design's Node SSR runtime that import would otherwise fail.
 * Vite aliases `cloudflare:workers` to this file so reads land on an
 * empty object — every feature gate evaluates to false in the design app,
 * which matches "all providers visible as Coming Soon, none wired."
 */
export const env: Record<string, string | undefined> = {};
