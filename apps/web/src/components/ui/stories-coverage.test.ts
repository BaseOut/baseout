import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Enforces CLAUDE.md §2.5: every `ui/` component has a Storybook story.
 *
 * Components are enumerated from git-TRACKED `*.astro` files (not a raw directory
 * read) so parked/untracked WIP — e.g. `StatusBadge.astro` from the un-merged
 * web-ui-standardization change — isn't required to have a story until it actually
 * lands. The moment such a file is committed, this test starts requiring its story.
 */
const uiDir = fileURLToPath(new URL('.', import.meta.url));

const tracked = execSync("git ls-files '*.astro'", { cwd: uiDir, encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.includes('/')); // direct children of ui/ only

describe('ui/ component story coverage (CLAUDE.md §2.5)', () => {
  it('finds tracked ui components', () => {
    expect(tracked.length).toBeGreaterThan(0);
  });

  it.each(tracked)('%s has a sibling .stories.ts', (astro) => {
    const story = join(uiDir, astro.replace(/\.astro$/, '.stories.ts'));
    expect(
      existsSync(story),
      `Missing Storybook story for ${astro}. Every ui/ component needs a *.stories.ts (CLAUDE.md §2.5).`,
    ).toBe(true);
  });
});
