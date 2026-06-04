/**
 * Local mirrors of the @web/* types we feed into apps/web views. Declared
 * here so apps/design doesn't transitively pull in drizzle / db schema
 * through @web/lib/account. The shapes are structurally compatible with
 * the originals — when a view is typed as `account: AccountContext`, TS
 * accepts our FixtureAccountContext via structural typing.
 *
 * If apps/web changes one of these shapes, this file needs the matching
 * field added.
 */

export interface FixtureUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  termsAcceptedAt: string | null;
}

export interface FixtureOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface FixtureMembership {
  role: string;
  isDefault: boolean;
}

export interface FixtureSpace {
  id: string;
  name: string;
  status: string;
}

export interface FixtureAccountContext {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  organization: FixtureOrganization | null;
  membership: FixtureMembership | null;
  space: FixtureSpace | null;
  spaces: FixtureSpace[];
}
