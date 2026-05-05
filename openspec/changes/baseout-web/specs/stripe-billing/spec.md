## ADDED Requirements

### Requirement: Sign-up trial subscription

On user sign-up, `baseout-web` SHALL create a Stripe Customer linked to the new Organization (`stripe_customer_id`) and a Subscription with one Trial subscription item per platform (`Baseout — Airtable — Trial`) at $0. No credit card SHALL be required at sign-up.

#### Scenario: Sign-up creates Stripe state

- **WHEN** a user completes sign-up
- **THEN** a Stripe Customer is created and a Subscription with one Trial subscription item is opened

### Requirement: Trial → paid upgrade

The billing UI SHALL present a credit-card form (Stripe Elements) for trial-to-paid upgrade. On submit, the subscription item's price SHALL swap to the chosen paid tier; the trial flag SHALL clear when the period rolls over.

#### Scenario: Card submitted

- **WHEN** a user enters a valid card and selects the Pro tier
- **THEN** the subscription item's price is swapped to Pro, the trial flag is cleared at the next period roll, and the user is granted Pro capabilities

### Requirement: Plan upgrade / downgrade

The billing UI SHALL allow plan upgrade and downgrade by modifying the platform's subscription item.

#### Scenario: Upgrade Growth → Pro

- **WHEN** a Growth user submits an upgrade to Pro
- **THEN** the subscription item is modified to Pro with proration per Stripe defaults

### Requirement: Add-on management

The billing UI SHALL support recurring credit add-ons (subscription item) and one-time credit packs (invoice line). Each SHALL be persisted appropriately in `credit_addon_subscriptions` and `credit_buckets` upon Stripe webhook receipt.

#### Scenario: Add-on purchase

- **WHEN** a user buys a one-time 10K credit pack
- **THEN** the invoice is finalized and on `invoice.paid` a `credit_buckets` row of type `purchased` is created

### Requirement: Overage cap configuration

The billing UI SHALL surface configuration for `organization_billing_settings` (overage_mode, dollar cap, alert thresholds).

#### Scenario: Set cap mode

- **WHEN** a user sets `overage_mode='cap'` with a $50 cap
- **THEN** `organization_billing_settings` is updated and `baseout-backup` enforces the cap on subsequent runs

### Requirement: Stripe webhook receiver — events handled

The webhook receiver `POST /api/webhooks/stripe` SHALL handle: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.trial_will_end`. Each SHALL be processed idempotently.

#### Scenario: invoice.paid

- **WHEN** Stripe fires `invoice.paid` for a paid period
- **THEN** the receiver opens new `plan_monthly` and `addon_monthly` credit buckets per `../shared/Pricing_Credit_System.md` §8.5

#### Scenario: invoice.payment_failed

- **WHEN** Stripe fires `invoice.payment_failed`
- **THEN** the subscription is marked `past_due` and the Payment Failed (dunning) email is sent

#### Scenario: trial_will_end

- **WHEN** Stripe fires `customer.subscription.trial_will_end`
- **THEN** the receiver triggers the `baseout-web`-owned Trial Expiry Warning email (or back's, per ownership decisions)

### Requirement: Webhook signature + idempotency

The receiver SHALL verify the Stripe signing secret (Cloudflare Secrets) and SHALL implement replay protection via `stripe_events_processed` (event ID → processed_at).

#### Scenario: Replay attempt

- **WHEN** the same Stripe event ID is delivered twice
- **THEN** the second delivery is recognized via `stripe_events_processed` and processed as a no-op (200)

### Requirement: Multi-platform discount automation

When a second platform subscription item is added, a Stripe coupon SHALL be applied to the additional subscription item(s) automatically.

#### Scenario: Second platform added

- **WHEN** an Org adds a second platform subscription item
- **THEN** the Stripe webhook handler attaches the multi-platform coupon to the new item
