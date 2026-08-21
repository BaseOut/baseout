import type { Meta, StoryObj } from '@storybook/html-vite';
import SchemaChangelog from './SchemaChangelog.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Schema/SchemaChangelog',
  loaders: [
    async () => ({
      html: await renderAstro(SchemaChangelog, {
        props: {
          entries: [
            {
              id: '1',
              at: '2026-08-01T12:00:00.000Z',
              base: 'Demo',
              table: 'Deals',
              field: 'Amount',
              entityId: 'fld1',
              type: 'renamed',
              summary: 'Renamed Amount: Old → Amount',
              before: 'Old',
              after: 'Amount',
            },
          ],
          baseId: { Demo: 'appDemo' },
          tableId: { 'Demo::Deals': 'tbl1' },
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
