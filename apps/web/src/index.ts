// @baseout/web — customer-facing Astro SSR app + /api/* endpoints.
// Entry point for the Cloudflare Workers Astro adapter; replaced once Astro
// scaffolding is run during Phase 0. See ./openspec/proposal.md for scope.

export default {
  fetch(): Response {
    return new Response("baseout-web placeholder", { status: 200 });
  },
};
