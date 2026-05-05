import type { AppDb } from '../../db'
import {
  users,
  organizations,
  organizationMembers,
  spaces,
  subscriptions,
  userPreferences,
} from '../../db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { uniqueSlug } from '../slug'

export const REFERRAL_SOURCES = [
  'google',
  'twitter_x',
  'friend',
  'podcast',
  'other',
] as const
export type ReferralSource = (typeof REFERRAL_SOURCES)[number]

export interface OnboardingInput {
  userId: string
  firstName: string
  lastName: string
  jobTitle: string
  orgName: string
  termsAccepted: boolean
  referralSource?: ReferralSource
  marketingOptIn?: boolean
  referralCode?: string
  previewSessionId?: string
}

export interface ValidatedOnboarding {
  firstName: string
  lastName: string
  fullName: string
  jobTitle: string
  orgName: string
  referralSource: ReferralSource | null
  marketingOptIn: boolean
  referralCode: string | null
  previewSessionId: string | null
}

export type CompleteOnboardingError =
  | {
      kind: 'invalid'
      field:
        | 'firstName'
        | 'lastName'
        | 'jobTitle'
        | 'orgName'
        | 'termsAccepted'
        | 'referralSource'
      message: string
    }
  | { kind: 'already_onboarded' }
  | { kind: 'user_not_found' }

export class OnboardingError extends Error {
  constructor(public detail: CompleteOnboardingError) {
    super(detail.kind === 'invalid' ? detail.message : detail.kind)
  }
}

const NAME_MAX = 100
const ORG_NAME_MAX = 100
const JOB_TITLE_MAX = 100
const REFERRAL_CODE_MAX = 100

function requireTrimmed(
  raw: unknown,
  field: 'firstName' | 'lastName' | 'jobTitle' | 'orgName',
  label: string,
  max: number,
): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) {
    throw new OnboardingError({
      kind: 'invalid',
      field,
      message: `${label} is required.`,
    })
  }
  if (value.length > max) {
    throw new OnboardingError({
      kind: 'invalid',
      field,
      message: `${label} must be ${max} characters or fewer.`,
    })
  }
  return value
}

export function validateOnboardingInput(raw: Record<string, unknown>): ValidatedOnboarding {
  const firstName = requireTrimmed(raw.firstName, 'firstName', 'First name', NAME_MAX)
  const lastName = requireTrimmed(raw.lastName, 'lastName', 'Last name', NAME_MAX)
  const jobTitle = requireTrimmed(raw.jobTitle, 'jobTitle', 'Job title', JOB_TITLE_MAX)
  const orgName = requireTrimmed(raw.orgName, 'orgName', 'Organization name', ORG_NAME_MAX)

  if (raw.termsAccepted !== true) {
    throw new OnboardingError({
      kind: 'invalid',
      field: 'termsAccepted',
      message: 'You must accept the terms to continue.',
    })
  }

  let referralSource: ReferralSource | null = null
  if (
    raw.referralSource !== undefined &&
    raw.referralSource !== null &&
    raw.referralSource !== ''
  ) {
    if (
      typeof raw.referralSource !== 'string' ||
      !(REFERRAL_SOURCES as readonly string[]).includes(raw.referralSource)
    ) {
      throw new OnboardingError({
        kind: 'invalid',
        field: 'referralSource',
        message: 'Invalid referral source.',
      })
    }
    referralSource = raw.referralSource as ReferralSource
  }

  const marketingOptIn = raw.marketingOptIn === true

  let referralCode: string | null = null
  if (typeof raw.referralCode === 'string' && raw.referralCode.trim()) {
    referralCode = raw.referralCode.trim().slice(0, REFERRAL_CODE_MAX)
  }

  const previewSessionId =
    typeof raw.previewSessionId === 'string' && raw.previewSessionId.trim()
      ? raw.previewSessionId.trim().slice(0, 200)
      : null

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    jobTitle,
    orgName,
    referralSource,
    marketingOptIn,
    referralCode,
    previewSessionId,
  }
}

export interface OnboardingOrgSnapshot {
  organizationId: string
  orgName: string
  slug: string
  spaceId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  userEmail: string
  resumed: boolean
}

// Step 1 of the handler flow. Validates input, inserts all DB rows for a new
// signup, and updates the user profile. Does NOT set termsAcceptedAt — that
// only flips after Stripe provisioning succeeds. Idempotent: if the user
// already owns an Organization (prior Stripe-retry path), returns the existing
// snapshot without inserting duplicates.
export async function provisionOnboarding(
  db: AppDb,
  userId: string,
  input: ValidatedOnboarding,
): Promise<OnboardingOrgSnapshot> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      termsAcceptedAt: users.termsAcceptedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw new OnboardingError({ kind: 'user_not_found' })
  if (user.termsAcceptedAt) throw new OnboardingError({ kind: 'already_onboarded' })

  // Resume path: user has an owner org but Stripe never completed.
  const [existingOwner] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.role, 'owner'),
      ),
    )
    .limit(1)

  if (existingOwner) {
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        stripeCustomerId: organizations.stripeCustomerId,
      })
      .from(organizations)
      .where(eq(organizations.id, existingOwner.organizationId))
      .limit(1)
    const [space] = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.organizationId, existingOwner.organizationId))
      .limit(1)
    const [sub] = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, existingOwner.organizationId))
      .limit(1)
    return {
      organizationId: org.id,
      orgName: org.name,
      slug: org.slug,
      spaceId: space.id,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
      userEmail: user.email,
      resumed: true,
    }
  }

  const snapshot = await db.transaction(async (tx) => {
    const slug = await uniqueSlug(input.orgName, async (candidate) => {
      const [existing] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, candidate))
        .limit(1)
      return !!existing
    })

    await tx
      .update(users)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        name: input.fullName,
        jobTitle: input.jobTitle,
        marketingOptInAt: input.marketingOptIn ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, userId))

    const [org] = await tx
      .insert(organizations)
      .values({
        name: input.orgName,
        slug,
        referralSource: input.referralSource,
        referralCode: input.referralCode,
      })
      .returning({ id: organizations.id })

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: 'owner',
      isDefault: true,
      acceptedAt: sql`now()`,
    })

    const [space] = await tx
      .insert(spaces)
      .values({
        organizationId: org.id,
        name: input.orgName,
        status: 'setup_incomplete',
        onboardingStep: 1,
      })
      .returning({ id: spaces.id })

    await tx
      .insert(userPreferences)
      .values({
        userId,
        activeOrganizationId: org.id,
        activeSpaceId: space.id,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          activeOrganizationId: org.id,
          activeSpaceId: space.id,
          modifiedAt: sql`now()`,
        },
      })

    return { orgId: org.id, slug, spaceId: space.id }
  })

  return {
    organizationId: snapshot.orgId,
    orgName: input.orgName,
    slug: snapshot.slug,
    spaceId: snapshot.spaceId,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    userEmail: user.email,
    resumed: false,
  }
}

// Persists the Stripe identifiers returned by the provisioner back to the
// master DB. Safe to call multiple times — upsert on organization_id.
export async function persistStripeIds(
  db: AppDb,
  organizationId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
): Promise<void> {
  await db
    .update(organizations)
    .set({ stripeCustomerId, modifiedAt: sql`now()` })
    .where(eq(organizations.id, organizationId))

  await db
    .insert(subscriptions)
    .values({
      organizationId,
      stripeSubscriptionId,
      status: 'trialing',
    })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: {
        stripeSubscriptionId,
        status: 'trialing',
        modifiedAt: sql`now()`,
      },
    })
}

export async function markTermsAccepted(db: AppDb, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ termsAcceptedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(users.id, userId))
}
