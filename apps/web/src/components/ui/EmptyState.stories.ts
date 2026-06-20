import type { Meta, StoryObj } from '@storybook/html-vite';
import EmptyState from './EmptyState.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface EmptyStateArgs {
  icon: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  compact: boolean;
}

const meta: Meta<EmptyStateArgs> = {
  title: 'UI/EmptyState',
  loaders: [async ({ args }) => ({ html: await renderAstro(EmptyState, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    icon: 'lucide--database',
    title: 'No backups yet',
    description: 'Run your first backup to start building an audit trail for this Space.',
    actionHref: '/backups/run',
    actionLabel: 'Run backup now',
    compact: false,
  },
  argTypes: {
    icon: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
    actionHref: { control: 'text' },
    actionLabel: { control: 'text' },
    compact: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<EmptyStateArgs>;

export const Default: Story = {};
export const Compact: Story = { args: { compact: true, actionHref: undefined, actionLabel: undefined } };
