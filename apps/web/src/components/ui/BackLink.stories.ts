import type { Meta, StoryObj } from '@storybook/html-vite';
import BackLink from './BackLink.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface BackLinkArgs {
  href: string;
  label: string;
}

const meta: Meta<BackLinkArgs> = {
  title: 'UI/BackLink',
  loaders: [async ({ args }) => ({ html: await renderAstro(BackLink, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { href: '/sources', label: 'Back to sources' },
  argTypes: {
    href: { control: 'text' },
    label: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<BackLinkArgs>;

export const Default: Story = {};
