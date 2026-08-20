import type { Meta, StoryObj } from '@storybook/html-vite';
import RecipientInput from './RecipientInput.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Reports/RecipientInput',
  loaders: [
    async () => ({
      html: await renderAstro(RecipientInput, {
        props: {
          name: 'story-rcp',
          members: [
            { email: 'ada@example.com', name: 'Ada' },
            { email: 'grace@example.com', name: 'Grace' },
          ],
          cap: 10,
        },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Empty: Story = {};
