/**
 * Who the portal is being read BY, when it is being read by somebody.
 *
 * ── NOT INVENTED. IT IS THE CUSTOMER THE FIXTURE ALREADY HAS ───────────────────────────────────
 * `data/tickets.ts` tells one story: Dana Keller at Northwind writes in about a Sales CRM schedule
 * that stopped, and Priya Raghavan answers. `/requests/` renders Dana's side of it — every customer
 * message there is printed as "You:". So the person signed in IS Dana, and giving the header a
 * different name would put two customers in one portal.
 *
 * THE ADDRESS COMES FROM THE SAME CASE. `lib/email-previews.ts` fills the acknowledgement's
 * `reply_to_address` with `dana@northwind.example`, which is where the answer to that case goes.
 *
 * ── THE ASSERTION IS THE POINT ─────────────────────────────────────────────────────────────────
 * Two fixtures agreeing today is not the same as two fixtures that cannot disagree. If somebody
 * renames the customer in `tickets.ts`, the header would keep saying `Dana Keller` above a list of
 * messages from somebody else, at HTTP 200 with every gate green — this repo has shipped that shape
 * of failure more than once. So the name is checked against the fixture at module load, which for a
 * component the header imports means at BUILD time, and a mismatch stops the build rather than
 * reaching a reviewer.
 */
import { TICKETS } from './tickets';

export interface Viewer {
  name: string;
  email: string;
}

export const VIEWER: Viewer = {
  name: 'Dana Keller',
  email: 'dana@northwind.example',
};

const customerNames = new Set(
  TICKETS.flatMap((t) => t.messages)
    .filter((m) => m.sender === 'customer')
    .map((m) => m.senderName),
);

if (customerNames.size > 0 && !customerNames.has(VIEWER.name)) {
  throw new Error(
    `data/viewer.ts: VIEWER.name is "${VIEWER.name}", which is not a customer in data/tickets.ts ` +
      `(found: ${[...customerNames].join(', ')}). The header would name one person above another ` +
      `person's messages. Change one to match the other.`,
  );
}
