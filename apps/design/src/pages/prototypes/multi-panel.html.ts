// Serves the multi-panel schema drawer redesign prototype (Dan's video + Track A/B research) as a
// full self-contained HTML document so its inline <script> runs. Single source: the raw file is
// imported from research/ via Vite `?raw`, bundled at build (works on Node dev + Cloudflare deploy).
// Durable source + porting notes live in research/multi-panel-drawer/. Not production.
import prototypeHtml from '../../../research/multi-panel-drawer/prototype.html?raw';

export const prerender = true;

export function GET() {
  return new Response(prototypeHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
