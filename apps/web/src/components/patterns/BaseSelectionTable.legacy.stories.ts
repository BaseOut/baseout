// LEGACY rollback target (workspace-grouped picker promotion, 2026-07-29).
// Kept renderable so the rollback path stays verified; the live picker's
// stories live at integrations/BaseSelectionTable.stories.ts.
import type { Meta, StoryObj } from '@storybook/html-vite';
import BaseSelectionTable from './BaseSelectionTable.legacy.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { baseSelectionFixture } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/BaseSelectionTable (legacy)',
  loaders: [async () => ({ html: await renderAstro(BaseSelectionTable, { props: baseSelectionFixture }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Default: Story = {};
