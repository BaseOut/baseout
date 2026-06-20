import type { Meta, StoryObj } from '@storybook/html-vite';
import SectionPanel from './SectionPanel.astro';
import Button from './Button.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface SectionPanelArgs {
  title?: string;
  description?: string;
  variant: 'default' | 'tonal';
  padded: boolean;
  withActions: boolean;
  body: string;
}

async function render(args: SectionPanelArgs) {
  const slots: Record<string, string> = { default: args.body };
  if (args.withActions) {
    slots.actions = await renderAstro(Button, { props: { variant: 'ghost', size: 'sm' }, slots: 'View all' });
  }
  const { withActions, body, ...props } = args;
  void withActions;
  void body;
  return renderAstro(SectionPanel, { props, slots });
}

const meta: Meta<SectionPanelArgs> = {
  title: 'UI/SectionPanel',
  loaders: [async ({ args }) => ({ html: await render(args) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    title: 'Backup health',
    description: 'A grouped surface for related product information.',
    variant: 'default',
    padded: true,
    withActions: true,
    body: '<p class="text-sm text-base-content/70">Last successful backup completed 2 hours ago.</p>',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    variant: { control: 'inline-radio', options: ['default', 'tonal'] },
    padded: { control: 'boolean' },
    withActions: { control: 'boolean' },
    body: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<SectionPanelArgs>;

export const Default: Story = {};
export const Tonal: Story = { args: { variant: 'tonal' } };
