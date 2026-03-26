#!/bin/sh
# bump-version.sh — Bump plugin version, update CHANGELOG, commit.
#
# Usage — Phase 1 (prepare):
#   .ci/bump-version.sh patch          # 1.0.0 → 1.0.1
#   .ci/bump-version.sh minor          # 1.0.0 → 1.1.0
#   .ci/bump-version.sh major          # 1.0.0 → 2.0.0
#   .ci/bump-version.sh 2.5.0          # explicit stable version
#   .ci/bump-version.sh 0.2.0-beta.1   # explicit pre-release version
#
#   Bumps package.json (and syncs manifest.json / versions.json via
#   version-bump.mjs), then prepends a CHANGELOG template section.
#   Prints instructions and exits. Does NOT commit or tag.
#
# Usage — Phase 2 (commit):
#   .ci/bump-version.sh --commit <x.y.z[-pre.N]>
#
#   Verifies package.json is already at <x.y.z>, checks that the CHANGELOG
#   entry for [<x.y.z>] has no unfilled placeholder lines (bare "-"), then
#   stages all version files plus CHANGELOG.md and creates the release commit.
#
#   CI creates the version tag automatically when the MR is merged to main.
#
# The script does NOT push — it prints MR instructions at the end.

set -eu

PACKAGE_JSON="package.json"
CHANGELOG="CHANGELOG.md"

# ── Helpers ───────────────────────────────────────────────────────────────────

read_package_version() {
  CURRENT=$(node -p "require('./$PACKAGE_JSON').version" 2>/dev/null) || {
    CURRENT=$(grep '"version"' "$PACKAGE_JSON" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
  }
}

# ── Validate arguments ────────────────────────────────────────────────────────

BUMP_ARG="${1:-}"
if [ -z "$BUMP_ARG" ]; then
  echo "Usage: $0 <major|minor|patch|x.y.z>"
  echo "       $0 --commit <x.y.z>"
  exit 1
fi

# ── Phase 2: --commit <version> ───────────────────────────────────────────────

if [ "$BUMP_ARG" = "--commit" ]; then
  COMMIT_VERSION="${2:-}"
  if [ -z "$COMMIT_VERSION" ]; then
    echo "Usage: $0 --commit <x.y.z>"
    exit 1
  fi

  if [ ! -f "$PACKAGE_JSON" ]; then
    echo "ERROR: $PACKAGE_JSON not found. Run this script from the repository root."
    exit 1
  fi

  echo "$COMMIT_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$' || {
    echo "ERROR: '$COMMIT_VERSION' is not a valid semver string (expected x.y.z or x.y.z-pre.N)"
    exit 1
  }

  read_package_version

  if [ "$CURRENT" != "$COMMIT_VERSION" ]; then
    echo "ERROR: package.json version is '$CURRENT', expected '$COMMIT_VERSION'."
    echo "       Run '.ci/bump-version.sh $COMMIT_VERSION' first (Phase 1)."
    exit 1
  fi

  # Count bare placeholder lines in the CHANGELOG entry for this version
  PLACEHOLDER_COUNT=$(awk \
    '/^## \['"$COMMIT_VERSION"'\]/{found=1; next} /^## \[/ && found{exit} found && /^-$/{count++} END{print count+0}' \
    "$CHANGELOG")

  if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    echo "ERROR: CHANGELOG.md contains $PLACEHOLDER_COUNT unfilled placeholder line(s) (bare \"-\") in the [${COMMIT_VERSION}] section."
    echo "       Please fill in the release notes before committing."
    exit 1
  fi

  git add "$PACKAGE_JSON" manifest.json versions.json "$CHANGELOG"
  git commit -m "chore: release v$COMMIT_VERSION"

  echo ""
  echo "Created commit for v$COMMIT_VERSION."
  echo ""
  echo "When ready, push and open an MR to main:"
  echo ""
  echo "  git push origin HEAD"
  echo ""
  echo "CI will create the v$COMMIT_VERSION tag automatically once the MR is merged."
  exit 0
fi

# ── Phase 1: bump versions and prepend CHANGELOG template ────────────────────

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "ERROR: $PACKAGE_JSON not found. Run this script from the repository root."
  exit 1
fi

read_package_version

if [ -z "$CURRENT" ]; then
  echo "ERROR: Could not read version from $PACKAGE_JSON"
  exit 1
fi

# Strip any pre-release suffix (e.g. 0.1.13-beta.21 → 0.1.13) for bump calculation
BASE_VERSION=$(echo "$CURRENT" | cut -d- -f1)
MAJOR=$(echo "$BASE_VERSION" | cut -d. -f1)
MINOR=$(echo "$BASE_VERSION" | cut -d. -f2)
PATCH=$(echo "$BASE_VERSION" | cut -d. -f3)

# ── Compute new version ───────────────────────────────────────────────────────

case "$BUMP_ARG" in
  major)
    NEW_MAJOR=$((MAJOR + 1))
    NEW_VERSION="${NEW_MAJOR}.0.0"
    ;;
  minor)
    NEW_MINOR=$((MINOR + 1))
    NEW_VERSION="${MAJOR}.${NEW_MINOR}.0"
    ;;
  patch)
    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    echo "$BUMP_ARG" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$' || {
      echo "ERROR: '$BUMP_ARG' is not a valid semver string (expected x.y.z or x.y.z-pre.N)"
      exit 1
    }
    NEW_VERSION="$BUMP_ARG"
    ;;
  *)
    echo "ERROR: Invalid argument '$BUMP_ARG'. Use major, minor, patch, or an explicit x.y.z version."
    exit 1
    ;;
esac

echo "Bumping $CURRENT → $NEW_VERSION"

# ── Update package.json ───────────────────────────────────────────────────────

node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated $PACKAGE_JSON"

# ── Sync manifest.json and versions.json via version-bump.mjs ────────────────
# version-bump.mjs reads npm_package_version and writes manifest.json.
# It also updates versions.json for stable releases (no "-" in version).

npm_package_version="$NEW_VERSION" node version-bump.mjs
echo "Synced manifest.json and versions.json"

# ── Prepend CHANGELOG section ─────────────────────────────────────────────────

TODAY=$(date +%Y-%m-%d)
ENTRY="## [$NEW_VERSION] - $TODAY

### Added

-

### Changed

-

### Fixed

-

"

TMPFILE=$(mktemp)
awk -v entry="$ENTRY" '
  /^## \[/ && !inserted {
    printf "%s", entry
    inserted = 1
  }
  { print }
  END { if (!inserted) printf "%s", entry }
' "$CHANGELOG" > "$TMPFILE" && mv "$TMPFILE" "$CHANGELOG"

echo "Prepended template section to $CHANGELOG"
echo ""
echo "  → Edit $CHANGELOG to fill in the release notes, then run:"
echo ""
echo "  .ci/bump-version.sh --commit $NEW_VERSION"
echo ""
