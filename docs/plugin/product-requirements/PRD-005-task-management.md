# PRD-005: Task Management (`pm-tasks`)

## 1. Overview

The `pm-tasks` code block renders interactive task views with multi-panel filtering. Dashboard mode displays all vault tasks (excluding `utility/`) grouped by one of four view modes. By-project mode groups tasks under their parent project. Filter state is persisted to the note's frontmatter and restored on reload. Checkbox interaction reads and writes the source markdown file directly.

---

## 2. User Stories

- As a user, I want to see all tasks across my vault in one place, grouped by context (client/project/meeting), so I have a complete picture of my work.
- As a user, I want to filter tasks by due date (preset buttons or a custom range) so I can focus on what is due today or this week.
- As a user, I want to filter tasks by priority so I can focus on urgent work first.
- As a user, I want to filter tasks by tag so I can see work for a specific category.
- As a user, I want to check off a task from the dashboard and have the source file updated, so I don't have to open the note manually.
- As a user, I want my filter settings to persist between sessions so I don't have to re-apply them every time.
- As a consultant, I want to see tasks grouped by project (with status filtering) so I can review outstanding work per engagement.

---

## 3. Functional Requirements

### 3.1 Code Block Syntax

```
```pm-tasks
mode: dashboard | by-project
# Optional defaults:
viewMode: context | date | priority | tag
sortBy: none | dueDate-asc | dueDate-desc | priority-asc | priority-desc
showCompleted: false
dueDateFilter:
  mode: presets | range
  presets: [Today, Tomorrow, This Week, Next Week, Overdue, "No Date"]
  rangeFrom: "YYYY-MM-DD"
  rangeTo: "YYYY-MM-DD"
tagFilter: [tag1, tag2]
includeUntagged: false
```
```

### 3.2 Dashboard Mode (`mode: dashboard`)

Displays all vault tasks, excluding tasks in the `utility/` folder.

**Filter panels (all interactive):**

| Panel | Options |
|-------|---------|
| View Mode | Context, Due Date, Priority, Tag |
| Sort | None, Due Date ↑, Due Date ↓, Priority ↑, Priority ↓ |
| Show Completed | Toggle (include/exclude completed tasks) |
| Search | Free-text filter against task content |
| Context Filters | Context type, client, engagement, project status, inbox status, meeting date |
| Date Filters | Preset buttons + custom date range (see §3.3) |
| Priority Filters | Urgent, High, Medium, Low, Someday |
| Tag Filters | Dynamic tag buttons + "Include untagged" checkbox (see §3.4) |

**Multi-stage filtering:** All active filter panels are applied in combination (AND logic across panels).

#### View Mode: Context

Groups tasks hierarchically: Context type → File → Task.

Context types and their source folders:

| Context type | Source folder(s) |
|---|---|
| Project | `projects/`, `projects/notes/` |
| Person | `people/` |
| Meeting | `meetings/single/`, `meetings/recurring/` |
| Recurring Meeting | `meetings/recurring-events/` |
| Inbox | `inbox/` |
| Daily Notes | `daily notes/` |
| Other | all other paths |

For the Project context type, tasks from project notes are nested under their parent project (using the relationship traversal chain from PRD-001).

For the Recurring Meeting context type, tasks from recurring meeting event files are nested under their parent recurring meeting using a three-level hierarchy: Recurring Meeting (H3) → Event (H4) → Tasks. The parent meeting is resolved via the `recurring-meeting` frontmatter field on the event file. Event files with no `recurring-meeting` frontmatter are rendered flat (H3 → Tasks) as orphan entries.

Recurring meeting event tasks appear under a distinct **"Recurring Meeting"** header, separate from single-meeting and recurring-meeting-definition tasks (which appear under "Meeting").

#### View Mode: Due Date

Groups tasks into buckets: Overdue / Today / Tomorrow / This Week / Upcoming / No Date.

#### View Mode: Priority

Groups tasks by priority level 1–5 (Urgent → Someday).

#### View Mode: Tag

Groups tasks by tag. Untagged tasks are grouped last.

### 3.3 Due Date Filter

**Preset mode** — Six preset buttons, each toggleable independently (OR logic across active presets):

| Preset | Behaviour |
|--------|-----------|
| Today | Tasks due today |
| Tomorrow | Tasks due tomorrow |
| This Week | Tasks due within the next 7 days |
| Next Week | Tasks due 8–14 days from now |
| Overdue | Tasks with a due date in the past |
| No Date | Tasks with no due date set |

Multiple presets can be active simultaneously. An empty preset selection (all toggled off) shows all tasks.

**Range mode** — "From" and "To" date inputs (ISO format `YYYY-MM-DD`). Entering a date automatically:
- Switches the filter to range mode.
- Clears all active preset selections.

Only one range can be active at a time.

**Backward compatibility:** The old `dueDateFilter: "Today"` string format (single string instead of structured object) is still accepted and automatically migrated to the new structured preset format.

### 3.4 Tag Filter

The tag filter section appears only when tasks in the vault have tags.

- **Tag buttons** — one button per unique tag found across all tasks. Toggling a tag adds/removes it from the active tag filter. Multiple tags use OR logic.
- **Include untagged checkbox** — when checked, includes tasks with no tags in the results alongside any tag-filtered results.

### 3.5 By-Project Mode (`mode: by-project`)

Groups tasks under their parent project. Only shows projects matching selected statuses.

**Filters:**

| Filter | Default | Options |
|--------|---------|---------|
| Project status checkboxes | New, Active, On Hold | New, Active, On Hold, Complete |
| Project name text filter | *(empty)* | Free text |
| Show Completed toggle | false | true/false |

### 3.6 Checkbox Toggle Interaction

Clicking a task checkbox:
1. Reads the source markdown file via the Vault API.
2. Toggles `[ ]` ↔ `[x]` on the matching task line.
3. Adds `✅ YYYY-MM-DD` (today's date) when completing; removes it when un-completing.
4. Writes the modified file back via `vault.modify()`.

The `TaskParser` (regex-based, Tasks plugin emoji format, no Tasks plugin API dependency) is used to parse and update task lines.

> **Note:** The Tasks community plugin is required for structured task authoring (emoji due dates, priorities, completion markers). `TaskParser` parses the format via regex regardless of whether the plugin is installed, but the Tasks plugin is the standard authoring tool. Tasks authored without the Tasks plugin emoji format will lack due date and priority data.

### 3.7 Filter State Persistence

- Filter state is serialised to the note's frontmatter under the `pm-tasks-filters` key.
- State is restored from frontmatter when the code block re-renders (e.g. on page reload).
- Defaults specified in the code block YAML are applied when no persisted state exists.

---

## 4. Data Requirements

- Task data is sourced from `QueryService` (`dv.pages()` — all vault pages, excluding `utility/`).
- `TaskParser` parses task lines using the Tasks plugin emoji format (due dates, priority emojis, completion markers).
- `TaskFilterService` applies multi-stage filtering; `TaskSortService` handles sorting.
- Both services are injected via `TaskProcessorServices` (wired in `main.ts`).
- Relationship context (project → engagement → client, recurring meeting event → meeting → engagement → client) is resolved using the traversal chains in PRD-001.

---

## 5. UI/UX Requirements

- Filter panels should be visually grouped and collapsible or clearly sectioned.
- Active filters should be visually distinguished from inactive ones.
- Task groups should have clear headings.
- The "Include untagged" checkbox should be co-located with tag buttons.
- Checkbox toggle must provide immediate visual feedback (checkbox state changes before the file write completes).
- Task text renders inline markdown: wikilinks (`[[Note]]`) navigate to the referenced note; external markdown links (`[label](url)`) open in the browser. Links are not displayed as raw plain text.

---

## 6. Dependencies & Cross-References

- **PRD-001** — Relationship traversal chains for context grouping and filtering.
- **PRD-007** — `utility/` folder path (excluded from task queries) comes from Settings. Dataview graceful degradation.
- **Tasks community plugin** (`obsidian-tasks-plugin`) — required for structured task authoring (emoji due dates, priorities, completion markers). Graceful degradation behaviour (Notice at startup; plugin continues to load; date/priority filters return no data when absent) is defined in PRD-007.

---

## 7. Acceptance Criteria

- [ ] Dashboard mode displays tasks from all vault files except those in `utility/`.
- [ ] All four view modes (context, date, priority, tag) render tasks in the correct groups.
- [ ] Context view nests project-note tasks under their parent project.
- [ ] Context view nests recurring meeting event tasks under their parent recurring meeting: H3 for the parent meeting, H4 for each event file, then tasks. Event files without a `recurring-meeting` frontmatter link render flat under their own H3.
- [ ] Client/engagement filters correctly resolve tasks in recurring meeting event files via their parent recurring meeting's engagement.
- [ ] Due date presets filter correctly; multiple presets use OR logic; empty selection shows all.
- [ ] Entering a date range switches to range mode and clears presets.
- [ ] Priority filter buttons show/hide tasks by priority level.
- [ ] Tag filter buttons appear only when tasks have tags; OR logic applies across selected tags.
- [ ] "Include untagged" checkbox includes untagged tasks when checked.
- [ ] Checkbox toggle updates the source file (toggles `[ ]`/`[x]`, adds/removes completion date).
- [ ] Filter state is saved to frontmatter under `pm-tasks-filters` and restored on reload.
- [ ] Old `dueDateFilter: "Today"` string format is automatically migrated to structured format.
- [ ] Context view renders a "Recurring Meeting" h2 header for tasks from `meetings/recurring-events/`, distinct from the "Meeting" header for single-meeting and recurring-meeting-definition tasks.
- [ ] Selecting "Recurring Meeting" in the context-type filter shows only recurring meeting event tasks; selecting "Meeting" shows only single-meeting and recurring-meeting-definition tasks.
- [ ] Saved `contextFilter` values containing "Meeting" are automatically migrated to also include "Recurring Meeting" on first load, preserving the user's original intent.
- [ ] By-project mode groups tasks by project and respects status and name filters.
- [ ] Task text renders markdown links correctly: wikilinks and external markdown links in task text are clickable (not plain text) in all dashboard view modes and by-project mode.

---

## 8. Out of Scope

- Creating new tasks from the dashboard (tasks are created by editing source notes).
- Editing task text from the dashboard.
- Custom task parsers or support for non-Tasks-plugin emoji formats beyond what `TaskParser` handles.
- Syncing task state to external task management tools.
