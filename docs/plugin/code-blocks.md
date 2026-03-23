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
| `convert-single-to-recurring` | PM: Convert Single Meeting to Recurring |
| `create-recurring-meeting-event` | PM: Create Recurring Meeting Event |
| `create-raid-item` | Open RAID item creation flow (name → type → engagement → owner) |
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
sortBy:                          # array of sort keys (empty = no sort)
  - field: dueDate               # dueDate | priority | alphabetical | context | createdDate
    direction: asc               # asc | desc
showCompleted: false
# Due date filter
dueDateFilter:
  selectedPresets: [Today]       # any of: Today, Tomorrow, This Week, Next Week, Overdue, No Date
  rangeFrom: "2026-03-15"        # ISO date (custom range; clears selectedPresets when used)
  rangeTo: "2026-04-15"
# Tag filter
tagFilter: [tag1, tag2]
includeUntagged: false
```
```

### Dashboard mode (`mode: dashboard`)

Displays all vault tasks (excluding the `utility/` folder) with a compact **toolbar + filter drawer** layout:

- **Toolbar**: View mode tabs (Context / Date / Priority / Tag), search input, ⚙ Filters button (with active-count badge), ✕ Clear All Filters button (shown when any filter is active)
- **Active filter chips bar**: removable chips for each active filter criterion
- **Filter drawer** (toggled by ⚙ Filters): contains all filter sections:
  - **Sort Order**: multi-key sort builder (up to 3 keys); fields: Due Date, Priority, Alphabetical, Context, Created Date; per-key direction toggle (↑/↓); up/down reorder
  - **Completed Tasks**: toggle "Show completed"
  - **Due Date**: preset pills (Today, Tomorrow, This Week, Next Week, Overdue, No Date) with OR logic (multiple can be active simultaneously) + custom date range
  - **Priority**: Urgent / High / Medium / Low
  - **Context Type**: Project, Meeting, Recurring Meeting, Inbox, Daily Notes, Person, Other
  - **Client / Engagement**: type-ahead chip selects with "Include unassigned" toggle
  - **Context-Specific** (Context view only): Project Status, Inbox Status, Meeting Date
  - **Tags**: type-ahead chip select + "Include untagged" toggle

Context view groups tasks hierarchically:

- **Project**: Parent Project (H3) → Project Note (H4) → Tasks. Tasks from project notes are nested under their parent project via the `relatedProject` frontmatter field. Direct project tasks render under the H3 before any H4s.
- **Recurring Meeting**: Parent Recurring Meeting (H3) → Event File (H4) → Tasks. Tasks from recurring meeting event files are nested under their parent recurring meeting via the `recurring-meeting` frontmatter field. Event files without this frontmatter link render flat (H3 → Tasks).
- **All other contexts**: File (H3) → Tasks.

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

## `pm-references`

Renders the references dashboard with interactive filtering and multiple view modes. Place this code block in any note to display a filterable, searchable view of all reference documents in the vault.

```yaml
```pm-references
mode: dashboard
# Optional defaults:
viewMode: topic | client | engagement
filter:
  topics:
    - "[[Topic Name]]"    # pre-select topic filter chips
  client: "Client Name"
  engagement: "Engagement Name"
```
```

### Config options

| Option | Values | Description |
|--------|--------|-------------|
| `mode` | `dashboard` | Display mode (currently only `dashboard` is supported) |
| `viewMode` | `topic` \| `client` \| `engagement` | Default grouping for the output. Defaults to `topic`. |
| `filter.topics` | `string[]` | Array of wikilinks to pre-select as active topic filters on load. |
| `filter.client` | `string` | Client name to pre-select as an active client filter on load. |
| `filter.engagement` | `string` | Engagement name to pre-select as an active engagement filter on load. |

### View modes

- **By Topic** (`viewMode: topic`) — groups references under each of their linked Reference Topics. References with no topics appear under an "Uncategorised" heading.
- **By Client** (`viewMode: client`) — groups references by client (resolved via direct `client` frontmatter or via `engagement → engagement.client`). References with no resolvable client appear under "No Client".
- **By Engagement** (`viewMode: engagement`) — groups references by their linked engagement.

### Filtering

- **View mode tabs** — switch between Topic / Client / Engagement grouping.
- **Filters panel** (toggled by the "Filters" button) — contains chip selectors for Topics, Clients, and Engagements. Multiple chips can be active simultaneously; OR logic is applied within each dimension, AND logic across dimensions.
- **Search input** — filters references by file name with a debounced text search (300 ms). Text search is applied after structural filters.
- **Clear filters** button — resets all active chips and search text.

### Filter state

Filter state (active chips, search text, view mode) is persisted to the note's frontmatter under the `pm-references-filters` key and restored on page reload.

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

---

## `pm-raid-references`

Renders the list of notes that reference the current RAID item, grouped by source file. Place this code block in a RAID item note — the item name is auto-detected from the file's basename.

References are annotated in other notes using the syntax `{raid:positive|negative|neutral}[[RAID Item Name]]`. The direction badge and label are derived from the RAID item's `raid-type` frontmatter field.

Requires the Dataview plugin to be installed and enabled.

**Configuration (all fields optional):**

````pm-raid-references
sort:
  field: modified-date   # modified-date (default) | created-date
  direction: desc        # desc (default) | asc
````

### Behaviour

- Backlinks are resolved via Dataview; for each linking file the raw content is scanned for annotated references.
- Each source file is rendered as an `<h4>` heading with an internal link, followed by a list of annotated reference entries.
- Each entry shows a direction badge (`positive` / `negative` / `neutral`) with a human-readable label derived from the RAID type, the stripped line text, and a link back to the source file.
- When no annotated references are found, a placeholder message is displayed.
- The component auto-refreshes (500 ms debounce) when any vault file is modified.
- Source groups are sorted by modification date descending by default. Use the `sort` property to change the sort field (`modified-date` | `created-date`) or direction (`asc` | `desc`). Omitting `sort` preserves the default behaviour.

---

## `pm-raid-dashboard`

Renders an interactive RAID dashboard with a likelihood × impact risk matrix, count strip, and item tables grouped by RAID type. Place this code block in any note (e.g. an engagement or project dashboard note).

```yaml
```pm-raid-dashboard
# All fields are optional
raidTypes:
  - Risk
  - Assumption
  - Issue
  - Decision
statusFilter:
  - Open
  - In Progress
clientFilter: []
engagementFilter: []
```
```

### Config options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `raidTypes` | `string[]` | All four types | RAID types shown in the dashboard on initial load. |
| `statusFilter` | `string[]` | `["Open", "In Progress"]` | Statuses shown on initial load. |
| `clientFilter` | `string[]` | `[]` | Client names to pre-filter by on initial load. |
| `engagementFilter` | `string[]` | `[]` | Engagement names to pre-filter by on initial load. |

### Filter panel

The dashboard renders an interactive filter panel at the top:

- **Type chips** — toggle individual RAID types (R / A / I / D) on/off.
- **Status chips** — toggle statuses (`Open`, `In Progress`, `Resolved`, `Closed`) on/off.
- **Search input** — live text filter on item names (debounced).

### Risk matrix

A likelihood × impact grid (High / Medium / Low × Low / Medium / High) shows a count of filtered items per cell. Clicking a cell applies a matrix-cell filter; clicking it again clears it. Cells are colour-coded by risk severity.

### Item groups

Below the matrix, items are grouped by RAID type and rendered as tables with columns: Title, Status, L×I, Age (days since `raised-date`), and Owner (initials avatar).

### Behaviour

- Queries all vault RAID items tagged `#raid` via `QueryService.getActiveRaidItems()`.
- Filter state (type, status, matrix cell, search) is ephemeral and resets on page reload; use the YAML config to set persistent defaults.
- The component auto-refreshes (500 ms debounce) when any vault file is modified, allowing Dataview to re-index before re-querying.
