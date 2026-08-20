import type { Meta, StoryObj } from '@storybook/html-vite';
import UndoToast from './UndoToast.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'UI/UndoToast',
  loaders: [async () => ({ html: await renderAstro(UndoToast, { props: {} }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Mount: Story = {};
