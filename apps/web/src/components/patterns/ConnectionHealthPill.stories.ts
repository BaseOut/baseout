import type { Meta, StoryObj } from '@storybook/html-vite';
import ConnectionHealthPill from './ConnectionHealthPill.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import { connectionHealthStates } from '../../../../design/src/fixtures/component-catalog';

const meta: Meta = {
  title: 'Patterns/ConnectionHealthPill',
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

// The pill is normally hidden until a broken bar is collapsed; the stories force
// it visible (data-chb-pill starts `hidden`) so its states render in isolation.
const state = (key: string): Story => {
  const entry = connectionHealthStates.find((s) => s.key === key)!;
  return {
    loaders: [
      async () => ({
        html: (await renderAstro(ConnectionHealthPill, { props: entry.props })).replace(' hidden ', ' '),
      }),
    ],
  };
};

export const BrokenSource = state('broken');
export const MultipleBroken = state('multiple');
export const Expiring = state('expiring');
