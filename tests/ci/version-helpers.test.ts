import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const READ_VERSION = ".ci/read-version.sh";
const IS_PRERELEASE = ".ci/is-prerelease.sh";
const REPO_ROOT = process.cwd();

/** Run a shared helper the way a pipeline invokes it: `sh .ci/<script>.sh <args…>`. */
function run(script: string, args: string[]): string {
  return execFileSync("sh", [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

function runExpectingFailure(script: string, args: string[]): number {
  try {
    execFileSync("sh", [script, ...args], { cwd: REPO_ROOT, stdio: "pipe" });
    return 0;
  } catch (err) {
    return (err as { status?: number }).status ?? -1;
  }
}

describe("read-version.sh", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "read-version-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the version from the default manifest.json with no leading 'v'", () => {
    const expected = JSON.parse(
      readFileSync(join(REPO_ROOT, "manifest.json"), "utf8"),
    ).version as string;

    const out = run(READ_VERSION, []);

    expect(out).toBe(`${expected}\n`);
    expect(out.startsWith("v")).toBe(false);
  });

  it("reads a stable version from an explicit manifest path", () => {
    const manifest = join(dir, "manifest.json");
    writeFileSync(manifest, JSON.stringify({ version: "1.2.3", minAppVersion: "1.4.0" }));

    expect(run(READ_VERSION, [manifest])).toBe("1.2.3\n");
  });

  it("reads a pre-release version verbatim (no leading 'v')", () => {
    const manifest = join(dir, "manifest.json");
    writeFileSync(manifest, JSON.stringify({ version: "0.2.0-beta.5", minAppVersion: "1.4.0" }));

    expect(run(READ_VERSION, [manifest])).toBe("0.2.0-beta.5\n");
  });

  it("does not confuse minAppVersion for the version", () => {
    const manifest = join(dir, "manifest.json");
    // minAppVersion appears before version to guard against a greedy/loose match.
    writeFileSync(manifest, '{\n  "minAppVersion": "1.4.0",\n  "version": "3.4.5"\n}\n');

    expect(run(READ_VERSION, [manifest])).toBe("3.4.5\n");
  });

  it("fails when the manifest does not exist", () => {
    expect(runExpectingFailure(READ_VERSION, [join(dir, "missing.json")])).not.toBe(0);
  });

  it("fails when the manifest has no version key", () => {
    const manifest = join(dir, "manifest.json");
    writeFileSync(manifest, JSON.stringify({ minAppVersion: "1.4.0" }));

    expect(runExpectingFailure(READ_VERSION, [manifest])).not.toBe(0);
  });
});

describe("is-prerelease.sh", () => {
  it("reports a version containing '-' as a pre-release", () => {
    expect(run(IS_PRERELEASE, ["1.2.3-beta.1"])).toBe("true\n");
    expect(run(IS_PRERELEASE, ["0.5.0-rc.2"])).toBe("true\n");
  });

  it("reports a version without '-' as not a pre-release", () => {
    expect(run(IS_PRERELEASE, ["1.2.3"])).toBe("false\n");
    expect(run(IS_PRERELEASE, ["0.5.0"])).toBe("false\n");
  });

  it("ignores a leading 'v' when classifying", () => {
    expect(run(IS_PRERELEASE, ["v1.0.0"])).toBe("false\n");
    expect(run(IS_PRERELEASE, ["v1.0.0-beta.1"])).toBe("true\n");
  });

  it("exits non-zero when no version argument is given", () => {
    expect(runExpectingFailure(IS_PRERELEASE, [])).not.toBe(0);
  });
});
