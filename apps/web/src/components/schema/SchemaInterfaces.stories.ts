import type { Meta, StoryObj } from '@storybook/html-vite';
import Comp from './SchemaInterfaces.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * SchemaInterfaces — Growth-gated Interfaces tab body. Catalog render uses the
 * upsell empty state (canUse=false) so Storybook stays fixture-free; live listing
 * + mergeInterfaceSources provenance + Drawer CRUD run in apps/web.
 */
const meta: Meta = {
  title: 'Schema/SchemaInterfaces',
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
