import type { Meta, StoryObj } from '@storybook/html-vite';
import SpacePipelineHero from './SpacePipelineHero.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { spacePipelineFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/SpacePipelineHero',
  loaders: [async () => ({ html: await renderAstro(SpacePipelineHero, { props: spacePipelineFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
