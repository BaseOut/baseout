# Open questions for Dan — assembled, not yet sent

**Status 2026-08-14: HELD by Oleh** — collect here, send at the end of the session.

Six were outstanding. **One is closed by the app itself** and must not be re-asked: Profile's
A/B/C fork (`specs/12-settings.md:141-153`) — Option A shipped 2026-08-06, so spec 13 and worklist
S34 now name a dead route. Five remain.

| # | question | parked at | blocks |
|---|---|---|---|
| 2 | **Is there a second user in V1** — members, invites, roles? One sentence on scope is enough. | D18 (single-operator V1, ADOPTed as interim) | Organization ▸ Members; and the `Per org · admin` scope labels, which today name a scope no second user can be outside of |
| 3 | **What happens to an Organization when its only user deletes themselves?** | `settingsCatalog.ts:188-199` | the `account-delete` consequence sentence, currently hedged to be true under both models and therefore saying less than it should |
| 4 | **Are locks a capability statement or a price prompt?** Were the Schema-Health Pro+ gates client-requested? Provenance is not in the repo. | `decision-no-tier-gating-default` → D14 | **the whole of Billing** (S33-F3, F8, F10) |
| 5 | **Where is an avatar uploaded and stored?** | `settingsCatalog.ts:136` | `Change photo`, which today is a button that prints a sentence |
| 6 | **Does a support channel exist at all** — an address, a status page, a docs host? | nowhere in the repo | **the whole of `/help`**, plus three shipped copy strings that instruct the user to contact a support channel the product cannot name (S32-F2) |

## Two notes for whoever sends this

**#6 has never been put to the client.** It is not a design question and must not be phrased as one.
The blocker is not "what should Help look like" — it is "is there anything to point at". Until it is
answered, `/help` cannot be designed, and the interim ruling stands: retarget the eleven CTAs and
delete the placeholder rather than build a page around an unknown.

**#4 is the expensive one.** Billing is entirely blocked on it, and D14's interim ruling — one gate
recipe per `pattern-locked-tab`, and no gate ships pointing at the 12-line billing placeholder — is
what makes shipping without the answer acceptable. If Dan says the Pro+ gates were his, D14 is
superseded and `decision-no-tier-gating-default` falls with it.

Per the working agreement, the outgoing message goes to the clipboard when it is assembled.
