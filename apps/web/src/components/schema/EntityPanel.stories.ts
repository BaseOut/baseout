import type { Meta, StoryObj } from '@storybook/html-vite';
import EntityPanel from './EntityPanel.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * Phase 13 EntityPanel — shared stacking drawer (Airtable descriptions read-only).
 * Full schema index stories expand as Browse promotion lands.
 */

const meta: Meta = {
  title: 'Schema/EntityPanel',
  loaders: [
    async () => ({
      html: await renderAstro(EntityPanel, {
        props: {
          index: [
            {
              id: 'appDemo',
              kind: 'base',
              name: 'Demo',
              baseId: 'appDemo',
              baseName: 'Demo',
              health: 'green',
              hasDescription: true,
              airtableDescription: 'Airtable base description (read-only).',
              userDescription: 'Internal note from description_override.',
              childIds: [],
              docIds: [],
            },
          ],
          docs: [],
          changelog: [],
          automations: [],
          interfaces: [],
          chatThreads: [],
          aiState: 'ready',
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
