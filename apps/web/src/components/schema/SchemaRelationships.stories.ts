import type { Meta, StoryObj } from '@storybook/html-vite';
import SchemaRelationships from './SchemaRelationships.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Schema/SchemaRelationships',
  loaders: [
    async () => ({
      html: await renderAstro(SchemaRelationships, {
        props: {
          relationships: [
            {
              id: 'r1',
              type: 'linkedRecords',
              baseId: 'appDemo',
              baseName: 'Demo',
              a: { id: 'tblA', name: 'Deals', kind: 'table' },
              b: { id: 'tblB', name: 'Contacts', kind: 'table' },
              direction: 'two',
              cardinality: 'm:m',
              validity: 'valid',
            },
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
