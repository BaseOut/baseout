import type { Meta, StoryObj } from '@storybook/html-vite';
import WizardStepper from './WizardStepper.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { setupSteps } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/WizardStepper',
  loaders: [async () => ({ html: await renderAstro(WizardStepper, { props: { steps: setupSteps } }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

export const Setup: Story = {};
