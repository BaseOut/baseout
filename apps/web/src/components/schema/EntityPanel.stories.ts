import type { Meta, StoryObj } from '@storybook/html-vite';
import EntityPanel from './EntityPanel.astro';
import { renderAstro } from '../../../.storybook/render-astro';

/**
 * Phase 8 stub — full EntityPanel ships with Schema Automations/Interfaces.
 * Story exists so the classification/story gate stays green for the stub file.
 */

const meta: Meta = {
  title: 'Schema/EntityPanel (Reports stub)',
  loaders: [async () => ({ html: await renderAstro(EntityPanel, { props: {} }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Stub: Story = {};
