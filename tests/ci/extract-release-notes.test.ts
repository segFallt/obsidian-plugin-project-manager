import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = ".ci/extract-release-notes.sh";
const REPO_ROOT = process.cwd();

/** Run the shared script the way a pipeline invokes it: `sh .ci/… <version> <changelog>`. */
function extract(version: string, changelogPath: string): string {
  return execFileSync("sh", [SCRIPT, version, changelogPath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

const CHANGELOG_UNRELEASED_FIRST = `# Changelog

## [Unreleased]

### Added

- An unreleased feature that must never leak into a release.

## [0.5.0-beta.3] - 2026-09-22

### Fixed

- The real notes for this version.

### Changed

- A second bullet in this version's section.

## [0.5.0-beta.2] - 2026-09-21

### Fixed

- Older notes that must never leak in.
`;

describe("extract-release-notes.sh", () => {
  let dir: string;
  let changelog: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "release-notes-"));
    changelog = join(dir, "CHANGELOG.md");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("extracts the version's section body only, regardless of ordering", () => {
    writeFileSync(changelog, CHANGELOG_UNRELEASED_FIRST);

    const out = extract("0.5.0-beta.3", changelog);

    // Body of the requested section is present…
    expect(out).toContain("The real notes for this version.");
    expect(out).toContain("A second bullet in this version's section.");
    // …the header line is omitted…
    expect(out).not.toContain("## [0.5.0-beta.3]");
    // …and no other section's content leaks in.
    expect(out).not.toContain("An unreleased feature");
    expect(out).not.toContain("Older notes");
  });

  it("produces byte-identical output across host invocations", () => {
    writeFileSync(changelog, CHANGELOG_UNRELEASED_FIRST);

    // GitLab passes ${CI_COMMIT_TAG#v}; GitHub passes ${TAG#v}: both are the bare version.
    const gitlab = extract("0.5.0-beta.3", changelog);
    const github = extract("0.5.0-beta.3", changelog);

    expect(github).toBe(gitlab);
  });

  it("falls back to 'Release v<version>' when the section is missing", () => {
    writeFileSync(changelog, CHANGELOG_UNRELEASED_FIRST);

    const out = extract("9.9.9", changelog);

    expect(out).toBe("Release v9.9.9\n");
    // The fallback never emits another section's content.
    expect(out).not.toContain("An unreleased feature");
    expect(out).not.toContain("The real notes");
  });

  it("falls back (exit 0) when the section exists but is empty", () => {
    writeFileSync(
      changelog,
      `# Changelog

## [1.0.0] - 2026-01-01

## [0.9.0] - 2025-12-01

### Fixed

- Old notes.
`,
    );

    const out = extract("1.0.0", changelog);

    expect(out).toBe("Release v1.0.0\n");
    expect(out).not.toContain("Old notes");
  });
});
