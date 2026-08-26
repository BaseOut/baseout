/**
 * Removes a route from the emitted sitemap.
 *
 * WHY THIS IS NOT `sitemap({ filter })`. Starlight injects `@astrojs/sitemap` itself — it checks
 * whether an integration named `@astrojs/sitemap` is already present and adds its own when there is
 * not (`@astrojs/starlight/index.ts`, the `allIntegrations.find` guard). Configuring that instance
 * with a filter means declaring the integration ourselves, which means importing `@astrojs/sitemap`
 * directly, which means adding a dependency to an app whose whole dependency list is three
 * packages. This app is a fully static build with no adapter for the same reason. So the sitemap is
 * generated exactly as it is today and one entry is taken back out of it afterwards.
 *
 * IT REGISTERS ITSELF TWICE, AND THAT IS ORDERING RATHER THAN cleverness. `astro:build:done` runs
 * in integration order, and the integration that WRITES the sitemap is one Starlight appends during
 * its own `astro:config:setup` — so it lands after everything the config file declares. Measured:
 * declared normally, this hook ran first and found no sitemap at all. The outer integration
 * therefore does nothing but append the real one from ITS config:setup, which puts it after the
 * three Starlight appended, and the pruner runs last.
 *
 * IT FAILS LOUDLY IF THE SITEMAP IS NOT THERE. If that ordering ever changes back, the throw below
 * is what says so — the alternative is a page quietly re-entering the index with nothing anywhere
 * reporting it, which is the failure mode this whole exclusion exists to prevent.
 *
 * The `noindex` meta tag on the page is the other half and neither is sufficient alone: `noindex`
 * asks a crawler not to keep the page, and a sitemap entry asks it to come and look.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string[]} paths Route paths to remove, e.g. `['/handoff/']`.
 * @returns {import('astro').AstroIntegration}
 */
export function pruneSitemap(paths) {
  return {
    name: 'baseout:prune-sitemap',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({ integrations: [pruner(paths)] });
      },
    },
  };
}

/**
 * @param {string[]} paths
 * @returns {import('astro').AstroIntegration}
 */
function pruner(paths) {
  return {
    name: 'baseout:prune-sitemap:run',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const files = readdirSync(outDir).filter(
          (f) => f.startsWith('sitemap-') && f.endsWith('.xml') && f !== 'sitemap-index.xml',
        );

        if (!files.length) {
          throw new Error(
            'prune-sitemap: no sitemap-*.xml in the build output. Either the sitemap integration ' +
              'stopped running, or it now runs AFTER this hook — in which case the exclusion of ' +
              `${paths.join(', ')} is no longer happening and the page is back in the index.`,
          );
        }

        let removed = 0;
        for (const file of files) {
          const full = join(outDir, file);
          const before = readFileSync(full, 'utf8');
          /* One `<url>` element per entry, and the match is on the PATH so the `site` origin is not
             written down a second time here. */
          const after = before.replace(/<url>\s*<loc>([^<]*)<\/loc>.*?<\/url>/g, (whole, loc) => {
            const path = new URL(loc).pathname;
            if (!paths.includes(path)) return whole;
            removed++;
            return '';
          });
          if (after !== before) writeFileSync(full, after);
        }

        if (removed !== paths.length) {
          throw new Error(
            `prune-sitemap: expected to remove ${paths.length} entr(y|ies) (${paths.join(', ')}) ` +
              `but removed ${removed}. A path that is not in the sitemap is a path that was renamed ` +
              'or never built, and this list is now lying about what it excludes.',
          );
        }

        logger.info(`pruned ${removed} route(s) from the sitemap: ${paths.join(', ')}`);
      },
    },
  };
}
