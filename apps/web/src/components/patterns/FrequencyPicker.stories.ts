import type { Meta, StoryObj } from '@storybook/html-vite';
import FrequencyPicker from './FrequencyPicker.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { frequencyPickerFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/FrequencyPicker',
  loaders: [async () => ({ html: await renderAstro(FrequencyPicker, { props: frequencyPickerFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
