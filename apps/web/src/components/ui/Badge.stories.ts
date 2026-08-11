import type { Meta, StoryObj } from '@storybook/html-vite';
import Badge from './Badge.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface BadgeArgs {
  variant: 'default' | 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error' | 'primary-solid' | 'success-solid' | 'error-solid';
  size?: 'sm' | 'md' | 'lg';
  outline: boolean;
  dot: boolean;
  /** Story-only: becomes the badge's default slot (peeled off before props). */
  label: string;
}

const variants = [
  'default', 'primary', 'secondary', 'tertiary', 'success', 'warning',
  'error', 'primary-solid', 'success-solid', 'error-solid',
] as const;

const meta: Meta<BadgeArgs> = {
  title: 'UI/Badge',
  loaders: [
    async ({ args: { label, ...props } }) => ({ html: await renderAstro(Badge, { props, slots: label }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { variant: 'primary', outline: false, dot: false, label: 'Active' },
  argTypes: {
    variant: { control: 'select', options: variants },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    outline: { control: 'boolean' },
    dot: { control: 'boolean' },
    label: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<BadgeArgs>;

export const Primary: Story = {};
export const Solid: Story = { args: { variant: 'success-solid', label: 'Live' } };
export const WithDot: Story = { args: { variant: 'success', dot: true, label: 'Online' } };
export const Outlined: Story = { args: { variant: 'error', outline: true, label: 'Failed' } };

/** Every variant in one frame — the catalog view. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(variants.map((v) => renderAstro(Badge, { props: { variant: v }, slots: v })));
      return { html: `<div class="flex flex-wrap items-center gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
