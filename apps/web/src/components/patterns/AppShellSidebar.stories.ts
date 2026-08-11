import type { Meta, StoryObj } from '@storybook/html-vite';
import AppShellSidebar from './AppShellSidebar.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { appShellSidebarFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/AppShellSidebar',
  loaders: [async () => ({ html: await renderAstro(AppShellSidebar, { props: appShellSidebarFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
