#!/bin/sh
# is-prerelease.sh — Report whether a version is a pre-release.
#
# Usage:
#   sh .ci/is-prerelease.sh <version>
#
# Prints "true" when the version carries a pre-release suffix (contains a "-",
# e.g. 1.2.3-beta.1) and "false" otherwise, then exits 0. A leading "v" makes
# no difference to the result. POSIX sh only — uses "case", never bash "[[ ]]";
# invoke via "sh .ci/…" so it needs no executable bit.

set -eu

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

case "$VERSION" in
  *-*) printf 'true\n' ;;
  *)   printf 'false\n' ;;
esac
