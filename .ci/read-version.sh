#!/bin/sh
# read-version.sh — Print the bare version from a manifest.
#
# Usage:
#   sh .ci/read-version.sh [manifest]
#
#   [manifest]  Path to the manifest JSON (default: manifest.json).
#
# Prints the "version" value with no leading "v" and nothing else. POSIX sh +
# sed only (no jq/node, no GNU-only features) so it runs unchanged on busybox —
# the GitLab auto-tag job's alpine:latest image — as well as Debian/GNU. Invoke
# via "sh .ci/…" so it needs no executable bit.

set -eu

MANIFEST="${1:-manifest.json}"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: manifest '$MANIFEST' not found" >&2
  exit 1
fi

# Extract the "version" value with POSIX sed only, so this runs on busybox.
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$MANIFEST" | head -1)

if [ -z "$VERSION" ]; then
  echo "ERROR: could not read \"version\" from '$MANIFEST'" >&2
  exit 1
fi

printf '%s\n' "$VERSION"
