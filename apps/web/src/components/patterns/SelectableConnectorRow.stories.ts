import type { Meta, StoryObj } from '@storybook/html-vite';
import SelectableConnectorRow from './SelectableConnectorRow.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { connectorRowFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/SelectableConnectorRow',
  loaders: [
    async () => ({
      html: await renderAstro(SelectableConnectorRow, {
        props: connectorRowFixture,
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
