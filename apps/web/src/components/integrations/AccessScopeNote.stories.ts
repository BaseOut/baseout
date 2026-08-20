import type { Meta, StoryObj } from '@storybook/html-vite';
import AccessScopeNote from './AccessScopeNote.astro';
import { renderAstro } from '../../../.storybook/render-astro';

const meta: Meta = {
  title: 'Integrations/AccessScopeNote',
  loaders: [async () => ({ html: await renderAstro(AccessScopeNote, { props: {} }) })],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;

/** Connect-time statement: the read-only guarantee + the exact scopes requested / not. */
export const Full: Story = {};

/** The short "Read-only" subhead fragment carrying the Airtable mark. */
export const Mark: Story = {
  loaders: [async () => ({ html: await renderAstro(AccessScopeNote, { props: { variant: 'mark' } }) })],
};
