# Code Block Reference

## `pm-properties`

Renders an interactive frontmatter editor for the current note. Changes are persisted immediately via `processFrontMatter`. The component auto-refreshes (500ms debounce) when the current file is modified externally, so the displayed values stay in sync. Re-renders triggered by the component's own writes are suppressed to prevent infinite loops.

### Autocomplete suggesters

`suggester` and `list-suggester` fields use an **inline autocomplete** combobox instead of a plain dropdown:

- **Type to filter** — options are filtered by case-insensitive substring match as you type.
- **Keyboard navigation** — `ArrowDown`/`ArrowUp` to move, `Enter` to select, `Escape` to cancel.
- **Enriched entity display** — engagement and person options are shown as `"Name (Client)"` when the entity has a client link, making it easy to distinguish entities with similar names.
- **Frontmatter storage** — only the plain entity name is stored as a wikilink (e.g. `[[Eng1]]`), not the enriched display text.
- **Click to open** — clicking the input opens the suggestion list even after the input already has focus.
- **Single suggester** (`suggester`) — includes a `(None)` option to clear the field.
- **List suggester** (`list-suggester`) — selected items appear as removable chips above the input; clicking `×` removes the item. Duplicates are silently ignored. The suggestion list automatically reopens after each selection so you can add multiple items in sequence.

```yaml
```pm-properties
entity: <entity-type>
```
```

### Entity types and fields

**`client`**
- Status (Active / Inactive)
- Contact Name, Email, Phone
- Notes (textarea)

**`engagement`**
- Client (autocomplete suggester — active clients)
- Status, Start Date, End Date
- Description (textarea)

**`project`**
- Engagement (autocomplete suggester — active engagements, shown as "Eng (Client)")
- Start Date, End Date
- Priority (1–5)
- Status (New / Active / On Hold / Complete)

**`person`**
- Client (autocomplete suggester — active clients)
- Status, Title
- Reports To (autocomplete suggester — active people, shown as "Person (Client)")
- Notes (textarea)

**`inbox`**
- Engagement (autocomplete suggester — active engagements, shown as "Eng (Client)")
- Status

**`single-meeting`**
- Engagement (autocomplete suggester — shown as "Eng (Client)")
- Date (datetime picker)
- Attendees (list autocomplete suggester — active people, shown as "Person (Client)")

**`recurring-meeting`**
- Engagement (autocomplete suggester — shown as "Eng (Client)")
- Start Date, End Date
- Default Attendees (list autocomplete suggester — active people, shown as "Person (Client)")

**`recurring-meeting-event`**
- Recurring Meeting (autocomplete suggester — active recurring meetings by name)
- Date (datetime picker)
- Attendees (list autocomplete suggester — active people, shown as "Person (Client)")

**`project-note`**
- Related Project (text)
- Engagement (autocomplete suggester — shown as "Eng (Client)")

---

## `pm-table`

Renders a relationship table for entities linked to the current file.

```yaml
```pm-table
type: <table-type>
```
```

| `type` value | Shows | Used in |
|---|---|---|
| `client-engagements` | Engagements where `client` = current file | Client notes |
| `client-people` | People where `client` = current file | Client notes |
| `engagement-projects` | Projects where `engagement` = current file | Engagement notes |
| `related-project-notes` | Notes with `relatedProject` = current file, plus all backlinks | Project notes |
| `mentions` | All vault files backlinking to current file | Person notes |

---

## `pm-actions`

Renders action buttons. The following entity templates include a default `pm-actions` block so users can create related records directly from a note:

| Template | Default button |
|----------|----------------|
| Client | New Client (`create-client`) |
| Engagement | New Engagement (`create-engagement`) |
| Project | New Project Note (`create-project-note`), New Project (`create-project`) |
| Person | New Person (`create-person`) |

```yaml
```pm-actions
actions:
  - type: <action-type>
    label: <button text>
    style: primary | default | destructive
```
```

| `type` | Command triggered |
|--------|-------------------|
| `create-client` | PM: Create Client |
| `create-engagement` | PM: Create Engagement |
| `create-project` | PM: Create Project |
| `create-person` | PM: Create Person |
| `create-inbox` | PM: Create Inbox Note |
| `create-single-meeting` | PM: Create Single Meeting |
| `create-recurring-meeting` | PM: Create Recurring Meeting |
| `create-project-note` | PM: Create Project Note |
| `convert-inbox` | PM: Convert Inbox to Project |
| `scaffold-vault` | PM: Set Up Vault Structure |

Custom command IDs can be used with `commandId: <full-command-id>`.

---

## `pm-tasks`

Renders task views with interactive filtering.

```yaml
```pm-tasks
mode: dashboard | by-project
# Optional defaults:
viewMode: context | date | priority | tag
sortBy: none | dueDate-asc | dueDate-desc | priority-asc | priority-desc
showCompleted: false
# Due date filter (presets or range)
dueDateFilter:
  mode: presets | range
  presets: [Today, Tomorrow, This Week, Next Week, Overdue, "No Date"]
  rangeFrom: "2026-03-15"  # ISO date "YYYY-MM-DD", or null
  rangeTo: "2026-04-15"    # ISO date "YYYY-MM-DD", or null
# Tag filter
tagFilter: [tag1, tag2]
includeUntagged: false
```
```

### Dashboard mode (`mode: dashboard`)

Displays all vault tasks (excluding the `utility/` folder) with these filter panels:

- **View Mode**: Context, Due Date, Priority, Tag
- **Sort**: None, Due Date ↑/↓, Priority ↑/↓
- **Show Completed**: toggle
- **Search**: text filter
- **Context Filters**: context type, client, engagement, project status, inbox status, meeting date
- **Date Filters**: preset buttons (Today, Tomorrow, This Week, Next Week, Overdue, No Date) + custom date range
- **Priority Filters**: Urgent / High / Medium / Low / Someday
- **Tag Filters**: dynamic tag buttons (when tasks have tags) + "Include untagged" checkbox

Context view groups tasks hierarchically: Context → File → Task. For the Project context, tasks from project notes are nested under their parent project.

#### Due date filter details

The due date filter offers two modes:

**Preset mode** — Click any of the 6 preset buttons:
- **Today** — tasks due today
- **Tomorrow** — tasks due tomorrow
- **This Week** — tasks due within the next 7 days
- **Next Week** — tasks due 8–14 days from now
- **Overdue** — tasks with a due date in the past
- **No Date** — tasks with no due date set

Multiple presets can be active simultaneously (OR logic) — clicking a preset toggles it on/off. An empty preset selection shows all tasks.

**Range mode** — Use the "From" and "To" date inputs to filter by a custom date range (ISO format `YYYY-MM-DD`). Entering a date automatically switches to range mode and clears all preset selections. Only one range can be active at a time.

#### Tag filter details

When tasks in the vault have tags, a tag filter section appears with:
- **Tag buttons** — one button per unique tag found in tasks. Click to toggle a tag filter (OR logic across selected tags).
- **Include untagged checkbox** — when checked, includes tasks with no tags in the results.

### By-project mode (`mode: by-project`)

Groups tasks by project. Only shows projects matching the selected statuses (default: New, Active, On Hold).

Filters: status checkboxes, project name text filter, show completed toggle.

### Task checkbox interaction

Clicking a checkbox:
1. Reads the source markdown file
2. Toggles `[ ]` ↔ `[x]`
3. Adds/removes the `✅ YYYY-MM-DD` completion date
4. Writes the modified file back

### Filter state

Filter state is persisted to the note's frontmatter under the `pm-tasks-filters` key and restored on page reload. Defaults can be set in the code block YAML (see options above).

**Note on backward compatibility:** The old `dueDateFilter: "Today"` string format is still supported for existing notes and will be automatically migrated to the new structured format.

---

## `pm-recurring-events`

Renders a chronological tile grid of all event instances for a recurring meeting. Place this code block in a recurring meeting note — the parent meeting name is auto-detected from the file's basename.

```yaml
```pm-recurring-events
```
```

### Tile contents

Each tile shows:
- **Date header** — links to the event note (datetime truncated to `YYYY-MM-DDTHH:mm`)
- **Attendees** — comma-separated list of attendee names (only shown when present)
- **Notes** — rendered markdown content from the `# Notes` section of the event file

Notes support full markdown: `**bold**`, `*italic*`, `- lists`, `[[wikilinks]]`, etc.

### Behaviour

- Events are sorted newest-first by their `date` frontmatter field.
- The component auto-refreshes (1 second debounce) whenever any vault file is modified, allowing Dataview to re-index before re-querying.
