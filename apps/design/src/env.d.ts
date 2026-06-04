/// <reference types="astro/client" />

import type { FixtureAccountContext, FixtureUser } from './fixtures/types';

declare global {
  namespace App {
    interface Locals {
      user: FixtureUser;
      account: FixtureAccountContext;
    }
  }
}

export {};
