/**
 * The Spaces a signed-in person can point a support case at.
 *
 * FIXTURE, AND THE SHAPE IS THE POINT — the same discipline `data/requests.ts` and `data/tickets.ts`
 * open with, for the same reason. `apps/support` has no database and no session, so every field
 * below is written down as what a real store must RETURN for the signed-in visitor, not as what a
 * mock needs to render. The engineer porting this is reading the type, not the rows.
 *
 * ── WHY IT EXISTS ─────────────────────────────────────────────────────────────────────────────
 * `data/tickets.ts` has declared `spaceId: string | null` since the portal's first case, and the
 * request list has rendered the Space chip for as long. NOTHING FILLED IT. The value could only
 * ever be assigned by us at triage, which means the first reply on a backup failure is "which Space
 * was this?" — the exact round-trip that file's header prices as the cost of not having the field.
 * Dan, asked whether a ticket should say which Space it is about: "Yes, good idea — allow that as a
 * selection, but not required."
 *
 * ── IT IS A ROSTER, WHICH MEANS IT IS SESSION-SCOPED, WHICH MEANS IT IS NOT PUBLIC ────────────
 * This list is "the Spaces YOU can see". A real store returns it from the session — the Spaces of
 * the organisations the authenticated person is a member of — and it must never be served to an
 * anonymous request. Two consequences the surfaces have to respect, written here because this is
 * where they get forgotten:
 *
 *   1. The picker on `/contact/` is SIGNED-IN ONLY. Its argument is in `pages/contact.astro`
 *      above `.sb-space`; the short version is that a signed-out visitor has no roster to draw
 *      from and a free-text box would produce a string nothing can join to a record.
 *   2. It is never offered on the PUBLIC request form. A Space name is account data — often a
 *      customer's or a department's name — and the whole reason `/contact/` forks is that account
 *      data must not reach the public board.
 *
 * In this repo the roster is a constant baked into a static build, so "signed out" is enforced by
 * disabling the control rather than by withholding the data. That is a property of having no
 * backend, not a design: the real portal must not send these rows to an unauthenticated page at
 * all. Do not treat the baked array as permission to render it anywhere else.
 *
 * ── ORGANISATION → SPACE, AND THE ORG IS NOT DECORATION ───────────────────────────────────────
 * A person can belong to more than one organisation, and two organisations can each hold a Space
 * called `Ops`. Without `orgName` the picker offers two identical lines and the person picks one at
 * random, which is worse than not asking. It is what the `optgroup` labels are built from.
 *
 * ── A SPACE IS BOUND TO EXACTLY ONE PLATFORM ──────────────────────────────────────────────────
 * The product model, not a convenience: V1 is Airtable only, and `platform` is here so this file
 * cannot quietly become the one place that forgets it. It is a `PlatformId` rather than a string so
 * a Space and the platform vocabulary the docs read from cannot drift into two spellings of one
 * fact.
 *
 * ── THE IDS MATCH `data/tickets.ts` ON PURPOSE ────────────────────────────────────────────────
 * `spc_ops` and `spc_finance` are the two ids the ticket fixture already carries, with the labels
 * its `about` objects already resolve to. A roster that disagreed with the cases would mean the
 * form offering a Space the list cannot show back, which is the one thing a fixture pair exists to
 * rule out.
 */
import type { PlatformId } from '../lib/platforms';

export interface PortalSpace {
  /** The stored id. This is the value `Ticket.spaceId` holds, and the only thing the form sends. */
  id: string;
  /** What the person calls it, and what the ticket list prints back as `about.label`. */
  name: string;
  /** The one platform this Space is bound to. Never plural — see the header. */
  platform: PlatformId;
  /** The organisation the Space belongs to. Disambiguates two Spaces of one name — see the header. */
  orgName: string;
}

/**
 * The signed-in visitor's roster.
 *
 * TWO ORGANISATIONS ON PURPOSE, and the second is a single Space. One org would render one
 * `optgroup` and prove nothing about the grouping; the lopsided pair is what proves a person who is
 * a guest in somebody else's account still sees their own Space, correctly attributed.
 */
export const SPACES: PortalSpace[] = [
  { id: 'spc_ops', name: 'Ops', platform: 'airtable', orgName: 'Northwind' },
  { id: 'spc_finance', name: 'Finance', platform: 'airtable', orgName: 'Northwind' },
  { id: 'spc_product', name: 'Product research', platform: 'airtable', orgName: 'Northwind' },
  { id: 'spc_partner', name: 'Client deliverables', platform: 'airtable', orgName: 'Halden & Co' },
];

/**
 * The Spaces grouped for a picker, in roster order, organisations in first-seen order.
 *
 * DERIVED, NEVER DECLARED. A hand-written grouped copy of this list is a second list to keep in
 * step, and the one that drifts is always the one nothing reads twice.
 */
export function spacesByOrg(spaces: PortalSpace[] = SPACES): { orgName: string; spaces: PortalSpace[] }[] {
  const out: { orgName: string; spaces: PortalSpace[] }[] = [];
  for (const s of spaces) {
    const group = out.find((g) => g.orgName === s.orgName);
    if (group) group.spaces.push(s);
    else out.push({ orgName: s.orgName, spaces: [s] });
  }
  return out;
}

/** The display for a stored id, which a real store joins. Null where the id is unknown or absent. */
export const spaceById = (id: string | null): PortalSpace | null =>
  (id ? SPACES.find((s) => s.id === id) : undefined) ?? null;
