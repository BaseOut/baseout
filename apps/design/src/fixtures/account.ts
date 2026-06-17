import type {
  FixtureAccountContext,
  FixtureSpace,
  FixtureUser,
} from './types';

const PRIMARY_SPACE: FixtureSpace = {
  id: 'space_design_primary',
  name: 'Core CRM',
  status: 'active',
};

const SECONDARY_SPACE: FixtureSpace = {
  id: 'space_design_secondary',
  name: 'Marketing Ops',
  status: 'active',
};

export const FIXTURE_USER: FixtureUser = {
  id: 'user_design_designer',
  name: 'Reese Designer',
  email: 'reese@baseout.design',
  image: null,
  termsAcceptedAt: '2026-05-01T00:00:00.000Z',
};

export const FIXTURE_USER_TRIAL: FixtureUser = {
  ...FIXTURE_USER,
  termsAcceptedAt: null,
};

export const FIXTURE_ACCOUNT: FixtureAccountContext = {
  user: {
    id: FIXTURE_USER.id,
    name: FIXTURE_USER.name,
    email: FIXTURE_USER.email,
    image: FIXTURE_USER.image,
  },
  organization: {
    id: 'org_design_demo',
    name: 'Demo Org',
    slug: 'demo-org',
  },
  membership: { role: 'admin', isDefault: true },
  space: PRIMARY_SPACE,
  spaces: [PRIMARY_SPACE, SECONDARY_SPACE],
};

export const FIXTURE_ACCOUNT_EMPTY: FixtureAccountContext = {
  user: FIXTURE_ACCOUNT.user,
  organization: FIXTURE_ACCOUNT.organization,
  membership: FIXTURE_ACCOUNT.membership,
  space: PRIMARY_SPACE,
  spaces: [PRIMARY_SPACE],
};

export const FIXTURE_ACCOUNT_TRIAL: FixtureAccountContext = {
  user: FIXTURE_ACCOUNT.user,
  organization: null,
  membership: null,
  space: null,
  spaces: [],
};
