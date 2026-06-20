import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { SB_ENTRIES } from '../../../design/src/lib/storybook';

type Classification =
  | 'ui-primitive-storybook'
  | 'daisyui-direct-styleguide'
  | 'storybook-pattern';

interface ComponentClassification {
  classification: Classification;
  rationale: string;
  styleguideId?: string;
  designHarnessPath?: string;
}

const componentDir = fileURLToPath(new URL('.', import.meta.url));
const webSrcDir = fileURLToPath(new URL('../', import.meta.url));
const webRootDir = dirname(webSrcDir);
const designSrcDir = fileURLToPath(new URL('../../../design/src/', import.meta.url));
const registryPath = join(componentDir, 'component-classification.json');

function listAstroComponents(dir = componentDir, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return listAstroComponents(join(dir, entry.name), relative);
    return entry.isFile() && entry.name.endsWith('.astro') ? [relative] : [];
  });
}

const tracked = listAstroComponents().sort();

function loadRegistry(): Record<string, ComponentClassification> {
  return JSON.parse(readFileSync(registryPath, 'utf8')) as Record<string, ComponentClassification>;
}

describe('component catalog classification', () => {
  it('has a component classification registry', () => {
    expect(existsSync(registryPath)).toBe(true);
  });

  it('classifies every tracked component', () => {
    const registry = loadRegistry();
    expect(Object.keys(registry).sort()).toEqual(tracked.sort());
  });

  it('forbids legacy custom-exception classifications', () => {
    const raw = readFileSync(registryPath, 'utf8');
    expect(raw).not.toContain('custom-exception-approved');
    expect(raw).not.toContain('pattern-in-design-app');
  });

  it('requires a Storybook story for every tracked component', () => {
    for (const component of tracked) {
      const story = join(componentDir, component.replace(/\.astro$/, '.stories.ts'));
      expect(existsSync(story), `${component} must have a sibling Storybook story`).toBe(true);
    }
  });

  it('requires stories for Storybook primitives', () => {
    const registry = loadRegistry();
    for (const [component, entry] of Object.entries(registry)) {
      if (entry.classification !== 'ui-primitive-storybook') continue;
      const story = join(componentDir, component.replace(/\.astro$/, '.stories.ts'));
      expect(existsSync(story), `${component} is Storybook-first and needs a story`).toBe(true);
    }
  });

  it('uses shared design fixtures for Storybook pattern stories', () => {
    const fixturePath = join(designSrcDir, 'fixtures/component-catalog.ts');
    expect(existsSync(fixturePath), 'apps/design should expose shared component catalog fixtures').toBe(true);

    const registry = loadRegistry();
    for (const [component, entry] of Object.entries(registry)) {
      if (entry.classification !== 'storybook-pattern') continue;
      const storyPath = join(componentDir, component.replace(/\.astro$/, '.stories.ts'));
      const story = readFileSync(storyPath, 'utf8');
      expect(
        story.includes('../../../../design/src/fixtures/component-catalog'),
        `${component} story should import shared component catalog fixtures`,
      ).toBe(true);
    }
  });

  it('links classified styleguide entries to apps/design /styleguide ids', () => {
    const registry = loadRegistry();
    const styleguideIds = new Set(SB_ENTRIES.map((entry) => entry.id));
    for (const [component, entry] of Object.entries(registry)) {
      if (!entry.styleguideId) continue;
      expect(
        styleguideIds.has(entry.styleguideId),
        `${component} points at missing styleguide entry ${entry.styleguideId}`,
      ).toBe(true);
    }
  });

  it('keeps apps/design styleguide references resolvable', () => {
    for (const entry of SB_ENTRIES) {
      if (!entry.reference?.startsWith('components/') && !entry.reference?.startsWith('views/')) continue;
      const references = entry.reference
        .split('·')
        .map((part) => part.trim().replace(/\s+\(.+\)$/, ''))
        .filter((part) => part.endsWith('.astro'));

      for (const reference of references) {
        expect(
          existsSync(join(webSrcDir, reference)),
          `${entry.id} points at missing styleguide reference ${reference}`,
        ).toBe(true);
      }
    }
  });

  it('links Storybook primitives bidirectionally to styleguide references', () => {
    const registry = loadRegistry();
    const byId = new Map(SB_ENTRIES.map((entry) => [entry.id, entry]));
    for (const [component, entry] of Object.entries(registry)) {
      if (entry.classification !== 'ui-primitive-storybook') continue;
      expect(entry.styleguideId, `${component} needs a styleguideId`).toBeTruthy();
      const styleguideEntry = byId.get(entry.styleguideId as string);
      expect(styleguideEntry?.group, `${component} must link to a primitive styleguide entry`).toBe('Primitives');
      expect(
        styleguideEntry?.reference?.split('·').map((part) => part.trim()).includes(`components/${component}`),
        `${component} must be referenced by styleguide entry ${entry.styleguideId}`,
      ).toBe(true);
    }
  });

  it('keeps storybook-pattern classifications tied to pattern entries and design harnesses', () => {
    const registry = loadRegistry();
    const byId = new Map(SB_ENTRIES.map((entry) => [entry.id, entry]));
    for (const [component, entry] of Object.entries(registry)) {
      if (entry.classification !== 'storybook-pattern') continue;
      expect(entry.styleguideId, `${component} needs a pattern styleguideId`).toBeTruthy();
      const styleguideEntry = byId.get(entry.styleguideId as string);
      expect(styleguideEntry?.group, `${component} must link to a Patterns styleguide entry`).toBe('Patterns');
      expect(entry.designHarnessPath, `${component} needs a designHarnessPath`).toBeTruthy();
      expect(
        existsSync(join(designSrcDir, entry.designHarnessPath as string)),
        `${component} points at missing design harness ${entry.designHarnessPath}`,
      ).toBe(true);
    }
  });

  it('forbids component-level style blocks in classified components', () => {
    for (const component of tracked) {
      const source = readFileSync(join(componentDir, component), 'utf8');
      expect(source.includes('<style>'), `${component} must not use a scoped <style> block — use daisyUI utilities`).toBe(false);
    }
  });

  it('keeps repeated raw view markup behind explicit audit allowlists', () => {
    const rawMarkupAuditAllowlist = JSON.parse(
      readFileSync(join(componentDir, 'raw-markup-audit-allowlist.json'), 'utf8'),
    ) as Record<string, string[]>;

    const viewsDir = join(webRootDir, 'src/views');
    const output = readdirSync(viewsDir)
      .filter((path) => path.endsWith('.astro'))
      .filter((path) => /class="[^"]*(btn|badge|card|alert|input|select|table|dropdown|pagination)/.test(
        readFileSync(join(viewsDir, path), 'utf8'),
      ))
      .map((path) => normalize(`src/views/${path}`))
      .sort();

    expect(Object.keys(rawMarkupAuditAllowlist).sort()).toEqual(output);
    for (const [path, reasons] of Object.entries(rawMarkupAuditAllowlist)) {
      expect(reasons.length, `${path} needs at least one allowlist reason`).toBeGreaterThan(0);
    }
  });
});
