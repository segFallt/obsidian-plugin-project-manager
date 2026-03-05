# Code Block Reference

## `pm-properties`

Renders an interactive frontmatter editor for the current note. Changes are persisted immediately via `processFrontMatter`. The component auto-refreshes (500ms debounce) when the current file is modified externally, so the displayed values stay in sync. Re-renders triggered by the component's own writes are suppressed to prevent infinite loops.

### Autocomplete suggesters

`suggester` and `list-suggester` fields use an **inline autocomplete** combobox instead of a plain dropdown:

- **Type to filter** — options are filtered by case-insensitive substring match as you type.
- **Keyboard navigation** — `ArrowDown`/`ArrowUp` to move, `Enter` to select, `Escape` to cancel.
- **Enriched entity display** — engagement and person options are shown as `"Name (Client)"` when the entity has a client link, making it easy to distinguish entities with similar names.
- **Frontmatter storage** — only the plain entity name is stored as a wikilink (e.g. `[[Eng1]]`), not the enriched display text.
- **Single suggester** (`suggester`) — includes a `(None)` option to clear the field.
- **List suggester** (`list-suggester`) — selected items appear as removable chips above the input; clicking `×` removes the item. Duplicates are silently ignored.

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
```
```

### Dashboard mode (`mode: dashboard`)

Displays all vault tasks (excluding the `utility/` folder) with these filter panels:

- **View Mode**: Context, Due Date, Priority, Tag
- **Sort**: None, Due Date ↑/↓, Priority ↑/↓
- **Show Completed**: toggle
- **Search**: text filter
- **Context Filters**: context type, client, engagement, project status, inbox status, meeting date
- **Date Filters**: due date (All / Today / This Week / Overdue / No Date)
- **Priority Filters**: Urgent / High / Medium / Low / Someday

Context view groups tasks hierarchically: Context → File → Task. For the Project context, tasks from project notes are nested under their parent project.

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

All filter state is local to the rendered component — no frontmatter is written on filter change. Defaults can be set in the code block YAML (see options above).
