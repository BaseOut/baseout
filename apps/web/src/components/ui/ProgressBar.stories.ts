import type { Meta, StoryObj } from '@storybook/html-vite';
import ProgressBar from './ProgressBar.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface ProgressBarArgs {
  value: number;
  max: number;
  label?: string;
  showValue: boolean;
  variant: 'primary' | 'success' | 'warning' | 'error';
}

const variants = ['primary', 'success', 'warning', 'error'] as const;

const meta: Meta<ProgressBarArgs> = {
  title: 'UI/ProgressBar',
  loaders: [async ({ args }) => ({ html: await renderAstro(ProgressBar, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { value: 60, max: 100, label: 'Backing up bases', showValue: true, variant: 'primary' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    max: { control: 'number' },
    label: { control: 'text' },
    showValue: { control: 'boolean' },
    variant: { control: 'inline-radio', options: variants },
  },
};
export default meta;

type Story = StoryObj<ProgressBarArgs>;

export const Default: Story = {};
export const Complete: Story = { args: { value: 100, variant: 'success', label: 'Backup complete' } };
export const Counted: Story = { args: { value: 4, max: 12, label: 'Tables processed', showValue: true } };
export const Error: Story = { args: { value: 35, variant: 'error', label: 'Backup failed' } };

/** Every variant in one frame. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(
        variants.map((v) =>
          renderAstro(ProgressBar, { props: { value: 65, variant: v, label: v, showValue: true } }),
        ),
      );
      return { html: `<div class="flex flex-col gap-4 p-4 max-w-md">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
