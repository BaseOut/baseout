import type { Meta, StoryObj } from '@storybook/html-vite';
import Button from './Button.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface ButtonArgs {
  variant: 'primary' | 'secondary' | 'tonal' | 'outline' | 'ghost' | 'danger' | 'danger-ghost' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading: boolean;
  disabled: boolean;
  /** Story-only: becomes the button's default slot (peeled off before props). */
  label: string;
}

const meta: Meta<ButtonArgs> = {
  title: 'UI/Button',
  // Container render is async → do it in a loader, render() returns the string.
  loaders: [
    async ({ args: { label, ...props } }) => ({ html: await renderAstro(Button, { props, slots: label }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { variant: 'primary', loading: false, disabled: false, label: 'Click me' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tonal', 'outline', 'ghost', 'danger', 'danger-ghost', 'success', 'warning'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<ButtonArgs>;

export const Primary: Story = {};
export const Loading: Story = { args: { loading: true, label: 'Saving…' } };
export const Danger: Story = { args: { variant: 'danger', label: 'Delete' } };

/** Every variant in one frame — the catalog view. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const variants = ['primary', 'secondary', 'tonal', 'outline', 'ghost', 'danger', 'danger-ghost', 'success', 'warning'] as const;
      const parts = await Promise.all(variants.map((v) => renderAstro(Button, { props: { variant: v }, slots: v })));
      return { html: `<div class="flex flex-wrap items-center gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
