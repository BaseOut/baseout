import type { Meta, StoryObj } from '@storybook/html-vite';
import Select from './Select.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface Option {
  value: string;
  label: string;
}

interface SelectArgs {
  label?: string;
  name?: string;
  value?: string;
  options: Option[];
  placeholder?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  hint?: string;
  required: boolean;
  disabled: boolean;
}

const sampleOptions: Option[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const meta: Meta<SelectArgs> = {
  title: 'UI/Select',
  loaders: [async ({ args }) => ({ html: await renderAstro(Select, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    label: 'Backup schedule',
    options: sampleOptions,
    placeholder: 'Choose a cadence',
    required: false,
    disabled: false,
  },
  argTypes: {
    label: { control: 'text' },
    name: { control: 'text' },
    value: { control: 'text' },
    options: { control: 'object' },
    placeholder: { control: 'text' },
    icon: { control: 'text' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    error: { control: 'text' },
    hint: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<SelectArgs>;

export const Default: Story = {};
export const WithIcon: Story = { args: { icon: 'calendar', value: 'weekly' } };
export const WithHint: Story = { args: { hint: 'Runs at 02:00 UTC in your Space timezone.' } };
export const WithError: Story = { args: { error: 'Select a backup cadence to continue.' } };
export const Disabled: Story = { args: { disabled: true, value: 'daily' } };

/** Every size in one frame. */
export const AllSizes: Story = {
  loaders: [
    async () => {
      const sizes = ['sm', 'md', 'lg'] as const;
      const parts = await Promise.all(
        sizes.map((s) =>
          renderAstro(Select, { props: { size: s, label: s, options: sampleOptions, placeholder: 'Choose…' } }),
        ),
      );
      return { html: `<div class="flex flex-col gap-4 p-4 max-w-sm">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
