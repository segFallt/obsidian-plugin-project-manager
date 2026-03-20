# PRD-006: Recurring Meeting Events (`pm-recurring-events`)

## 1. Overview

The `pm-recurring-events` code block renders a chronological tile grid of all event instances for a recurring meeting. It is placed in a recurring meeting note. The parent meeting is auto-detected from the file's basename. Each tile shows the event date (as a link), attendees, and rendered markdown notes. Events are sorted newest-first and the component auto-refreshes when any vault file is modified.

---

## 2. User Stories

- As a user, I want to see all past and upcoming events for a recurring meeting in one place, without manually maintaining a list.
- As a user, I want to see the notes from each meeting event rendered inline so I can review what was discussed without opening each event file.
- As a user, I want events sorted newest-first so the most recent meeting is at the top.
- As a user, I want the view to update automatically when I save a meeting event note, so I don't have to reload the page.

---

## 3. Functional Requirements

### 3.1 Code Block Syntax

```
```pm-recurring-events
```
```

No configuration parameters — the code block is self-configuring.

### 3.2 Parent Meeting Auto-Detection

- The parent recurring meeting is determined from the **basename** of the current file (the file containing the `pm-recurring-events` code block).
- The processor queries for all recurring meeting event files whose `recurringMeeting` frontmatter field links to this file.

### 3.3 Event Discovery

- All vault files in the configured recurring meeting events folder are queried.
- Only events whose parent meeting matches the current file are included.

### 3.4 Tile Grid Layout

- Events are displayed as a grid of tiles, arranged chronologically (newest-first by the event's `date` frontmatter field).
- Each tile is a self-contained card.

### 3.5 Tile Contents

Each tile displays:

1. **Date header** — a link to the event note. The datetime is truncated to `YYYY-MM-DDTHH:mm` for display (seconds are not shown).
2. **Attendees** — comma-separated list of attendee names. Only shown when at least one attendee is present.
3. **Notes** — the rendered markdown content from the `# Notes` section of the event file.

Notes support full markdown: bold (`**text**`), italic (`*text*`), lists (`- item`), wikilinks (`[[Note]]`), and other standard Obsidian markdown.

### 3.6 Sort Order

Events are sorted **newest-first** by their `date` frontmatter field (ISO 8601 datetime).

### 3.7 Auto-Refresh

- The component subscribes to vault `modify` events (any file in the vault).
- On any modification, it waits **1 second** (debounce) before re-querying and re-rendering.
- The 1-second delay allows Dataview to re-index the modified file before the query runs.

---

## 4. Data Requirements

- Event data is queried via `QueryService` (Dataview API).
- The `date` field on recurring meeting event files must be in ISO 8601 datetime format (`YYYY-MM-DDTHH:mm:ss`).
- The `attendees` field is a YAML list of wikilinks (`[[Person Name]]`); display strips the wikilink syntax for rendering.
- The `# Notes` section is parsed from the event file's markdown body.
- If Dataview is unavailable, the component displays a "Dataview is not available" message.

---

## 5. UI/UX Requirements

- Tiles should be visually card-like, clearly separated from each other.
- The date header link should be styled as an internal Obsidian link.
- The attendee list should be rendered on a separate line from the date header.
- Markdown in the Notes section must be rendered (not shown as raw markdown syntax).
- The grid should adapt to available width (responsive layout).

---

## 6. Dependencies & Cross-References

- **PRD-001** — Recurring Meeting Event entity schema (`date`, `attendees`, `recurring-meeting` fields).
- **PRD-002** — `PM: Create Recurring Meeting Event` command creates the event files rendered here.
- **PRD-005** — Task dashboard traverses the `recurring-meeting` frontmatter field to include event tasks in client and engagement filter results.
- **PRD-007** — Dataview graceful degradation; recurring meeting events folder path from Settings.

---

## 7. Acceptance Criteria

- [ ] Placing `pm-recurring-events` in a recurring meeting note renders tiles for all associated event files.
- [ ] The parent meeting is auto-detected from the file basename; no configuration parameter is required.
- [ ] Tiles are sorted newest-first by the `date` frontmatter field.
- [ ] Each tile shows: date header (as a link to the event note), attendees (when present), rendered `# Notes` content.
- [ ] The datetime in the tile header is truncated to `YYYY-MM-DDTHH:mm` (no seconds).
- [ ] Attendees are omitted from the tile when the `attendees` list is empty.
- [ ] Markdown in the Notes section is rendered (bold, italic, lists, wikilinks, etc.).
- [ ] The component re-renders within 1 second of any vault file being modified.
- [ ] If Dataview is unavailable, a "Dataview is not available" message is shown instead of the grid.
- [ ] Tasks in recurring meeting event files are visible in the `pm-tasks` dashboard and correctly matched when filtering by the parent recurring meeting's client or engagement.
- [ ] Tasks in recurring meeting event files appear under a "Recurring Meeting" header in the `pm-tasks` context view, separate from single-meeting tasks (which appear under "Meeting").

---

## 8. Out of Scope

- Filtering or searching within event tiles.
- Editing event data inline from the tile grid (editing is done by opening the event note).
- Pagination of event tiles.
- Custom sort orders other than newest-first.
