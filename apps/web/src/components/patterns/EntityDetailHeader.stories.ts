import type { Meta, StoryObj } from '@storybook/html-vite';
import EntityDetailHeader from './EntityDetailHeader.astro';
import Button from '../ui/Button.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { entityHeaderFixture } from '../../../../design/src/fixtures/component-catalog';

async function render() {
  const actions = await renderAstro(Button, { props: { href: '/sources/detail?id=src_1&reconnected=1' }, slots: 'Reconnect' });
  return renderAstro(EntityDetailHeader, {
    props: entityHeaderFixture,
    slots: { actions },
  });
}

const meta: Meta = {
  title: 'Patterns/EntityDetailHeader',
  loaders: [async () => ({ html: await render() })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Source: Story = {};
