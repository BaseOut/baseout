import type { Meta, StoryObj } from '@storybook/html-vite';
import Card from './Card.astro';
import { renderAstro } from '../../../.storybook/render-astro';

interface CardArgs {
  variant: 'default' | 'elevated' | 'outlined' | 'tonal' | 'primary';
  hover: boolean;
  /** Story-only: becomes the card's default slot (peeled off before props). */
  body: string;
}

const variants = ['default', 'elevated', 'outlined', 'tonal', 'primary'] as const;

const sampleBody = `
  <h3 class="font-headline font-semibold text-lg mb-1">Production Space</h3>
  <p class="text-sm opacity-70">3 connections · last backup 2 hours ago</p>
`;

const meta: Meta<CardArgs> = {
  title: 'UI/Card',
  loaders: [
    async ({ args: { body, ...props } }) => ({ html: await renderAstro(Card, { props, slots: body }) }),
  ],
  render: (_args, { loaded }) => loaded.html,
  args: { variant: 'default', hover: false, body: sampleBody },
  argTypes: {
    variant: { control: 'select', options: variants },
    hover: { control: 'boolean' },
    body: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<CardArgs>;

export const Default: Story = {};
export const Elevated: Story = { args: { variant: 'elevated' } };
export const Primary: Story = { args: { variant: 'primary' } };
export const Hoverable: Story = { args: { variant: 'outlined', hover: true } };

/** Every variant in one frame — the catalog view. */
export const AllVariants: Story = {
  loaders: [
    async () => {
      const parts = await Promise.all(
        variants.map((v) =>
          renderAstro(Card, {
            props: { variant: v },
            slots: `<h3 class="font-headline font-semibold text-lg mb-1">${v}</h3><p class="text-sm opacity-70">Card variant sample</p>`,
          }),
        ),
      );
      return { html: `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">${parts.join('')}</div>` };
    },
  ],
  render: (_args, { loaded }) => loaded.html,
};
