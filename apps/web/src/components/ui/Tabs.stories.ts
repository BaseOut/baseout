import type { Meta, StoryObj } from '@storybook/html-vite';
import Tabs from './Tabs.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  count?: number | string;
  disabled?: boolean;
}

interface TabsArgs {
  tabs: Tab[];
  name?: string;
  activeTab?: string;
  variant: 'underline' | 'pills' | 'pills-full' | 'boxed' | 'vertical' | 'submenu';
}

const variants = ['underline', 'pills', 'pills-full', 'boxed', 'vertical', 'submenu'] as const;

const sampleTabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'backups', label: 'Backups', count: 12 },
  { id: 'settings', label: 'Settings' },
  { id: 'audit', label: 'Audit log', disabled: true },
];

const meta: Meta<TabsArgs> = {
  title: 'UI/Tabs',
  loaders: [async ({ args }) => ({ html: await renderAstro(Tabs, { props: args }) })],
  render: (_args, { loaded }) => loaded.html,
  args: { tabs: sampleTabs, activeTab: 'overview', variant: 'underline' },
  argTypes: {
    tabs: { control: 'object' },
    name: { control: 'text' },
    activeTab: { control: 'text' },
    variant: { control: 'select', options: variants },
  },
};
export default meta;

type Story = StoryObj<TabsArgs>;

export const Underline: Story = {};
export const Pills: Story = { args: { variant: 'pills' } };
export const Boxed: Story = { args: { variant: 'boxed' } };
export const Vertical: Story = { args: { variant: 'vertical' } };

/** Every variant in one frame. Each gets a distinct radio-group name so they don't share selection. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(
        variants.map(
          (v) =>
            renderAstro(Tabs, { props: { variant: v, tabs: sampleTabs, name: `tabs-${v}` } }).then(
              (html) => `<div class="mb-2 text-xs uppercase tracking-widest opacity-50">${v}</div>${html}`,
            ),
        ),
      );
      return { html: `<div class="flex flex-col gap-6 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
