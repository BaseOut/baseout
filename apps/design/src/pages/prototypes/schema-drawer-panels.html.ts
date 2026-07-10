// Serves the multi-panel drawer research prototype as a full, self-contained HTML
// document so its inline <script> runs (a Astro set:html render would inject the
// markup as innerHTML and the scripts would never execute). Single source: the raw
// file is imported from research/ via Vite `?raw`, bundled at build (so it works on
// both the Node dev adapter and the Cloudflare deploy). Linked from /handoff.
// The durable source + porting notes live in research/schema-drawer-panels/.
import prototypeHtml from '../../../research/schema-drawer-panels/prototype.html?raw';

export const prerender = true;

export function GET() {
  return new Response(prototypeHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
