// Workers Builds anchor — NOT runtime code. Nothing enqueues this, nothing
// routes to it, and no Baseout code path imports it.
//
// WHY IT EXISTS: Cloudflare Workers Builds is attached to a *Worker*, and this
// app is a Trigger.dev task project that runs on Trigger.dev's Node runner
// (root CLAUDE.md §6). To let Workers Builds run this app's build + deploy
// pipeline, a Worker record has to exist for the build to hang off of. This
// file plus ../wrangler.jsonc are the minimum needed to create that record
// once, by hand:
//
//   pnpm --filter @baseout/workflows exec wrangler deploy
//
// After that one-time bootstrap the Workers Builds deploy command is
// `pnpm run deploy:{staging,production}` (i.e. `trigger.dev deploy`), so
// wrangler never runs in CI and this handler is never redeployed. The Worker
// therefore sits at this version forever and serves 404 to anything that
// reaches it. See ../README.md "Deploy".
//
// It lives in `ci/` rather than `src/` on purpose: root CLAUDE.md §6 states
// there is intentionally no `src/` in this app, and that still holds — nothing
// in `ci/` is part of the task runtime.
//
// Node-only rule still applies: no `cloudflare:workers` import, no workerd
// globals beyond the bare fetch signature.

export default {
  fetch(): Response {
    return new Response("Not found. This Worker exists only as a Cloudflare Workers Builds anchor for @baseout/workflows; the tasks run on Trigger.dev.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
