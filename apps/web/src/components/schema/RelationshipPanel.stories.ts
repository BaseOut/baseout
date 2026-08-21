import type { Meta, StoryObj } from '@storybook/html-vite';
import RelationshipPanel from './RelationshipPanel.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Schema/RelationshipPanel',
  loaders: [
    async () => ({
      html: await renderAstro(RelationshipPanel, {
        props: {
          relationships: [
            {
              id: 'r1',
              type: 'syncedViews',
              baseId: 'appDemo',
              baseName: 'Demo',
              a: { id: 'tblA', name: 'Synced', kind: 'table' },
              b: { id: 'tblB', name: 'Source', kind: 'table' },
              inferred: true,
              validity: 'valid',
            },
          ],
          tables: [
            { id: 'tblA', name: 'Synced', baseId: 'appDemo' },
            { id: 'tblB', name: 'Source', baseId: 'appDemo' },
          ],
          bases: [{ id: 'appDemo', name: 'Demo' }],
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
