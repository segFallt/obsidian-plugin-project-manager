#!/bin/sh
# extract-release-notes.sh — Print the CHANGELOG section body for one version.
#
# Usage:
#   sh .ci/extract-release-notes.sh <version> [changelog]
#
#   <version>    Bare version, no leading "v" (e.g. 0.5.0 or 0.5.0-beta.3).
#   [changelog]  Path to the changelog (default: CHANGELOG.md).
#
# Emits the body of the "## [<version>]" section only — the "## [<version>]"
# header line is omitted, and no other section's content is ever printed. The
# section is matched by version, so ordering (e.g. a leading "## [Unreleased]")
# never affects the output. When the version has no section, or the section is
# empty, it prints "Release v<version>" instead and exits 0.
#
# POSIX sh + awk only (no jq/node/sed); runs identically on the GitLab publish
# runner (node:20, Debian) and GitHub ubuntu-latest. Invoke via "sh .ci/…" so
# it needs no executable bit.

set -eu

VERSION="${1:-}"
CHANGELOG="${2:-CHANGELOG.md}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [changelog]" >&2
  exit 1
fi

if [ ! -f "$CHANGELOG" ]; then
  echo "ERROR: changelog '$CHANGELOG' not found" >&2
  exit 1
fi

# Print the body of the "## [<version>]" section. The header is matched as a
# literal prefix (substr, not a regex) so version metacharacters like "." never
# act as wildcards; the next "## [" heading at column 1 ends the section.
NOTES=$(awk -v ver="$VERSION" '
  BEGIN { hdr = "## ["; hlen = length(hdr); prefix = hdr ver "]"; plen = length(prefix) }
  substr($0, 1, plen) == prefix { found = 1; next }
  found && substr($0, 1, hlen) == hdr { exit }
  found { print }
' "$CHANGELOG")

# Fall back when the section is absent or contains no non-whitespace content,
# so the output is never empty and never another section's notes.
if [ -z "$(printf '%s' "$NOTES" | tr -d '[:space:]')" ]; then
  printf 'Release v%s\n' "$VERSION"
else
  printf '%s\n' "$NOTES"
fi
