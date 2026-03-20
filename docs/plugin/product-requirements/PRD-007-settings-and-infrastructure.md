# PRD-007: Settings & Infrastructure

## 1. Overview

The plugin exposes a settings tab with six configuration sections: Folder Paths, Default Values, UI Preferences, Debug Logging, Vault Management, and Developer Tools. Beyond settings, this PRD covers the Dataview optional dependency (graceful degradation), installation methods, migration from the template vault, and the versioning and release pipeline.

---

## 2. User Stories

- As a user, I want to configure the vault folders used for each entity type so the plugin fits my existing vault structure.
- As a user, I want to set default values for status fields so newly created entities have sensible defaults.
- As a user, I want to control whether ribbon icons are shown and what the default task view mode is.
- As a developer/admin, I want to enable debug logging to a vault folder so I can diagnose issues.
- As a new user, I want a single button to create all required folders and view files so I can get started quickly.
- As a developer, I want to generate and clean up test data without touching production notes.

---

## 3. Functional Requirements

### 3.1 Folder Paths Section

Configures the vault-relative folder path for each entity type. All 11 folder paths are editable text fields. Leaving a field blank resets it to the default.

| Setting key | Setting name | Default |
|-------------|-------------|---------|
| `folders.clients` | Clients folder | `clients` |
| `folders.engagements` | Engagements folder | `engagements` |
| `folders.projects` | Projects folder | `projects` |
| `folders.projectNotes` | Project notes folder | `projects/notes` |
| `folders.people` | People folder | `people` |
| `folders.inbox` | Inbox folder | `inbox` |
| `folders.meetingsSingle` | Single meetings folder | `meetings/single` |
| `folders.meetingsRecurring` | Recurring meetings folder | `meetings/recurring` |
| `folders.meetingsRecurringEvents` | Recurring meeting events folder | `meetings/recurring/events` |
| `folders.dailyNotes` | Daily notes folder | `daily notes` |
| `folders.utility` | Utility folder | `utility` |

### 3.2 Default Values Section

Sets the default status for newly created entities.

| Setting key | Setting name | Options | Default |
|-------------|-------------|---------|---------|
| `defaults.projectStatus` | Default project status | New, Active, On Hold | New |
| `defaults.clientStatus` | Default client status | Active, Inactive | Active |
| `defaults.engagementStatus` | Default engagement status | Active, Inactive | Active |
| `defaults.defaultTaskViewStatuses` | Default task view statuses | New, Active, On Hold, Complete | New, Active, On Hold |

### 3.3 UI Preferences Section

| Setting key | Setting name | Type | Default |
|-------------|-------------|------|---------|
| `ui.showRibbonIcons` | Show ribbon icons | Toggle | `true` |
| `ui.defaultTaskViewMode` | Default task view mode | Dropdown (Context / Due Date / Priority / Tag) | `context` |
| `ui.showCompletedByDefault` | Show completed tasks by default | Toggle | `false` |

### 3.4 Debug Logging Section

| Setting key | Setting name | Type | Default |
|-------------|-------------|------|---------|
| `logging.enabled` | Enable logging | Toggle | `false` |
| `logging.logDirectory` | Log directory | Text | `utility/logs` |
| `logging.minLevel` | Minimum log level | Dropdown (DEBUG / INFO / WARN / ERROR) | `INFO` |
| `logging.maxRetentionDays` | Log retention days | Text (integer) | `30` |

When enabled, plugin activity is written to log files in the configured vault folder. Setting retention to `0` keeps all log files indefinitely.

### 3.5 Vault Management Section

| Control | Description |
|---------|-------------|
| **Set Up Vault** button | Invokes `PM: Set Up Vault Structure` command. Creates all required folders and default view files. Safe to run on an existing vault. |

### 3.6 Developer Tools Section

| Control | Description |
|---------|-------------|
| **Generate Test Data** button | Creates 90 sample entity files (10 per entity type), each with 5 tasks (2 past due, 3 future due dates). All generated files are prefixed with `[TEST]`. Returns totals: `{ totalFiles, totalTasks, errors }`. |
| **Clean Test Data** button | Deletes all vault files whose basename starts with `[TEST]`. Returns the count of deleted files. |

Both buttons disable themselves during the operation and display an Obsidian Notice on completion or error.

---

## 4. Data Requirements

### 4.1 Settings Schema

Settings are persisted in Obsidian's plugin data store (`data.json`) via `loadData()` / `saveData()`. The full schema is:

```typescript
ProjectManagerSettings {
  folders: FolderSettings       // 11 folder paths
  defaults: DefaultValueSettings // clientStatus, engagementStatus, projectStatus, defaultTaskViewStatuses
  ui: UiPreferenceSettings       // showRibbonIcons, defaultTaskViewMode, showCompletedByDefault
  logging: LoggingSettings       // enabled, logDirectory, minLevel, maxRetentionDays
}
```

### 4.2 Test Data Generation Order

Entity generation follows parent-first order to ensure all foreign-key wikilinks reference already-created files:

```
Clients → People, Engagements → Projects, Inbox Notes, Single Meetings, Recurring Meetings
→ Project Notes, Recurring Meeting Events
```

---

## 5. UI/UX Requirements

- The settings tab must render six clearly separated sections with `<h3>` headings.
- Text inputs for folder paths must show the default as placeholder text.
- The Set Up Vault and Developer Tools buttons must use Obsidian's `.setCta()` styling for primary actions.
- Developer Tools section must include a cautionary description: "Use with caution in production vaults."
- Notices displayed after operations must clearly state the outcome (count of files created/deleted, or error message).

---

## 6. Dataview Graceful Degradation

- Dataview is an **optional** dependency checked at `onLayoutReady`.
- If Dataview is not found, an Obsidian Notice is shown, but the plugin continues to load.
- Commands and non-query processors (`pm-actions`) continue to function without Dataview.
- `QueryService.dv()` returns `null` when Dataview is unavailable; all query methods guard against this.
- Processors that require Dataview (`pm-table`, `pm-tasks`, `pm-recurring-events`, `pm-properties` suggesters) display a "Dataview is not available" message when `dv()` is `null`.

---

## 7. Installation

### 7.1 Requirements

- Obsidian **1.4.0** or later.
- Dataview plugin (optional; required for query-based processors).

### 7.2 Primary Method: BRAT (Beta Reviewer's Auto-update Tester)

The plugin is not yet listed in the Obsidian Community Plugin directory. Installation via BRAT:

1. Install and enable the **BRAT** community plugin.
2. Open Settings → BRAT → Add Beta plugin.
3. Enter the repository URL: `https://github.com/segFallt/obsidian-plugin-project-manager`.
4. Click Add Plugin. BRAT downloads and installs automatically.
5. Enable the plugin in Settings → Community plugins.

BRAT checks for updates automatically. Manual update: Settings → BRAT → Check for updates for all beta plugins.

### 7.3 Manual Installation (Beta Testing)

Download `main.js` and `manifest.json` from a GitHub Release and place them in `.obsidian/plugins/project-manager/` in the vault.

### 7.4 Future: Community Plugins

Once listed in the Obsidian Community Plugin directory, installation will be via Settings → Community plugins → Browse.

---

## 8. Migration from Template Vault

For users migrating from the predecessor template vault (QuickAdd + Templater + Meta Bind):

1. Install and enable Project Manager plugin and Dataview.
2. Optionally disable QuickAdd, Templater, and Meta Bind (the plugin replaces their functionality).
3. Replace code blocks in existing notes using find-and-replace:
   - `meta-bind-embed` blocks → `pm-properties` blocks.
   - Meta Bind button blocks → `pm-actions` blocks.
   - `dataviewjs` table scripts → `pm-table` blocks.
   - Task Dashboard and Task Query By Project notes → `pm-tasks` blocks.
4. Run `PM: Set Up Vault Structure` to create new view files.
5. No frontmatter migration required — the plugin uses the same frontmatter properties as the original vault.

---

## 9. Versioning & Release Pipeline

### 9.1 Versioning Scheme

Semantic Versioning (`MAJOR.MINOR.PATCH`) with optional pre-release suffixes:

| Format | Example | When to use |
|--------|---------|-------------|
| Stable | `1.0.0` | Production-ready release |
| Beta | `1.0.0-beta.1` | Feature-complete, needs user testing |
| Release candidate | `1.0.0-rc.1` | Final testing before stable |

Rules: patch for bug fixes, minor for new backward-compatible features, major for breaking changes.

### 9.2 Version Files

Three files must always agree on the current version. `npm version` (via `version-bump.mjs`) keeps them in sync automatically:

| File | Role |
|------|------|
| `package.json` | Source of truth for `npm version` |
| `manifest.json` | Read by Obsidian; always updated (stable + pre-release) |
| `versions.json` | Maps stable versions → `minAppVersion`; **only updated for stable releases** |

### 9.3 Version Bump Command

```bash
npm version <new-version>
git push && git push --tags
```

`version-bump.mjs` writes the new version to `manifest.json`, adds a `versions.json` entry only for stable (no `-` suffix), and stages both files.

### 9.4 Release Pipeline (GitHub)

**PR Validation (`pr-validation.yml`)** — runs on every PR to `main`:
- Lint → Test with coverage → Build

**Release (`release.yml`)** — runs on every push to `main`:
1. Quality gate (lint + test:coverage).
2. Extract version from `manifest.json`.
3. Detect release type (`is_prerelease` = version contains `-`).
4. Three-state release check: skip if tag + release already exist; create release only if tag exists but no release; full flow otherwise.
5. Build (`npm run build`).
6. Create annotated git tag.
7. Create GitHub Release, uploading `main.js`, `manifest.json`, `styles.css`.

Key flags: `prerelease: true` for pre-release versions; `make_latest: true` only for stable releases.

---

## 10. Dependencies & Cross-References

- **PRD-001** — Folder path settings control where entity files are created.
- **PRD-002** — Default status values are applied by creation commands.
- **PRD-005** — `utility/` folder setting controls task query exclusion; `defaultTaskViewMode` and `showCompletedByDefault` are task dashboard defaults.
- All PRDs — Dataview graceful degradation affects all query-based processors.

---

## 11. Acceptance Criteria

- [ ] All 11 folder path fields render and persist correctly; blank input resets to default.
- [ ] Default project/client/engagement status settings apply to newly created entities.
- [ ] UI preference settings (`showRibbonIcons`, `defaultTaskViewMode`, `showCompletedByDefault`) take effect without restart.
- [ ] Debug logging writes to the configured folder when enabled; respects `minLevel` and `maxRetentionDays`.
- [ ] Set Up Vault button triggers scaffold without overwriting existing files.
- [ ] Generate Test Data creates 90 files; Clean Test Data deletes all `[TEST]`-prefixed files.
- [ ] Dataview absence shows a Notice at startup but does not prevent the plugin from loading.
- [ ] Query-based processors show "Dataview is not available" when Dataview is absent.
- [ ] `npm version <new-version>` updates `manifest.json` and `versions.json` (stable only) atomically.
- [ ] Release workflow creates a GitHub Release with the correct `prerelease` and `make_latest` flags.

---

## 12. Out of Scope

- Per-vault or per-note settings overrides.
- Settings import/export.
- Automated Obsidian version floor bumps (the `minAppVersion` in `manifest.json` is set manually).
- GitLab CI pipeline (referenced in PROJECT.md as forthcoming; not yet implemented).
