/**
 * Comment text + identity helpers (comments-explorer).
 *
 * A `.ts` sibling, not `.astro` frontmatter, per the "frontmatter stays thin" rule — and because
 * both the server render and any later thread view need the SAME resolution. Two rules diverging
 * on how a mention renders is how a raw id reaches the screen in one place and not the other.
 */
import type { DataComment, DataCommentAuthor, DataCommentMention } from './dataTypes';

/** Airtable writes mentions into `text` as raw `@[usrXXXXXXXX]` tokens. */
const MENTION_TOKEN = /@\[([^\]\s]+)\]/g;

/**
 * How a mention target is named, best → worst. A `userGroup` / `appAgent` resolves exactly like a
 * user — the kinds differ in what they point at, not in how they read.
 */
export const mentionLabel = (m: DataCommentMention): string | null => m.displayName || m.email || null;

/**
 * Replace every `@[id]` token with a readable `@Name`.
 *
 * The one hard rule: a raw id must NEVER survive into rendered text. Three cases, in order —
 *  1. the id is in `mentioned` and has a name/email → `@Name`;
 *  2. the id is in `mentioned` but is nameless (a stripped-down payload) → the token is REMOVED;
 *  3. the id is not in `mentioned` at all (the map was withheld, or the comment predates it) →
 *     the token is REMOVED.
 * Cases 2 and 3 lose information, which is the point: "@" followed by nothing is a small gap in a
 * sentence, while `@[usrL2PNC5o3H4lBEi]` is a leaked database key that no reader can act on.
 * Whitespace left behind by a removal is collapsed so the sentence still reads.
 */
export const resolveMentions = (text: string, mentioned?: Record<string, DataCommentMention>): string =>
  text
    .replace(MENTION_TOKEN, (_full, id: string) => {
      const m = mentioned?.[id];
      const label = m ? mentionLabel(m) : null;
      return label ? `@${label}` : '';
    })
    // A removal can leave a doubled space or a space before punctuation — tidy both.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

/**
 * The author's display name: name → email → "Airtable user". The third rung is not defensive
 * padding — a capture can carry an author object with neither, and "" would render as a nameless
 * row that looks like a bug rather than like missing data.
 */
export const authorLabel = (a: DataCommentAuthor): string => a.name || a.email || 'Airtable user';

/*
 * REJECTED, 2026-07-30 — an `authorRowLabel` that rendered an email's local part
 * (`priya.nair@example.com` → `priya.nair`) to save width. Oleh: "якщо імейл, то має бути імейл."
 * He is right, on three counts:
 *  · it removed information with NO signal — `priya.nair` looks complete, while an ellipsis at
 *    least says "there is more". It is the same mistake as truncating an id from the wrong end,
 *    which I had argued against an hour earlier on the workspace-id label;
 *  · this app already has ONE way to show something too long — ellipsis + tooltip, used by the
 *    Record and Comment cells in this very row. Semantic shortening was a second mechanism for
 *    the same problem, which is exactly the duplication the entity-glyph work spent the day
 *    removing;
 *  · "the domain is constant noise" is false for THIS product. The primary user is an agency
 *    working with clients outside its own Space, so the domain often says which organisation a
 *    person belongs to.
 * The column was widened instead, and long addresses truncate visibly like everything else.
 */

/**
 * Author initials for the row's identity chip — **only when we actually have a NAME**. Returns ''
 * otherwise, and the row then renders no chip at all.
 *
 * It used to derive initials from an email's local part, so `priya.nair@example.com` wore a "PN"
 * plate. Oleh, 2026-07-30: *"це ж емейл, я такого ніколи не бачив. Ми ж не знаємо чітке ім'я."*
 * Right — splitting an address on a dot and calling the pieces a first and last name INVENTS a
 * person. `k.mensah@example.com` would have read "KM" as confidently as a real Kofi Mensah does,
 * and `info@`/`billing@` would have worn plates for nobody at all.
 *
 * The chip's absence now carries information instead of decorating over its lack: a chip means we
 * know who this is, a bare address means we only have an address. There is no avatar in either
 * case — Airtable ships no profile picture on a comment, which is settled by the API, not taste.
 */
export const authorInitials = (a: DataCommentAuthor): string => {
  if (!a.name) return '';
  const parts = a.name.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
};

/** One-line snippet for the feed row: mentions resolved, newlines flattened. Truncation is CSS. */
export const commentSnippet = (c: DataComment): string =>
  resolveMentions(c.text, c.mentioned).replace(/\s*\n+\s*/g, ' ').trim();

/**
 * Whether the comment was still present in the latest capture. `lastSeenAt` older than the Space's
 * latest sync = it has left the source since. Deliberately COMPARED rather than stored as a flag:
 * a stored "deleted" boolean would be a claim we cannot substantiate, while the comparison states
 * only the fact we hold — the last capture that still contained it.
 */
export const isStillSeen = (c: DataComment, latestSyncAt?: string): boolean =>
  !latestSyncAt || !c.lastSeenAt || c.lastSeenAt >= latestSyncAt;

/**
 * present    — still in the latest capture.
 * deleted    — the RECORD was captured again and this comment was not in its comment list.
 * unverified — the comment is gone AND so is the record, so we cannot say which happened.
 */
export type CommentStatus = 'present' | 'deleted' | 'unverified';

/**
 * The three-state status (founder, 2026-07-30).
 *
 * The original reasoning here was too cautious. It assumed a comment's absence could never be told
 * apart from a record leaving backup scope, and so refused to ever say "deleted". The founder
 * corrected the mechanics: a capture fetches a record's WHOLE comment list, so if the record came
 * back and the comment did not, the comment is gone from Airtable — certainly, with no extra pass
 * and no diffing pass of our own.
 *
 * What survives from the caution is the THIRD state, and only that: when the record itself is no
 * longer in the backup there is nothing to have re-read, so "deleted" and "the record left scope"
 * really are indistinguishable and the UI must keep hedging. Two states would have thrown that
 * distinction away; three keeps the claim exactly as strong as the evidence.
 */
export const commentStatus = (
  c: DataComment,
  opts: { recordCaptured: boolean; latestSyncAt?: string },
): CommentStatus => {
  if (isStillSeen(c, opts.latestSyncAt)) return 'present';
  return opts.recordCaptured ? 'deleted' : 'unverified';
};
