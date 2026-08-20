import type { Meta, StoryObj } from '@storybook/html-vite';
import SchemaHealth from './SchemaHealth.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Schema/SchemaHealth',
  loaders: [
    async () => ({
      html: await renderAstro(SchemaHealth, {
        props: {
          health: [
            {
              baseId: 'appDemo',
              baseName: 'Demo',
              score: 78,
              band: 'amber',
              metrics: [
                {
                  name: 'Descriptions',
                  tiers: ['Table', 'Field'],
                  score: 70,
                  weight: 40,
                  ruleId: 'r1',
                },
              ],
              issues: [{ severity: 'med', text: 'Missing field descriptions' }],
              insights: [],
            },
          ],
          aiState: 'locked',
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
