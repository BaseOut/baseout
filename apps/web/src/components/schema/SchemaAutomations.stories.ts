import type { Meta, StoryObj } from '@storybook/html-vite';
import Comp from './SchemaAutomations.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * SchemaAutomations — Growth-gated Automations tab body. Catalog render uses the
 * upsell empty state (canUse=false) so Storybook stays fixture-free; live listing
 * + Drawer CRUD run against the space proxies in apps/web.
 */
const meta: Meta = {
  title: 'Schema/SchemaAutomations',
  loaders: [
    async () => ({
      html: await renderAstro(Comp, {
        props: {
          bases: [{ baseId: 'appX', name: 'Demo Base' }],
          tagItems: [],
          canUse: false,
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const BelowGrowthUpsell: Story = {};
