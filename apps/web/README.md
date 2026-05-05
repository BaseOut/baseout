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

### 2. Run the dev server

```bash
npm run dev
```

On first run, the **setup wizard** launches automatically before starting the server. It will ask you for:

- **Your name and email** — displayed in the dashboard UI
- **Product name** — shown in the sidebar header (defaults to "My App")
- **Sidebar navigation** — add top-level items and sub-items with labels and paths
- **Bottom navigation** — use the defaults (Settings, Help Center) or define your own

The wizard generates an `app-config.json` file in the project root. This file is **gitignored** — each developer gets their own local config.

### 3. Open the dashboard

Once the server starts, visit [http://localhost:4331](http://localhost:4331).

## Continued Use

| Command             | Description                                              |
| :------------------ | :------------------------------------------------------- |
| `npm run dev`       | Start the dev server (skips setup if config exists)      |
| `npm run build`     | Build for production to `./dist/`                        |
| `npm run preview`   | Preview the production build locally                     |
| `npm run setup`     | Re-run the setup wizard (resets your config)             |
| `npm run astro ...` | Run Astro CLI commands directly (e.g. `astro check`)    |

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

Button, Card, Badge, Avatar, TextInput, Checkbox, Toggle, Modal, Tabs, Breadcrumbs, ProgressBar, Divider, SocialButton, FeatureBadge

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
