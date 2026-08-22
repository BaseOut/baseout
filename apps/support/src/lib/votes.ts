/**
 * Voting: the flag that governs the count, and the local record of who voted for what.
 *
 * ── VOTES_LIVE GATES THE COUNT, NOT THE FEATURE ────────────────────────────────────────────────
 * Dan asked to display how many people voted (2026-08-18). Oleh ruled the same on 2026-08-17. That
 * holds — and it is NOT permission to publish invented figures. The board shipped seven fabricated
 * numbers over the sentence "counts are illustrative until then", which is a trust surface telling
 * you in the same breath that it cannot be trusted. A roadmap is a promise; the one thing on it
 * that must be real is the number nobody can verify by looking.
 *
 * So: the fixtures keep `votes` because that is the shape the store fills, the button works, and
 * the COUNT renders only when a real store backs it. **Flip this in the same commit as the vote
 * endpoint — never before.**
 */
export const VOTES_LIVE = false;

/**
 * ── EMAIL IS THE VOTE IDENTITY ─────────────────────────────────────────────────────────────────
 * Oleh, 2026-08-19. Rejected alternative: one vote per browser, which is free of friction and
 * produces a number we could not defend if anyone asked.
 *
 * What the email buys, and the third one is the reason:
 *   1. A dedupe that actually holds. One vote per address is enforceable; cookie-plus-IP is not.
 *   2. A count we can stand behind when the number is used to justify an order of work.
 *   3. **A return channel.** `research-roadmap.md` §P3 found this decisive: Canny and Sleekplan
 *      both notify everyone who interacted when a status changes, and BOTH require knowing who
 *      voted. An anonymous vote is structurally a dead end — you click, and nothing ever comes
 *      back. The loop that makes a roadmap feel honest cannot close without it.
 *
 * The address is never published. It is not shown on the board, not on the detail page, and not in
 * any export — the visible artefact is a count and, where the voter chose to leave one, an
 * unattributed sentence.
 */
export const VOTE_EMAIL_NOTE = 'Vote with your email — we never publish it.';

const KEY_VOTES = 'support-votes';
const KEY_EMAIL = 'support-vote-email';

/** Locally remembered votes, so the board can paint what this browser already did. The real
 *  dedupe is server-side on the address; this is only the paint. */
export const readVotes = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_VOTES) ?? '[]') as string[];
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

export const hasVoted = (slug: string): boolean => readVotes().includes(slug);

/**
 * A TOGGLE, not a latch. The first board wrote the vote once and returned early ever after, so a
 * misclick was permanent with nothing on screen admitting it. `research-roadmap.md` §P2 found every
 * board in the sample treats the control as reversible; ours now does too.
 */
export function toggleVote(slug: string): boolean {
  const votes = readVotes();
  const i = votes.indexOf(slug);
  const nowVoted = i === -1;
  if (nowVoted) votes.push(slug);
  else votes.splice(i, 1);
  try {
    localStorage.setItem(KEY_VOTES, JSON.stringify(votes));
  } catch {
    /* Storage blocked. The vote still went to the server in production; the paint is cosmetic. */
  }
  return nowVoted;
}

/** Remembered so the second vote does not ask again. Never rendered. */
export const readVoteEmail = (): string => localStorage.getItem(KEY_EMAIL) ?? '';
export const writeVoteEmail = (v: string): void => {
  try {
    localStorage.setItem(KEY_EMAIL, v);
  } catch {
    /* See above. */
  }
};

/** Deliberately permissive: the server validates. A regex that rejects a valid address is worse
 *  than one that accepts an invalid one, because only the first loses a real vote. */
export const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
