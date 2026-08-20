import type { Meta, StoryObj } from '@storybook/html-vite';
import ReportBodyKpi from './ReportBodyKpi.astro';
import { renderAstro } from '../../../.storybook/render-astro';
import type { ReportDetail } from '../../lib/reports/types';

const emptySection = {
  tone: 'success' as const,
  statusLabel: 'Healthy',
  stats: [],
  rows: [],
  emptyLine: 'No issues this period.',
};

/** Minimal clean document so the body renders without fixtures. */
const report: ReportDetail = {
  id: 'story-run',
  windowStart: '2026-08-01T00:00:00Z',
  windowEnd: '2026-08-08T00:00:00Z',
  generatedAt: '2026-08-08T12:00:00Z',
  generationState: 'generated',
  trigger: { kind: 'manual', by: 'Story' },
  status: 'healthy',
  backupsOk: 0,
  backupsFailed: 0,
  delivery: null,
  strip: [],
  backupSummary: { ...emptySection, emptyLine: 'No backup issues this period.' },
  connectionHealth: { ...emptySection, emptyLine: 'No connection issues this period.' },
  schemaHealth: { ...emptySection, emptyLine: 'No schema issues this period.' },
  documentation: { ...emptySection, emptyLine: 'No documentation updates this period.' },
};

const meta: Meta = {
  title: 'Reports/ReportBodyKpi',
  loaders: [
    async () => ({
      html: await renderAstro(ReportBodyKpi, {
        props: { report, sections: ['backups', 'connections', 'schema', 'docs'] },
      }),
    }),
  ],
  render: (_args, { loaded }) => loaded.html,
};
export default meta;

type Story = StoryObj;
export const Clean: Story = {};
