import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createAuth } from '../../../lib/auth';

export const prerender = false;

/** Mounts all better-auth routes (session, anonymous sign-in, magic link) under /api/auth/*. */
export const ALL: APIRoute = (ctx) => createAuth(env, ctx.url.origin).handler(ctx.request);
