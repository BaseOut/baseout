/**
 * Auth surface types — the shapes the login / challenge / association / welcome
 * views take as props. Fixtures in apps/design are typed against these, so a
 * reshape here surfaces there as a compile error.
 *
 * Names follow openspec/changes/login-methods/spec.md. (tasks.md 4.1 asks that
 * they also be cross-checked against baseout's `web-auth-2fa` /
 * `web-auth-airtable-sso` flow contracts — those live in the private monorepo
 * and are not reachable from this mirror.)
 */

/** How the user arrived. Per the spec the association screen is IDENTICAL for both. */
export type AuthEntryPath = 'magic-link' | 'sso';

/** The states the 2FA challenge screen can be rendered in. */
export type ChallengeState = 'fresh' | 'wrong-code' | 'lockout' | 'backup-code' | 'trusted-device';

export interface LoginViewProps {
  /** Sign in vs. create account — same surface, different copy and footer link. */
  mode?: 'login' | 'register';
  /** Render the "check your email" panel instead of the form. */
  sent?: boolean;
  sentEmail?: string;
  /**
   * The user backed out of the Airtable consent screen. A shrug, not a failure —
   * rendered as a calm info note, never an error alert.
   */
  ssoCancelled?: boolean;
  /**
   * Harness-only: adds the "no email is actually sent" line to the sent panel.
   * Never true in the product — the design mirror passes it so a reviewer knows
   * why no mail arrives.
   */
  preview?: boolean;
  /**
   * Where "Continue with Airtable" goes. In production this is the OAuth start
   * URL (the redirect to Airtable's consent screen); in the design harness the
   * fixture points it at the next fake screen. Never hardcode a destination in
   * the view. Omitted = the button stays inert (nothing to navigate to).
   */
  ssoHref?: string;
  /**
   * Where the magic-link submit goes. In production this is normally omitted —
   * the view swaps to the "check your email" panel in place. The harness passes
   * the `?state=sent` address so the flow is walkable without the URL bar.
   */
  sentHref?: string;
  /**
   * Harness-only: milliseconds to hold the button's loading state before
   * navigating, so a reviewer can actually see it. Never set in production —
   * the real view navigates immediately, because a redirect is already slow.
   */
  navDelayMs?: number;
}

export interface AuthChallengeViewProps {
  state?: ChallengeState;
  /** Which account is being challenged — shown so the user knows whose code to fetch. */
  email: string;
  /** Human wait for the lockout state, e.g. "4:38". Never a dead end: backup codes still work. */
  lockoutRemaining?: string;
  /** Attempts left before a lock, shown on a wrong code. */
  attemptsLeft?: number;
  /** The bound of "trust this device" spelled out, e.g. "30 August". Never unbounded. */
  trustedUntil?: string;
  entryPath?: AuthEntryPath;
}

export interface AuthAssociationViewProps {
  /** The organization already using Baseout on this domain. */
  organizationName: string;
  /** The email domain that matched, e.g. "acme.com". */
  domain: string;
  /** Who approves the request, when we know. */
  adminName?: string;
  /** A request is already in flight — banner + the user proceeds anyway. */
  pending?: boolean;
  /** Recorded for fixtures only; the rendered screen is identical for both paths. */
  entryPath?: AuthEntryPath;
}

export interface ReferralOption {
  value: string;
  label: string;
}

export interface WelcomeViewProps {
  email?: string;
  referralOptions: ReferralOption[];
  /**
   * Organization the user asked to join. Shows the pending banner — onboarding
   * continues regardless: a pending request never blocks.
   */
  pendingJoinOrg?: string | null;
}

/** The linked Airtable identity row (account security panel). */
export interface LinkedIdentity {
  provider: 'airtable';
  linked: boolean;
  accountEmail?: string;
  linkedAt?: string;
}

/**
 * What the enrolment wizard needs to show on its first step. The QR is passed IN,
 * never produced in the view: production renders it server-side from the real
 * secret, and the design mirror passes a static fixture (design.md, Risks).
 */
export interface TwoFactorEnrollment {
  /** Image src for the provisioning QR — a data URI or a URL. */
  qrSrc: string;
  /** The same secret, typeable, for authenticator apps that cannot scan. */
  manualSecret: string;
  /** The label the authenticator entry gets, e.g. "Baseout: ada@acme.com". */
  accountLabel: string;
}

/**
 * Which sub-surface of the security panel is open. `idle` is the only value
 * production ever starts on — the rest are reached by pressing a button, and are
 * addressable only so the design harness can link straight to one.
 */
export type SecurityStage = 'idle' | 'scan' | 'verify' | 'save' | 'disable' | 'regenerate';

export interface SecurityPanelProps {
  /**
   * Is two-factor ACTIVE. Verify-to-activate (spec Decision 5): reaching the scan
   * step does not set this — only a verified code does, so an abandoned wizard
   * leaves it false.
   */
  twoFactorEnabled: boolean;
  /** When it was turned on. Shown only while enabled. */
  twoFactorEnrolledAt?: string;
  enrollment: TwoFactorEnrollment;
  /** The set handed over at the end of enrolment. Shown exactly once, behind the save gate. */
  backupCodes: string[];
  /** The set a regeneration issues, which invalidates the one above. */
  regeneratedCodes?: string[];
  /** Unused codes left in the current set — the status line while 2FA is on. */
  backupCodesRemaining?: number;
  /** The linked Airtable identity row, in either state. */
  identity: LinkedIdentity;
  /**
   * Harness-only: open the panel directly at one stage so a reviewer can reach
   * every state from the URL. Production omits it and always starts at `idle`.
   */
  previewStage?: SecurityStage;
}
