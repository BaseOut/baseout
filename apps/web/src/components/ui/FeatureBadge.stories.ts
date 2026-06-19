import type { Meta, StoryObj } from '@storybook/html-vite';
import FeatureBadge from './FeatureBadge.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface FeatureBadgeArgs {
  icon: string;
  label: string;
  variant: 'default' | 'outline' | 'filled' | 'glass';
  size: 'sm' | 'md' | 'lg';
  iconFilled: boolean;
}

const variants = ['default', 'outline', 'filled', 'glass'] as const;

const meta: Meta<FeatureBadgeArgs> = {
  title: 'UI/FeatureBadge',
  loaders: [async ({ args }) => ({ html: await renderAstro(FeatureBadge, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { icon: 'shield-check', label: 'Encrypted at rest', variant: 'default', size: 'md', iconFilled: false },
  argTypes: {
    icon: { control: 'text' },
    label: { control: 'text' },
    variant: { control: 'inline-radio', options: variants },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    iconFilled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<FeatureBadgeArgs>;

export const Default: Story = {};
export const Outline: Story = { args: { variant: 'outline', icon: 'zap', label: 'Realtime' } };
export const Filled: Story = { args: { variant: 'filled', icon: 'cloud', label: 'Managed storage' } };

/** Every variant in one frame. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(
        variants.map((v) => renderAstro(FeatureBadge, { props: { variant: v, icon: 'shield-check', label: v } })),
      );
      return { html: `<div class="flex flex-wrap items-center gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};

/** Every size in one frame. */
export const AllSizes: Story = {
  loaders: [
    async () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      const parts = await Promise.all(
        sizes.map((s) => renderAstro(FeatureBadge, { props: { size: s, icon: 'zap', label: s } })),
      );
      return { html: `<div class="flex flex-wrap items-center gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
