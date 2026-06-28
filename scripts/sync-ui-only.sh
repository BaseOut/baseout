#!/usr/bin/env bash
#
# sync-ui-only.sh
#
# One-way push of the designer-facing UI subset from this monorepo to
# the standalone ui-only repo (default: ../ui-only relative to this
# monorepo root). Designed to run from the repo root.
#
# What it syncs:
#   apps/web/src/{components,layouts,views,stores,styles,lib}  →  ui-only/apps/web/src/...
#   apps/web/public                                            →  ui-only/apps/web/public
#   apps/web/vendor                                            →  ui-only/apps/web/vendor
#   apps/design/                                               →  ui-only/apps/design/
#
# What it does NOT touch:
#   - ui-only/package.json
#   - ui-only/pnpm-workspace.yaml
#   - ui-only/apps/web/package.json    (slimmed; preserved across syncs)
#   - ui-only/README.md
#   - ui-only/.gitignore, .npmrc, tsconfig.base.json
#   - ui-only/node_modules, ui-only/.git
#
# What it scrubs from apps/web before syncing (backend-only, not part
# of the UI surface):
#   src/{db,pages,middleware*.ts,index.ts,env.d.ts}
#   src/lib/{airtable,auth-factory*,auth.ts,backup-config,backup-engine*,
#            box,crypto*,dropbox,email,google-drive,integrations.ts,
#            oauth,onboarding,onedrive,session-cache*,spaces.ts,
#            stripe*,slug*,capabilities/resolve.ts}
#   any *.test.ts
#
# Usage:
#   ./scripts/sync-ui-only.sh                     # default destination ../ui-only
#   ./scripts/sync-ui-only.sh ../path/to/ui-only  # override destination
#   ./scripts/sync-ui-only.sh --dry-run           # show what would change
#
set -euo pipefail

DRY_RUN=""
DEST=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) DEST="$arg" ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${DEST:-$REPO_ROOT/../ui-only}"

if [ ! -d "$DEST" ]; then
  echo "destination does not exist: $DEST" >&2
  echo "create it and seed the slimmed package.json + pnpm-workspace.yaml first." >&2
  exit 1
fi

SRC_WEB="$REPO_ROOT/apps/web"
SRC_DESIGN="$REPO_ROOT/apps/design"
DST_WEB="$DEST/apps/web"
DST_DESIGN="$DEST/apps/design"

if [ ! -d "$SRC_WEB/src" ] || [ ! -d "$SRC_DESIGN/src" ]; then
  echo "expected apps/web/src and apps/design/src in $REPO_ROOT" >&2
  exit 1
fi

echo "syncing UI surface  $REPO_ROOT  →  $DEST"
echo

mkdir -p "$DST_WEB/src" "$DST_DESIGN"

RSYNC_OPTS="-a --delete $DRY_RUN"

# apps/web subset — only shared UI dirs the designer touches
for sub in components layouts views stores styles lib; do
  echo "→ apps/web/src/$sub"
  rsync $RSYNC_OPTS \
    --exclude='*.test.ts' \
    "$SRC_WEB/src/$sub/" "$DST_WEB/src/$sub/"
done

# Scrub backend-only lib children that survive the dir-level sync
LIB="$DST_WEB/src/lib"
for path in \
  airtable \
  auth-factory.ts auth-factory.test.ts auth.ts \
  backup-config \
  backup-engine.ts backup-engine.test.ts \
  box \
  crypto.ts crypto.test.ts \
  dropbox email google-drive \
  integrations.ts \
  oauth onboarding onedrive \
  session-cache.ts session-cache.test.ts \
  spaces.ts \
  stripe.ts stripe.test.ts \
  slug.ts slug.test.ts \
  capabilities/resolve.ts; do
  if [ -e "$LIB/$path" ] && [ -z "$DRY_RUN" ]; then
    rm -rf "$LIB/$path"
  fi
done

echo "→ apps/web/public"
rsync $RSYNC_OPTS "$SRC_WEB/public/" "$DST_WEB/public/"

echo "→ apps/web/vendor"
rsync $RSYNC_OPTS "$SRC_WEB/vendor/" "$DST_WEB/vendor/"

# Sync tsconfig.json + app-config.json verbatim
for f in tsconfig.json app-config.json; do
  if [ -f "$SRC_WEB/$f" ]; then
    if [ -z "$DRY_RUN" ]; then
      cp "$SRC_WEB/$f" "$DST_WEB/$f"
    fi
    echo "→ apps/web/$f"
  fi
done

# apps/design — full tree, preserving the destination package.json
echo "→ apps/design (preserving destination package.json)"
rsync $RSYNC_OPTS \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.astro' \
  --exclude='package.json' \
  "$SRC_DESIGN/" "$DST_DESIGN/"

# Copy design package.json only if destination lacks one
if [ ! -f "$DST_DESIGN/package.json" ] && [ -z "$DRY_RUN" ]; then
  cp "$SRC_DESIGN/package.json" "$DST_DESIGN/package.json"
fi

echo
echo "done."
if [ -n "$DRY_RUN" ]; then
  echo "(dry run — nothing was changed)"
else
  echo "next steps in $DEST:"
  echo "  git status"
  echo "  git add -A && git commit -m 'sync from baseout @ \$(git -C $REPO_ROOT rev-parse --short HEAD)'"
  echo "  git push"
fi
