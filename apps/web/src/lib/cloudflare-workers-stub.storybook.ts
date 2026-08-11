// Defensive stub for Storybook's Vite build. Some apps/web modules transitively
// import `cloudflare:workers` (a workerd-only module that doesn't exist in the
// Storybook Node/Vite context). ui/ component stories don't reach it today, but
// aliasing it here (see .storybook/main.ts) keeps future higher-level-view
// stories from exploding. Mirrors apps/design/src/lib/cloudflare-workers-stub.ts.
export const env = {};
