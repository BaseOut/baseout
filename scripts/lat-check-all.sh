#!/usr/bin/env bash
# Run `lat check` against the root graph and every per-app graph, filter the
# cosmetic EISDIR warnings lat 0.11 emits for symlinked dirs, and exit non-zero
# if any graph fails (anything other than "All checks passed" + warnings).
#
# Used by:
#   - .claude/settings.json (Stop hook)
#   - .github/workflows/ci.yml (lat-check job)
#
# Designed to be safe to run from any cwd — locks to repo root by resolving
# relative to this script's location.

set -o pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

# Suppress the cosmetic noise lat 0.11 emits but never fails on:
#   - EISDIR errors from following the apps/*/openspec and
#     apps/*/node_modules/@baseout/* symlinks
#   - .npmrc warnings about ${NPM_TOKEN} (pre-existing, unrelated)
#   - "Scanned N files" status lines
#   - "Warning: No init version recorded" (we wired hooks ourselves; lat init
#     was not run interactively)
#   - "Warning: No LLM key found" (we deferred LAT_LLM_KEY)
filter_noise() {
  grep -v "EISDIR" \
    | grep -v "NPM_TOKEN" \
    | grep -v "^Scanned " \
    | grep -v "^Warning: No init version recorded" \
    | grep -v "^Warning: No LLM key found"
}

graphs=( "$ROOT" )
for app in web server admin api sql hooks; do
  graphs+=( "$ROOT/apps/$app" )
done

failed=0
for graph in "${graphs[@]}"; do
  rel="${graph#$ROOT}"
  rel="${rel:-/}"
  # Capture output and exit code in one pass — PIPESTATUS preserves lat's
  # status across the noise filter pipe.
  output=$(cd "$graph" && pnpm exec lat check 2>&1; echo "__LAT_EXIT=$?")
  status="${output##*__LAT_EXIT=}"
  status="${status%%[!0-9]*}"
  body="${output%__LAT_EXIT=*}"
  filtered=$(printf '%s' "$body" | filter_noise)
  if [ "${status:-1}" != "0" ]; then
    echo "── lat check FAILED in ${rel} ──"
    printf '%s\n' "$filtered"
    failed=1
  fi
done

if [ $failed -ne 0 ]; then
  echo
  echo "lat check failures detected in one or more graphs."
  exit 1
fi

exit 0
