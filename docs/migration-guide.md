# Migration Guide

Step-by-step guide for migrating from the template vault (QuickAdd + Templater + Meta Bind) to the Engagement Project Manager plugin.

---

## Before You Start

1. Install and enable the **Engagement Project Manager** plugin
2. Ensure **Dataview** is installed and enabled
3. Keep a backup of your vault

---

## Upgrading Across the v0.4.0 Rename

In v0.4.0 the plugin's id and display name changed from `project-manager` / "Project Manager" to `engagement-project-manager` / "Engagement Project Manager". Because Obsidian keys plugins by their manifest id, this is a breaking change for existing installs. If you are upgrading from a pre-v0.4.0 install:

1. **Back up your vault** before updating.
2. After updating, open **Settings → Community plugins** and confirm the plugin now appears as **Engagement Project Manager** and is enabled. If Obsidian shows it as disabled or newly added, re-enable it.
3. Verify your existing settings (folder paths, default values, UI preferences) are still intact.

The rename does not delete or migrate any data — nothing in the plugin clears settings or vault content across the rename — but the exact upgrade behavior (in-place update vs. a fresh install) depends on how you installed the plugin (BRAT vs. manual), so re-enabling and checking settings after updating is worth doing regardless.

---

## Step 1: Remove Old Plugins (Optional)

After migration, you can disable (but not necessarily delete) QuickAdd, Templater, and Meta Bind. The plugin replaces all their functionality.

---

## Step 2: Replace Code Blocks in Notes

Use find-and-replace across your vault for the following patterns.

### Properties editors (Meta Bind embeds)

| Old | New |
|-----|-----|
| `` ```meta-bind-embed\n[[client-properties]]\n``` `` | `` ```pm-properties\nentity: client\n``` `` |
| `` ```meta-bind-embed\n[[engagement-properties]]\n``` `` | `` ```pm-properties\nentity: engagement\n``` `` |
| `` ```meta-bind-embed\n[[project-properties]]\n``` `` | `` ```pm-properties\nentity: project\n``` `` |
| `` ```meta-bind-embed\n[[person-properties]]\n``` `` | `` ```pm-properties\nentity: person\n``` `` |
| `` ```meta-bind-embed\n[[inbox-properties]]\n``` `` | `` ```pm-properties\nentity: inbox\n``` `` |
| `` ```meta-bind-embed\n[[single-meeting-properties]]\n``` `` | `` ```pm-properties\nentity: single-meeting\n``` `` |
| `` ```meta-bind-embed\n[[recurring-meeting-properties]]\n``` `` | `` ```pm-properties\nentity: recurring-meeting\n``` `` |

### Action buttons (Meta Bind buttons)

| Old | New |
|-----|-----|
| `` ```meta-bind-embed\n[[project-actions]]\n``` `` | `` ```pm-actions\nactions:\n  - type: create-project-note\n    label: New Project Note\n    style: primary\n``` `` |
| `` ```meta-bind-embed\n[[inbox-actions]]\n``` `` | `` ```pm-actions\nactions:\n  - type: convert-inbox\n    label: Convert to Project\n    style: primary\n``` `` |

### Dataview table scripts

| Old | New |
|-----|-----|
| `` ```dataviewjs\nawait dv.view("scripts/dataview/client-engagements-table")\n``` `` | `` ```pm-table\ntype: client-engagements\n``` `` |
| `` ```dataviewjs\nawait dv.view("scripts/dataview/client-people-table")\n``` `` | `` ```pm-table\ntype: client-people\n``` `` |
| `` ```dataviewjs\nawait dv.view("scripts/dataview/engagement-projects-table")\n``` `` | `` ```pm-table\ntype: engagement-projects\n``` `` |
| `` ```dataviewjs\nawait dv.view("scripts/dataview/related-project-note-table", ...)\n``` `` | `` ```pm-table\ntype: related-project-notes\n``` `` |
| `` ```dataviewjs\nawait dv.view("scripts/dataview/mentions-table", ...)\n``` `` | `` ```pm-table\ntype: mentions\n``` `` |

### Task Dashboard

Replace the entire content of `Task Dashboard.md` with:

```markdown
---
obsidianUIMode: preview
---
# Task Dashboard

```pm-tasks
mode: dashboard
```
```

Replace `Task Query By Project.md` with:

```markdown
---
obsidianUIMode: preview
---
# Tasks By Project

```pm-tasks
mode: by-project
```
```

---

## Step 3: Replace Template Files

Run `PM: Set Up Vault Structure` — this creates new default view files. The plugin uses embedded templates for entity creation (no template files needed in the vault).

If you have custom content in your template files that you want to preserve:
1. Copy the custom content
2. After creating entities with the plugin, paste the content into the appropriate sections

---

## Step 4: Migrate Frontmatter

The plugin uses the same entity frontmatter properties as the original vault, so entity notes need no migration.

One dashboard filter-state migration runs **automatically** on upgrade — no user action, and no saved filters are lost:

- **`pm-tasks` blocks** — filters previously saved under a single flat `pm-tasks-filters` frontmatter key now save per block under `pm-view-state.<blockKey>`. The first time each block renders, its filters are copied forward from the legacy key (copy-not-delete). The old `pm-tasks-filters` value is left in place as a harmless read-only fallback. In a note with **multiple `pm-tasks` blocks**, every block inherits the previously-shared filters on first load; adjust each block independently afterwards.

The **References dashboard** needs no migration: it has always persisted to plugin settings (`settings.ui.referenceDashboardFilters`, now via the shared `SettingsViewStore`) rather than note frontmatter, and it reads and writes the same settings key — nothing is reshaped or moved.

The **search panel** (`PM: Open Search`) needs no migration either: it is new, and its filter state persists to plugin settings (`settings.ui.savedSearchFilters`, via the shared `SettingsViewStore`) rather than note frontmatter. Existing vaults have no saved value, so each sub-key falls back to its default on first load; because the settings deep-merge is only two levels deep, the panel defaults any missing `savedSearchFilters` sub-key at read time, so a later added field cannot leave an existing user's filter `undefined`.

---

## Step 5: Verify

1. Open a client note — the `pm-properties` and `pm-table` blocks should render
2. Run `PM: Create Project` from the command palette — a project should be created and opened
3. Open `Task Dashboard.md` — filters and tasks should appear
4. Toggle a task checkbox — the source file should be updated

---

## Troubleshooting

**Blocks show "Dataview is not available"**
→ Ensure Dataview is installed and enabled. Reload Obsidian if needed.

**Suggester dropdowns are empty**
→ Check that entities exist with the correct `#tag` in their frontmatter and `status: Active`.

**pm-table shows "No engagements found"**
→ Verify the current file is linked via the correct frontmatter property (e.g. `client: [[Your Client]]`).

**Task checkbox doesn't update**
→ The `pm-tasks` processor reads and writes the source file directly. Ensure the file is not locked by another process.
