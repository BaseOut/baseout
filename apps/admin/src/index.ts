// @baseout/admin — internal Astro SSR admin app at admin.baseout.com.
// Entry point for the Cloudflare Workers Astro adapter; replaced once Astro
// scaffolding is run during Phase 0. See ./openspec/proposal.md for scope.

export default {
  fetch(): Response {
    return new Response("baseout-admin placeholder", { status: 200 });
  },
};
