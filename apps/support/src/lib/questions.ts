/**
 * The questions people actually arrive with.
 *
 * ONE list, two surfaces: the landing renders them as links straight to the answer, and the chat
 * offers them as starters when it has no page to scope to. They are phrased as the reader's
 * question, not as our table of contents — and every one of them is answerable today, because all
 * five land in the finished "Backing up" section. Add to this only when the answer exists.
 */
export interface Starter {
  label: string;
  href: string;
}

export const POPULAR_QUESTIONS: Starter[] = [
  { label: 'Why can I not delete a backup run?', href: '/backups/running-a-backup/#why-you-cannot-delete-a-run' },
  { label: 'What does a backup actually capture?', href: '/backups/how-backups-work/#what-a-run-captures' },
  { label: 'How long are my backups kept?', href: '/backups/retention-and-cleanup/#the-cutoff-is-the-knob' },
  { label: 'Some attachments failed — what now?', href: '/backups/reading-a-run/#failed-attachments' },
  { label: 'Can schema and data run on different schedules?', href: '/backups/schedule-and-scope/#two-cadences-not-one' },
];

/** The three the chat offers when it has nothing to scope to. Fewer, because a panel is narrow. */
export const CHAT_STARTERS = POPULAR_QUESTIONS.slice(0, 3).map((q) => q.label);
