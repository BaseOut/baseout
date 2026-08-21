import type { Meta, StoryObj } from '@storybook/html-vite';
import SchemaBrowse from './SchemaBrowse.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * Phase 13 SchemaBrowse — Tree/Flat explorer. Opens EntityPanel via data-entity-open.
 */

const meta: Meta = {
  title: 'Schema/SchemaBrowse',
  loaders: [
    async () => ({
      html: await renderAstro(SchemaBrowse, {
        props: {
          index: [
            {
              id: 'appDemo',
              kind: 'base',
              name: 'Demo',
              baseId: 'appDemo',
              baseName: 'Demo',
              health: 'green',
              hasDescription: false,
              childIds: ['tbl1'],
              docIds: [],
            },
            {
              id: 'tbl1',
              kind: 'table',
              name: 'Deals',
              baseId: 'appDemo',
              baseName: 'Demo',
              health: 'amber',
              hasDescription: true,
              airtableDescription: 'Pipeline',
              childIds: [],
              docIds: [],
              fieldCount: 0,
            },
          ],
          bases: [{ id: 'appDemo', name: 'Demo' }],
          docs: [],
          chatThreads: [],
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
