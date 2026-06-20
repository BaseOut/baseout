import type { Meta, StoryObj } from '@storybook/html-vite';
import PageHeader from './PageHeader.astro';
import Button from './Button.astro';
import Badge from './Badge.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface PageHeaderArgs {
  title: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  withMeta: boolean;
  withActions: boolean;
}

async function render(args: PageHeaderArgs) {
  const slots: Record<string, string> = {};
  if (args.withMeta) {
    slots.meta = await renderAstro(Badge, { props: { variant: 'success', size: 'sm', dot: true }, slots: 'Healthy' });
  }
  if (args.withActions) {
    slots.actions = await renderAstro(Button, { props: { href: '/backups/run' }, slots: 'Run backup now' });
  }
  const { withMeta, withActions, ...props } = args;
  void withMeta;
  void withActions;
  return renderAstro(PageHeader, { props, slots });
}

const meta: Meta<PageHeaderArgs> = {
  title: 'UI/PageHeader',
  loaders: [async ({ args }) => ({ html: await render(args) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    title: 'Backups',
    description: 'Review run history, failures, and captured data depth.',
    eyebrow: 'Space',
    backHref: '',
    backLabel: '',
    withMeta: true,
    withActions: true,
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    eyebrow: { control: 'text' },
    backHref: { control: 'text' },
    backLabel: { control: 'text' },
    withMeta: { control: 'boolean' },
    withActions: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<PageHeaderArgs>;

export const Default: Story = {};
export const Detail: Story = { args: { title: 'Airtable source', eyebrow: undefined, backHref: '/sources', backLabel: 'Back to sources', withMeta: true, withActions: true } };
