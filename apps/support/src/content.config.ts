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
      }),
    }),
  }),
};
