import type { Meta, StoryObj } from '@storybook/html-vite';
import SocialButton from './SocialButton.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface SocialButtonArgs {
  provider: 'google' | 'github' | 'apple' | 'microsoft' | 'slack';
  size: 'sm' | 'md' | 'lg';
  variant: 'outline' | 'filled';
  iconOnly: boolean;
  disabled: boolean;
}

const providers = ['google', 'github', 'apple', 'microsoft', 'slack'] as const;

const meta: Meta<SocialButtonArgs> = {
  title: 'UI/SocialButton',
  // The provider label is derived from the `provider` prop — no slot.
  loaders: [async ({ args }) => ({ html: await renderAstro(SocialButton, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { provider: 'google', size: 'md', variant: 'outline', iconOnly: false, disabled: false },
  argTypes: {
    provider: { control: 'select', options: providers },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    variant: { control: 'inline-radio', options: ['outline', 'filled'] },
    iconOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<SocialButtonArgs>;

export const Google: Story = {};
export const GitHubFilled: Story = { args: { provider: 'github', variant: 'filled' } };
export const IconOnly: Story = { args: { provider: 'apple', iconOnly: true } };
export const Disabled: Story = { args: { provider: 'slack', disabled: true } };

/** Every provider in one frame. */
export const AllProviders: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(providers.map((p) => renderAstro(SocialButton, { props: { provider: p } })));
      return { html: `<div class="flex flex-col gap-3 p-4 max-w-xs">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
