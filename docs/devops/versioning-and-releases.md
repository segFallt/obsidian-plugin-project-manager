# Versioning and Releases

This document explains how to bump versions, prepare a release, and what happens in CI when a release MR is merged.

---

## Versioning Scheme

This project uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) with optional pre-release suffixes.

| Format | Example | When to use |
|--------|---------|-------------|
| Stable | `1.0.0` | Production-ready release |
| Beta | `1.0.0-beta.1` | Feature-complete but needs user testing |
| Release candidate | `1.0.0-rc.1` | Final testing before stable release |

**Rules:**
- Increment `PATCH` for bug fixes (`0.1.4` → `0.1.5`)
- Increment `MINOR` for new backward-compatible features (`0.1.5` → `0.2.0`)
- Increment `MAJOR` for breaking changes (`0.2.0` → `1.0.0`)
- Beta/RC counter resets to `.1` for each new base version

---

## The Three Version Files

All three files must always agree on the current version. `.ci/bump-version.sh` keeps them in sync — never edit them by hand.

### `package.json`
```json
{ "version": "0.1.4-beta.5" }
```
- The **source of truth** read by `bump-version.sh`
- Drives `version-bump.mjs` via `process.env.npm_package_version`

### `manifest.json`
```json
{ "version": "0.1.4-beta.5", "minAppVersion": "1.4.0" }
```
- Read by Obsidian to identify the installed plugin version
- **Always updated** by `version-bump.mjs` (both stable and pre-release)
- `minAppVersion` is set manually when you need to raise the Obsidian version floor
- CI detects changes to this file on `main` to trigger the auto-tag job

### `versions.json`
```json
{ "0.1.0": "1.4.0" }
```
- Maps **stable** plugin versions → their `minAppVersion` requirement
- Used by Obsidian's update checker to determine compatibility
- **Only updated for stable releases** — pre-release versions are intentionally excluded
- Never add pre-release entries here manually

---

## Release Steps Overview

Always start from a release branch — never run the bump steps directly on `main`.

1. **Create a release branch** from an up-to-date `main`:
   ```bash
   git checkout main && git pull
   git checkout -b release/v<x.y.z>
   ```

2. **Run Phase 1** — bump the version and generate a changelog template:
   ```bash
   .ci/bump-version.sh patch   # or minor / major / explicit version e.g. 0.2.0
   ```

3. **Edit `CHANGELOG.md`** — replace the placeholder lines with real release notes.

4. **Run Phase 2** — validate the changelog and create the release commit:
   ```bash
   .ci/bump-version.sh --commit <x.y.z>
   ```

5. **Push the branch and open an MR** targeting `main`. Once merged:
   - The GitLab CI `auto-tag` job detects the change to `manifest.json` on `main`, reads the new version, and creates the `v<x.y.z>` tag. The tag triggers the `build` and `publish` jobs (GitLab Release).
   - The GitHub Actions `auto-tag.yml` workflow independently detects the `manifest.json` change on `main`, creates its own `v<x.y.z>` tag on GitHub, runs the quality gate, and publishes the GitHub Release.

---

## Phase 1 — Bump version and prepare changelog

Run `.ci/bump-version.sh` with the desired bump type or an explicit version:

```bash
.ci/bump-version.sh patch   # 1.0.0 → 1.0.1
.ci/bump-version.sh minor   # 1.0.0 → 1.1.0
.ci/bump-version.sh major   # 1.0.0 → 2.0.0
.ci/bump-version.sh 2.5.0   # explicit version
```

This script:
1. Updates `package.json` with the new version
2. Calls `version-bump.mjs` to sync `manifest.json` and (for stable versions) `versions.json`
3. Prepends a changelog template section to `CHANGELOG.md`
4. Prints instructions and exits — it does **not** commit or tag

Edit `CHANGELOG.md` to replace the placeholder lines with real release notes before continuing.

---

## Phase 2 — Validate and commit

Once the changelog is filled in, run Phase 2:

```bash
.ci/bump-version.sh --commit <x.y.z>
```

This script:
1. Verifies `package.json` is already at `<x.y.z>` (fails fast if Phase 1 was skipped)
2. Checks that the `CHANGELOG.md` entry for `[<x.y.z>]` contains no unfilled placeholder lines (bare `-`)
3. Stages `package.json`, `manifest.json`, `versions.json`, and `CHANGELOG.md` and creates the commit `chore: release v<x.y.z>`

The script does **not** push and does **not** create a tag — CI handles the tag.

---

## What `version-bump.mjs` Does

```
version-bump.mjs
├── Reads new version from $npm_package_version
├── Reads manifest.json
├── Sets manifest.version = new version
├── Writes manifest.json
└── If version does NOT contain "-" (i.e. stable):
    ├── Reads versions.json
    ├── Adds entry: { [new version]: minAppVersion }
    └── Writes versions.json
```

This script is called by `bump-version.sh` (and also by `npm version` via the `"version"` hook in `package.json`). You never call it directly.

---

## The Release Pipeline

### MR Validation (`pr-validation.yml` / `mr-validate` job)

Runs on every MR targeting `main`. All three checks must pass before merging:

1. **Lint** — `npm run lint`
2. **Test with coverage** — `npm run test:coverage`
3. **Build** — `npm run build`

### Auto-tag (`auto-tag` job in `.gitlab-ci.yml`)

Runs on every push to `main` when `manifest.json` changes. Reads the version from `manifest.json` and creates the `v<version>` tag via the GitLab API using `RELEASE_TOKEN`. Idempotent — skips silently if the tag already exists.

**Prerequisite:** A CI/CD variable named `RELEASE_TOKEN` must be configured in **Settings → CI/CD → Variables**: a project or group access token with **Developer+ role** and **`write_repository` scope**, marked as **Protected**.

### GitLab Release (`validate-version` → `build` → `publish` jobs)

Runs on every `v*` tag:

1. **`validate-version`** — Confirms the tag name matches `manifest.json`
2. **`build`** — Runs `npm run build`, produces `main.js`, `manifest.json`, `styles.css` as artifacts
3. **`publish`** — Uploads artifacts to the GitLab Generic Package Registry, extracts release notes from `CHANGELOG.md`, creates a GitLab Release with asset links

### GitHub Release (`auto-tag.yml`)

Runs on every push to `main` when `manifest.json` changes. Entirely self-contained — does not depend on GitLab pushing tags to GitHub.

1. **Create tag** — Reads version from `manifest.json`, creates `v<version>` tag on GitHub. Idempotent — skips cleanly if the tag already exists.
2. **Extract release notes** — Reads the matching `## [<version>]` section from `CHANGELOG.md`.
3. **Quality gate** — `npm ci` → `npm run lint` → `npm run test:coverage` → `npm run build`
4. **Create GitHub Release** — Uploads `main.js`, `manifest.json`, `styles.css` (if present); notes sourced from `CHANGELOG.md`.

**Key release flags:**
- `--prerelease` when version tag contains `-`
- `--latest` for stable releases

---

## Beta vs Stable Release Differences

| Aspect | Beta (`-beta.N`) | Stable |
|--------|-----------------|--------|
| `manifest.json` updated | Yes | Yes |
| `versions.json` updated | **No** | Yes |
| GitHub Release `prerelease` flag | `true` | `false` |
| GitHub Release `make_latest` | `false` | `true` |
| Obsidian update checker shows it | No (community plugins) | Yes |
| Manual install possible | Yes (download from release) | Yes |

---

## Obsidian-Specific Considerations

### `minAppVersion`
- Defined in `manifest.json`
- The minimum Obsidian version required to install/run this plugin
- Change it manually in `manifest.json` before running `.ci/bump-version.sh` when you need to raise the floor
- Once a stable version is tagged, the `minAppVersion` for that release is permanently recorded in `versions.json`

### `versions.json` purpose
- Obsidian's plugin update checker reads this file from the plugin's GitHub repo
- It uses it to determine whether a given release is compatible with the user's Obsidian version
- Only stable releases appear here — this is intentional and matches Obsidian's expectations

### Manual install (beta testing)
Users can manually install a beta by downloading `main.js` and `manifest.json` from a beta GitHub Release and placing them in their vault's `.obsidian/plugins/project-manager/` folder.

---

## Troubleshooting

### Tag already exists

If the `auto-tag` job encounters a tag that already exists, it skips tag creation and exits 0:
```
Tag v1.0.1 already exists — skipping auto-tag
```
No action needed — the existing tag is left untouched.

### CI version mismatch

The `validate-version` job compares the tag name against `manifest.json`. If they differ:
```
ERROR: Tag version '1.0.1' does not match manifest.json version '1.0.0'
```
Delete the incorrect tag, ensure `manifest.json` is correct, and re-run the pipeline (or allow `auto-tag` to create the tag on the next merge).

### RELEASE_TOKEN not configured

If `RELEASE_TOKEN` is not set, the `auto-tag` job will fail with a `401 Unauthorized` error from the GitLab API. Add the variable under **Settings → CI/CD → Variables**.

---

## Version Progression Examples

### Current state → 1.0.0

```
0.1.13-beta.21  (current)
      ↓  .ci/bump-version.sh 0.1.13  →  fill CHANGELOG  →  --commit  →  MR
0.1.13          (stable)
      ↓  .ci/bump-version.sh minor   →  fill CHANGELOG  →  --commit  →  MR
0.2.0-beta.1    (start next feature cycle — use explicit version)
      ↓  ...iterate betas...
0.2.0-beta.N
      ↓  .ci/bump-version.sh 0.2.0   →  fill CHANGELOG  →  --commit  →  MR
0.2.0           (stable minor)
      ↓  ...continue through 0.x.0 milestones...
1.0.0-rc.1      (release candidate for 1.0)
      ↓  .ci/bump-version.sh 1.0.0   →  fill CHANGELOG  →  --commit  →  MR
1.0.0           (first major stable release)
```

### Hotfix on a stable release

```bash
git checkout -b release/v0.1.14
.ci/bump-version.sh patch          # bumps to 0.1.14
# edit CHANGELOG.md
.ci/bump-version.sh --commit 0.1.14
git push origin HEAD
# open MR → merge → CI auto-tags v0.1.14
```
