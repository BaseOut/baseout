/**
 * Honest copy for the definition page's Most Recent empty card.
 * Never invents a generated timestamp, never ellipsizes the call-to-action.
 */
export function latestRunPreviewCopy(input: { generatedAt: string | null }): {
  when: string
  body: string
} {
  const when = input.generatedAt
    ? `Generated ${input.generatedAt}`
    : 'Not yet generated'
  return {
    when,
    body: 'Open it for the full breakdown.',
  }
}
