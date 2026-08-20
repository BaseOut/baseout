import type { Meta, StoryObj } from '@storybook/html-vite';
import Alert from './Alert.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface AlertArgs {
  severity: 'info' | 'success' | 'warning' | 'error';
  trigger: 'static' | 'runtime' | 'overlay';
  title?: string;
  actionHref?: string;
  actionLabel?: string;
  dismissible: boolean;
  message: string;
}

const meta: Meta<AlertArgs> = {
  title: 'UI/Alert',
  loaders: [
    async ({ args: { message, ...props } }) => ({
      html: await renderAstro(Alert, { props: { ...props, message } }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: {
    severity: 'warning',
    trigger: 'static',
    title: 'Heads up.',
    message: 'Running this backup now will use additional credits.',
    dismissible: false,
  },
  argTypes: {
    severity: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
    trigger: { control: 'select', options: ['static', 'runtime', 'overlay'] },
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
export const RuntimeError: Story = {
  args: {
    severity: 'error',
    trigger: 'runtime',
    title: 'Save failed.',
    message: 'Could not reach the backup engine. Try again.',
  },
};
export const WithAction: Story = {
  args: {
    severity: 'error',
    title: 'Reconnect needed.',
    message: 'Airtable access expired.',
    actionHref: '/sources',
    actionLabel: 'Reconnect',
  },
};
export const Dismissible: Story = {
  args: {
    severity: 'success',
    title: 'Connected.',
    message: 'Google Drive is ready for backups.',
    dismissible: true,
  },
};

export const AllVariants: Story = {
  loaders: [
    async () => {
      const variants = ['info', 'success', 'warning', 'error'] as const;
      const parts = await Promise.all(
        variants.map((severity) =>
          renderAstro(Alert, {
            props: { severity, title: severity, message: 'This is the standard soft alert treatment.' },
          }),
        ),
      );
      return { html: `<div class="flex flex-col gap-3 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
