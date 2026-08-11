import type { Meta, StoryObj } from '@storybook/html-vite';
import Breadcrumbs from './Breadcrumbs.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface Crumb {
  label: string;
  href?: string;
  icon?: string;
}

interface BreadcrumbsArgs {
  items: Crumb[];
}

const meta: Meta<BreadcrumbsArgs> = {
  title: 'UI/Breadcrumbs',
  loaders: [async ({ args }) => ({ html: await renderAstro(Breadcrumbs, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: {
    items: [
      { label: 'Spaces', href: '/spaces', icon: 'folder' },
      { label: 'Production', href: '/spaces/prod' },
      { label: 'Backups' },
    ],
  },
  argTypes: {
    items: { control: 'object' },
  },
};
export default meta;

type Story = StoryObj<BreadcrumbsArgs>;

export const Default: Story = {};

export const TwoLevels: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Settings' },
    ],
  },
};

export const WithIcons: Story = {
  args: {
    items: [
      { label: 'Organization', href: '/org', icon: 'building' },
      { label: 'Space', href: '/org/space', icon: 'folder' },
      { label: 'Connection', icon: 'plug' },
    ],
  },
};
