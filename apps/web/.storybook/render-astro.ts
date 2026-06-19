import { experimental_AstroContainer as AstroContainer } from 'astro/container';

/**
 * Render a pure (no client-island) .astro component to an HTML string, for a
 * @storybook/html-vite story. Storybook has no Astro renderer, so we drive
 * Astro's Container API directly.
 *
 * NOTE: this renders STRUCTURE + scoped styles only — it does NOT execute a
 * component's client `<script>` (e.g. Modal's auto-open). Behaviour is exercised
 * in apps/design (a real Astro server) or via a Storybook `play` function.
 *
 * The component type is intentionally loose: Vite/esbuild strips types at build,
 * and the Container validates the component at render time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstroComponent = any;

export interface RenderAstroOptions {
  props?: Record<string, unknown>;
  /** Default-slot HTML string, or a named-slot map. */
  slots?: string | Record<string, string>;
}

let containerPromise: Promise<Awaited<ReturnType<typeof AstroContainer.create>>> | null = null;
function getContainer() {
  return (containerPromise ??= AstroContainer.create());
}

export async function renderAstro(
  Component: AstroComponent,
  { props = {}, slots }: RenderAstroOptions = {},
): Promise<string> {
  const container = await getContainer();
  const slotArg = typeof slots === 'string' ? { default: slots } : (slots ?? {});
  return container.renderToString(Component, { props, slots: slotArg });
}
