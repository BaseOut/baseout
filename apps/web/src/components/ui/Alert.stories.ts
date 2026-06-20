import type { Meta, StoryObj } from '@storybook/html-vite';
import Alert from './Alert.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface AlertArgs {
  variant: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  actionHref?: string;
  actionLabel?: string;
  dismissible: boolean;
  message: string;
}

const meta: Meta<AlertArgs> = {
  title: 'UI/Alert',
  loaders: [
    async ({ args: { message, ...props } }) => ({ html: await renderAstro(Alert, { props, slots: message }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { variant: 'warning', title: 'Heads up.', message: 'Running this backup now will use additional credits.', dismissible: false },
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
    title: { control: 'text' },
    actionHref: { control: 'text' },
    actionLabel: { control: 'text' },
    dismissible: { control: 'boolean' },
    message: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<AlertArgs>;

export const Warning: Story = {};
export const WithAction: Story = { args: { variant: 'error', title: 'Reconnect needed.', message: 'Airtable access expired.', actionHref: '/sources', actionLabel: 'Reconnect' } };
export const Dismissible: Story = { args: { variant: 'success', title: 'Connected.', message: 'Google Drive is ready for backups.', dismissible: true } };

export const AllVariants: Story = {
  loaders: [
    async () => {
      const variants = ['info', 'success', 'warning', 'error'] as const;
      const parts = await Promise.all(variants.map((variant) => renderAstro(Alert, { props: { variant, title: variant }, slots: 'This is the standard soft alert treatment.' })));
      return { html: `<div class="flex flex-col gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
