# Versioning and Releases

This document explains how to bump versions, what happens during a release, and how the beta vs stable lifecycle works for this plugin.

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

All three files must always agree on the current version. The `npm version` command (via `version-bump.mjs`) keeps them in sync automatically — never edit them by hand.

### `package.json`
```json
{ "version": "0.1.4-beta.5" }
```
- The **source of truth** for `npm version` commands
- Drives the `version-bump.mjs` script via `process.env.npm_package_version`

### `manifest.json`
```json
{ "version": "0.1.4-beta.5", "minAppVersion": "1.4.0" }
```
- Read by Obsidian to identify the installed plugin version
- **Always updated** by `version-bump.mjs` (both stable and pre-release)
- `minAppVersion` is set manually when you need to raise the Obsidian version floor

### `versions.json`
```json
{ "0.1.0": "1.4.0" }
```
- Maps **stable** plugin versions → their `minAppVersion` requirement
- Used by Obsidian's update checker to determine compatibility
- **Only updated for stable releases** — pre-release versions are intentionally excluded
- Never add pre-release entries here manually

---

## How to Bump Versions

All version bumps follow the same pattern:

```bash
npm version <new-version>
git push && git push --tags
```

`npm version` runs `version-bump.mjs` (via the `"version"` script in `package.json`), which:
1. Writes the new version into `manifest.json`
2. Adds a `versions.json` entry **only** if the version has no `-` suffix (stable only)
3. Stages both files with `git add manifest.json versions.json`

Then `npm version` creates a git commit and tag automatically.

### Specific commands for each scenario

#### Next beta (incrementing beta counter)
```bash
npm version 0.1.4-beta.6
```

#### First beta of a new patch
```bash
npm version 0.1.5-beta.1
```

#### First beta of a new minor version
```bash
npm version 0.2.0-beta.1
```

#### Release candidate
```bash
npm version 0.1.5-rc.1
```

#### Promote beta to stable
```bash
npm version 0.1.5
```
This is the only scenario that updates `versions.json`.

#### Minor release
```bash
npm version 0.2.0
```

#### Major release (1.0.0)
```bash
npm version 1.0.0
```

> **Tip:** You can also use npm's shorthand keywords for stable bumps:
> `npm version patch`, `npm version minor`, `npm version major`

---

## What `version-bump.mjs` Does

```
version-bump.mjs
├── Reads new version from $npm_package_version (set by npm version)
├── Reads manifest.json
├── Sets manifest.version = new version
├── Writes manifest.json
└── If version does NOT contain "-" (i.e. stable):
    ├── Reads versions.json
    ├── Adds entry: { [new version]: minAppVersion }
    └── Writes versions.json
```

The script is invoked automatically by `npm version` via the `"version"` script in `package.json`. You never call it directly.

---

## The Release Pipeline

### PR Validation (`pr-validation.yml`)

Runs on every PR targeting `main`. All three checks must pass before merging:

1. **Lint** — `npm run lint`
2. **Test with coverage** — `npm run test:coverage`
3. **Build** — `npm run build`

### Release Workflow (`release.yml`)

Runs on every push to `main` (including merged PRs) and can also be triggered manually via `workflow_dispatch`.

**Steps:**

1. **Quality gate** — Lint + test with coverage (same as PR validation, but release is blocked if these fail)
2. **Extract version** — Reads `manifest.json` for the version and tag name
3. **Detect release type** — Checks whether the version contains `-`; sets `is_prerelease=true/false`
4. **Check release state** — Three-state check:
   - No tag, no release → full release flow
   - Tag exists but no release → skip tag creation, create release only
   - Both exist → skip entirely (prints notice; bump the version to trigger a new release)
5. **Build** — `npm run build` (only if a release will be published)
6. **Create annotated tag** — `git tag -a "$VERSION" -m "Release $VERSION"` + push
7. **Create GitHub Release** — Uploads `main.js`, `manifest.json`, `styles.css`

**Key release flags:**
- `prerelease: true` when version contains `-`
- `make_latest: true` only for stable releases (so the "latest" badge always points to a stable version)
- `generate_release_notes: true` — GitHub auto-generates notes from commits

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
- Change it manually in `manifest.json` before running `npm version` when you need to raise the floor
- Once a stable version is tagged, the `minAppVersion` for that release is permanently recorded in `versions.json`

### `versions.json` purpose
- Obsidian's plugin update checker reads this file from the plugin's GitHub repo
- It uses it to determine whether a given release is compatible with the user's Obsidian version
- Only stable releases appear here — this is intentional and matches Obsidian's expectations

### Manual install (beta testing)
Users can manually install a beta by downloading `main.js` and `manifest.json` from a beta GitHub Release and placing them in their vault's `.obsidian/plugins/project-manager/` folder.

---

## Version Progression Examples

### Current state → 1.0.0

```
0.1.4-beta.5  (current)
      ↓  npm version 0.1.4
0.1.4         (stable patch — if 0.1.4 features are ready)
      ↓  npm version 0.2.0-beta.1
0.2.0-beta.1  (start next feature cycle)
      ↓  ...iterate betas...
0.2.0-beta.N
      ↓  npm version 0.2.0
0.2.0         (stable minor)
      ↓  ...continue through 0.x.0 milestones...
1.0.0-rc.1    (release candidate for 1.0)
      ↓  npm version 1.0.0
1.0.0         (first major stable release)
```

### Hotfix on a stable release

```bash
# If 0.1.4 is the current stable and you need a hotfix:
npm version 0.1.5-beta.1   # optional: test the fix first
npm version 0.1.5           # stable hotfix release
```
