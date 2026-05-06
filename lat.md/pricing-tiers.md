# Pricing Tiers

The tier ladder and the rule that capability gating reads from Stripe metadata, not product names.

Authoritative source: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §3–5.6 plus [shared/Pricing_Credit_System.md](../shared/Pricing_Credit_System.md). Capability and quota numbers below are summary-grade — never copy them into code; resolve from Stripe metadata at runtime.

> **Drift note.** [openspec/config.yaml](../openspec/config.yaml) lists tiers as `Community → Starter → Growth → Pro → Business → Enterprise` — this is **stale**. The canonical tier ladder per Features §3 is `Trial → Launch → Growth → Pro → Business → Enterprise` with `Starter` and `On2Air Bridge` as non-public plans. `openspec/config.yaml` should be updated as a separate change.

## Tiers

The public ladder. Each tier is a Stripe Product; pricing is monthly with annual prepay.

| Tier | Monthly | Public | Notes |
|---|---|---|---|
| **Trial** | $0 | ✓ | Schema-only Dynamic Backup; activity pauses at credit limit (no overage billing) |
| **Launch** | $49 | ✓ | Weekly Static + Dynamic backup, D1 |
| **Growth** | $99 | ✓ | Unlimited Spaces; D1; S3 + Frame.io destinations unlock |
| **Pro** | $199 | ✓ | Daily backup; Shared PostgreSQL; SQL REST API; BYOS |
| **Business** | $399 | ✓ | Daily + Instant (webhook) backup; Dedicated PostgreSQL |
| **Enterprise** | Custom | ✓ | BYODB; SAML SSO; SLA; dedicated CSM |

Non-public plans (discoverable but unmarketed):

| Plan | Monthly | Reason |
|---|---|---|
| **Starter** | $29 | For users who can't afford Launch but need more than Trial |
| **On2Air Bridge** | $9.99 | Migration path for On2Air Basic/Starter customers |

## Capability Gating Rule

**Resolve capabilities from Stripe Product metadata, never from product name strings.** Each Stripe Product carries:

```
platform: "airtable" | "notion" | "hubspot" | ...
tier:     "trial" | "starter" | "launch" | "growth" | "pro" | "business" | "enterprise"
```

Each Stripe Price carries `billing_period: "monthly" | "annual"`. The application reads `(platform, tier)` and looks up the capability/quota matrix in code. This is what lets us ship pricing experiments and rename products without changing capability logic.

## Subscription Architecture

How a customer's billing relationship maps to Stripe objects. The rules are designed so that adding a platform or changing a tier never destroys the underlying subscription history.

| Rule | Detail |
|---|---|
| One subscription per Organization | Created at sign-up, never replaced — only modified. |
| One subscription item per platform | Each active platform product is one item within the Organization's subscription. |
| Tier change | Swaps that platform's subscription item only; other platform items are unaffected. |
| Adding a platform | Adds a new subscription item to the existing subscription. |
| Removing a platform | Removes that platform's subscription item at the end of the billing period. |
| Free trial | Scoped per platform, not per Organization. One active trial per platform at a time. |

## Credits and Overage

Credits meter all transfer + activity; storage is billed separately in dollars. Storage usage is persistent (no monthly reset); credits reset monthly with no rollover.

The mental model: *credits gate activity, dollars gate storage*. Customers configure either auto-overage (allow + bill) or hard cap (pause at limit and notify) — see Features §5 for thresholds and dollar-cap controls.

## Stripe Webhooks

Every webhook is processed through an idempotency table (Stripe sends duplicates). The webhook handler must:

1. Look up the Stripe `event.id` in the idempotency table; skip if seen.
2. Apply the state change to the master DB.
3. Insert the `event.id` row.

Webhook secrets live in Cloudflare Secrets (see [[security-model]]).

## Where to Look

Pointers to authoritative pricing/capability sources.

- Public tier table: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §3
- Quotas + capability matrix: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §4
- Credits + overage: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §5
- Stripe metadata + subscription rules: [shared/Baseout_Features.md](../shared/Baseout_Features.md) §5.6
- Credit system rationale and migration plan: [shared/Pricing_Credit_System.md](../shared/Pricing_Credit_System.md)
