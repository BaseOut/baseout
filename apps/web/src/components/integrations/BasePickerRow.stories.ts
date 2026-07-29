import type { Meta, StoryObj } from '@storybook/html-vite';
import BasePickerRow from './BasePickerRow.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { basePickerRowFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/BasePickerRow',
  loaders: [async () => ({ html: await renderAstro(BasePickerRow, { props: basePickerRowFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
