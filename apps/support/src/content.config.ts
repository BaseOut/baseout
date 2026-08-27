import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PLATFORM_IDS } from './lib/platforms';

/* There used to be a `stub` field here driving a site-wide draft banner. The banner was removed on
   2026-08-18 (the stub pages say "Not written yet" in their own bodies, which is the better place
   for it), so the flag had no reader left and a schema field nothing consults is a trap for the
   next person. Note for whoever adds one back: DO NOT call it `draft` — Starlight owns that key and
   `draft: true` excludes the page from production builds. */
/* `platform` marks a page as being about ONE connected platform: what it captures, how it is
   authorized, what its API will not give us. It is optional, and most pages will never carry it —
   we measured that 15 of 38 pages never name a platform at all, and those are the ones a filter
   must never touch.
   NO DEFAULT. A default in an extended Starlight schema does not apply the way it looks like it
   should, and "absent" is the meaningful value here: it is what makes a page platform-neutral. */
/* There was also a `provisional` flag here, driving an amber "Baseout does not back up this yet"
   banner above the first sentence of seven platform pages. REMOVED 2026-08-20 on Oleh's ruling:
   this portal is a demonstration of what a large documentation site looks like, and it has to look
   exactly as the client will see it once the text is real. A banner saying the text is not real is
   noise in front of the thing being judged. Every page now reads as finished.
   If it comes back, it comes back with a different name: NOT `draft`, which Starlight owns and
   which deletes the page from production builds. */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        platform: z.enum(PLATFORM_IDS as [string, ...string[]]).optional(),
        /* THE OPERATIONS IN THE API THAT DO WHAT THIS PAGE DESCRIBES. Dan, 2026-08-24: "there will
           be some items that are specific, like API endpoints that are specific to a doc. Most of
           them I think will be generic, but there will be some where we should add that." So it is
           optional and most pages will never carry it, exactly like `platform` above.

           `summary` IS A SENTENCE, NOT A PATH, AND THAT IS THE WHOLE DESIGN. `docs/api/index.md`
           rules that inventing endpoint paths is worse than any banner, because a banner is
           detectable and an invented `GET /v1/runs` is not — a reader cannot tell it from a real
           one, and neither can the next person to edit the file. So this field names the operation
           in words, which is knowable today, and `slug` stays empty until a reference page exists
           for it to point at. Filling `slug` is what happens when the API is real; do not fill it
           with a guess.

           A FIELD NOTHING READS IS A TRAP — this schema already carries the story of two of them
           (`stub`, `provisional`). Its reader is `components/DocsApi.astro`, rendered from
           `DocsFooter.astro`, and `smoke-support` asserts the rendered block appears on the pages
           whose frontmatter declares it. */
        api: z
          .array(
            z.object({
              summary: z.string(),
              slug: z.string().optional(),
            }),
          )
          .optional(),
        /* THE CODE THIS PAGE DOCUMENTS — repo-relative paths (files or directories) whose behavior
           the page describes. Optional, seeded page-by-page as pages are touched; most pages start
           without it. Its reader is `scripts/support-docs-register.mjs` (root repo): the freshness
           gate compares each source's last commit against the page's and flags pages whose code
           moved after the prose did (`pnpm support:docs-check`). This is the mechanism behind the
           docs auto-update program (plans/2026-08-26-support-docs-automation.md, Dan 2026-08-26).
           Paths must exist — the gate fails on a path that has gone away, because a dangling source
           means either the code moved (re-point it) or the feature is gone (rewrite the page). */
        sources: z.array(z.string()).optional(),
      }),
    }),
  }),
};
