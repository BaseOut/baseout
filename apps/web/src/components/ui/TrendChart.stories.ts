import type { Meta, StoryObj } from '@storybook/html-vite';
import TrendChart from './TrendChart.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'UI/TrendChart',
  loaders: [
    async () => ({
      html: await renderAstro(TrendChart, {
        props: {
          name: 'story-trend',
          categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          series: [{ name: 'Overall', data: [12, 18, 15, 22, 19] }],
          variant: 'full',
          format: 'number',
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Full: Story = {};
