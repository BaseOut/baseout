import type { Meta, StoryObj } from '@storybook/html-vite';
import TextInput from './TextInput.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface TextInputArgs {
  label?: string;
  type: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
  name?: string;
  placeholder?: string;
  value?: string;
  icon?: string;
  iconRight?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  success: boolean;
  hint?: string;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
}

const meta: Meta<TextInputArgs> = {
  title: 'UI/TextInput',
  loaders: [async ({ args }) => ({ html: await renderAstro(TextInput, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    label: 'Work email',
    type: 'email',
    placeholder: 'you@example.com',
    success: false,
    required: false,
    disabled: false,
    readonly: false,
  },
  argTypes: {
    label: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'tel', 'url', 'number'] },
    name: { control: 'text' },
    placeholder: { control: 'text' },
    value: { control: 'text' },
    icon: { control: 'text' },
    iconRight: { control: 'text' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    error: { control: 'text' },
    success: { control: 'boolean' },
    hint: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<TextInputArgs>;

export const Default: Story = {};
export const WithIcon: Story = { args: { label: 'Search', type: 'search', icon: 'search', placeholder: 'Search bases…' } };
export const WithError: Story = { args: { error: 'Enter a valid email address.', value: 'not-an-email' } };
export const WithHint: Story = { args: { hint: "We'll only use this for magic-link sign-in." } };
export const Disabled: Story = { args: { disabled: true, value: 'locked@example.com' } };

/** Every size in one frame. */
export const AllSizes: Story = {
  loaders: [
    async () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      const parts = await Promise.all(
        sizes.map((s) =>
          renderAstro(TextInput, { props: { size: s, label: s, placeholder: `${s} input`, icon: 'mail' } }),
        ),
      );
      return { html: `<div class="flex flex-col gap-4 p-4 max-w-sm">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
