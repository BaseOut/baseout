import type { Meta, StoryObj } from '@storybook/html-vite';
import Divider from './Divider.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface DividerArgs {
  text?: string;
  variant: 'default' | 'subtle' | 'strong' | 'dashed';
  orientation: 'horizontal' | 'vertical';
  spacing: 'none' | 'sm' | 'md' | 'lg';
}

const variants = ['default', 'subtle', 'strong', 'dashed'] as const;

const meta: Meta<DividerArgs> = {
  title: 'UI/Divider',
  loaders: [async ({ args }) => ({ html: await renderAstro(Divider, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { text: 'OR', variant: 'default', orientation: 'horizontal', spacing: 'md' },
  argTypes: {
    text: { control: 'text' },
    variant: { control: 'inline-radio', options: variants },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    spacing: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<DividerArgs>;

export const WithText: Story = {};
export const Plain: Story = { args: { text: undefined } };
export const Dashed: Story = { args: { variant: 'dashed', text: undefined } };

/** Every variant in one frame. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(
        variants.map((v) => renderAstro(Divider, { props: { variant: v, text: v } })),
      );
      return { html: `<div class="p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
