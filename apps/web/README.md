# OpenSide UI — Frontend Template

A modern, configurable admin dashboard template built with [Astro](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com). Includes a CLI setup wizard, pre-built UI components, dark mode, and responsive design out of the box.

## Prerequisites

- **Node.js** >= 22.12.0

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd openside-frontend-template
npm install
```

### 2. One-time local setup

The canonical dev URL is **`https://baseout.local:4331`** — *not* `localhost`.
Login and Airtable OAuth only work on that origin (see
[shared/internal/oauth-setup.md §5.5](../../shared/internal/oauth-setup.md)).

```bash
pnpm --filter @baseout/web setup:hosts    # adds `127.0.0.1 baseout.local` to /etc/hosts (sudo)
pnpm --filter @baseout/web setup:certs    # optional: locally-trusted cert (removes the https warning)
```

### 3. Run the dev server

```bash
pnpm dev          # from repo root or apps/web
```

`pnpm dev` preflights the `/etc/hosts` mapping (fails fast with the fix if
missing) and auto-opens `https://baseout.local:4331` once the server is up.
wrangler prints its own `localhost:4331` bind line — **ignore it**; logging in
via localhost fails with "Invalid origin". Set `BASEOUT_DEV_NO_OPEN=1` to skip
the auto-open.

## Continued Use

| Command               | Description                                                       |
| :-------------------- | :---------------------------------------------------------------- |
| `pnpm dev`            | Build + run the dev server at `https://baseout.local:4331`        |
| `pnpm setup:hosts`    | Add the `baseout.local` → `127.0.0.1` mapping to `/etc/hosts`     |
| `pnpm setup:certs`    | Generate a locally-trusted cert (mkcert) for `baseout.local`      |
| `pnpm run build`      | Build for production to `./dist/`                                 |
| `pnpm run typecheck`  | Run `astro check`                                                 |
| `pnpm run deploy`     | Deploy the dev worker + sync secrets from `.dev.vars`             |

## Project Structure

```
src/
  pages/            Route-based pages (index, settings, login, 404)
  layouts/          Page layouts (sidebar, auth, doc)
  components/
    ui/             Reusable UI components (Button, Card, Badge, Modal, etc.)
    layout/         Sidebar and Header
  lib/config.ts     Config loader and navigation helpers
  styles/           Global CSS and component styles
  scripts/          Client-side scripts (sidebar behavior)
  middleware.ts     Injects user data from config into every request
scripts/
  setup.mjs         Interactive setup wizard
  launch.mjs        Entry point that runs setup if needed, then starts Astro
```

## Tech Stack

- **Astro 6** — Static + server-rendered pages with file-based routing
- **Tailwind CSS v4** — Utility-first styling with a custom design token system
- **TypeScript** — Strict mode
- **Geist** — Brand font loaded via `@opensided/theme` typography (Google Fonts)
- **Material Symbols Outlined** — Icon system via Google CDN

## UI Components

The template ships with these ready-to-use components in `src/components/ui/`:

Button, Card, Badge, Avatar, TextInput, Checkbox, Toggle, Modal, Tabs, Breadcrumbs, ProgressBar, Divider

## Pages

| Route              | Description                                        |
| :----------------- | :------------------------------------------------- |
| `/`                | Dashboard with stats, charts, activity, and status |
| `/settings`        | Tabbed settings (profile, security, billing, etc.) |
| `/login-register`  | Authentication page with sign-in/register tabs     |
| `/404`             | Not found page                                     |

Custom routes defined in the setup wizard are handled by the `[...slug].astro` catch-all page.

## Design System

The template uses a **Material Design 3-inspired** token system with semantic color variables. Light and dark modes are supported and toggle via `localStorage`. Primary palette is teal, with amber/gold as the tertiary accent.
