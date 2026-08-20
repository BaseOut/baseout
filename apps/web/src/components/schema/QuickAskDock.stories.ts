import type { Meta, StoryObj } from '@storybook/html-vite';
import QuickAskDock from './QuickAskDock.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Schema/QuickAskDock',
  loaders: [
    async () => ({
      html: await renderAstro(QuickAskDock, {
        props: {
          threads: [],
          index: [
            {
              id: 'appDemo',
              kind: 'base',
              name: 'Demo',
              baseId: 'appDemo',
              baseName: 'Demo',
              health: 'green',
              hasDescription: false,
              childIds: [],
              docIds: [],
            },
          ],
          docs: [],
          noun: 'schema',
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Default: Story = {};
