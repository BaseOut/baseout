import type { Meta, StoryObj } from '@storybook/html-vite';
import AppShellHeader from './AppShellHeader.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { appShellHeaderFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/AppShellHeader',
  loaders: [async () => ({ html: await renderAstro(AppShellHeader, { props: appShellHeaderFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
