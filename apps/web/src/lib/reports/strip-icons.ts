/** Map engine report-strip icon ids onto catalog lucide classes. */
const SHORT_TO_LUCIDE: Record<string, string> = {
  database: 'lucide--database-backup',
  plug: 'lucide--plug-zap',
  layers: 'lucide--list-tree',
  'file-text': 'lucide--file-text',
}

export function lucideStripIcon(icon: string): string {
  if (icon.startsWith('lucide--')) return icon
  return SHORT_TO_LUCIDE[icon] ?? `lucide--${icon}`
}
