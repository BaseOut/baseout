import type { MiddlewareHandler } from 'astro';
import {
  FIXTURE_ACCOUNT,
  FIXTURE_ACCOUNT_EMPTY,
  FIXTURE_ACCOUNT_TRIAL,
  FIXTURE_USER,
  FIXTURE_USER_TRIAL,
} from './fixtures/account';

export const onRequest: MiddlewareHandler = (context, next) => {
  const fixture = context.url.searchParams.get('fixture');

  if (fixture === 'trial') {
    context.locals.user = FIXTURE_USER_TRIAL;
    context.locals.account = FIXTURE_ACCOUNT_TRIAL;
  } else if (fixture === 'empty') {
    context.locals.user = FIXTURE_USER;
    context.locals.account = FIXTURE_ACCOUNT_EMPTY;
  } else {
    context.locals.user = FIXTURE_USER;
    context.locals.account = FIXTURE_ACCOUNT;
  }

  return next();
};
