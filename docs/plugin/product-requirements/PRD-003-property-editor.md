# PRD-003: Property Editor (`pm-properties`)

## 1. Overview

The `pm-properties` code block renders an interactive frontmatter editor for the current note. It supports all 11 entity types, provides inline autocomplete suggesters for linked-entity fields, and persists changes immediately via `processFrontMatter`. The component auto-refreshes when the file is modified externally and suppresses re-renders triggered by its own writes.

---

## 2. User Stories

- As a user, I want to edit entity properties (status, dates, linked entities) from within the note itself, without opening a separate modal.
- As a user, I want autocomplete suggestions when selecting a client or engagement so I don't have to remember exact names.
- As a user, I want to see enriched display names (e.g. `"Eng1 (Acme Corp)"`) in suggesters so I can distinguish entities with similar names.
- As a user, I want to add multiple attendees to a meeting via a chip-based list so I can manage the attendee list without leaving the note.
- As a user, I want my changes to persist immediately without a separate save step.

---

## 3. Functional Requirements

### 3.1 Code Block Syntax

```
```pm-properties
entity: <entity-type>
```
```

### 3.2 Supported Entity Types and Fields

| Entity type | Fields rendered |
|-------------|----------------|
| `client` | Status, Contact Name, Contact Email, Contact Phone, Notes (textarea) |
| `engagement` | Client (suggester), Status, Start Date, End Date, Description (textarea) |
| `project` | Engagement (suggester), Start Date, End Date, Priority (1–5), Status |
| `person` | Client (suggester), Status, Title, Reports To (suggester), Notes (textarea) |
| `inbox` | Engagement (suggester), Status |
| `single-meeting` | Engagement (suggester), Date (datetime picker), Attendees (list suggester) |
| `recurring-meeting` | Engagement (suggester), Start Date, End Date, Default Attendees (list suggester) |
| `recurring-meeting-event` | Recurring Meeting (suggester), Date (datetime picker), Attendees (list suggester) |
| `project-note` | Related Project (text), Engagement (suggester) |
| `reference` | Topics (list-suggester), Client (suggester), Engagement (suggester) |
| `reference-topic` | *(no fields — topic pages have no editable frontmatter)* |

### 3.3 Autocomplete Suggester (`suggester`)

Applies to single-value linked-entity fields. Behaviour:

- **Type to filter** — options are filtered by case-insensitive substring match as the user types.
- **Keyboard navigation** — `ArrowDown` / `ArrowUp` to move through options, `Enter` to select, `Escape` to cancel.
- **Enriched display** — engagement and person options are shown as `"Name (Client)"` when the entity has a client link.
- **Frontmatter storage** — only the plain entity name is stored as a wikilink (e.g. `[[Eng1]]`); the enriched display text is never persisted.
- **Click to open** — clicking the input opens the suggestion list even when the input already has focus.
- **Clear option** — includes a `(None)` option to clear the field value.

Suggester data sources:

| Field | Data source |
|-------|------------|
| Client | Active clients (`#client`, status: Active) |
| Engagement | Active engagements (`#engagement`, status: Active), shown as `"Eng (Client)"` |
| Reports To | Active people (`#person`, status: Active), shown as `"Person (Client)"` |
| Recurring Meeting | Active recurring meetings (folder-based query) |
| Topics (reference) | All `#reference-topic` files (status: Active) |

### 3.3.1 `reference` Field Descriptor

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| Topics | `list-suggester` | All `#reference-topic` files (status: Active) | Required; stored as wikilink array (e.g. `["[[Architecture]]"]`) |
| Client | `suggester` | Active `#client` files | Optional; includes `(None)` to clear |
| Engagement | `suggester` | Active `#engagement` files, shown as `"Eng (Client)"` | Optional; includes `(None)` to clear; `enriched: true` |

### 3.3.2 `reference-topic` Field Descriptor

`reference-topic` has an empty field descriptor (`[]`) — no `pm-properties` block is included in Reference Topic notes. The entry exists in `entity-field-config.ts` to satisfy `Record<EntityType, FieldDescriptor[]>` exhaustiveness checks.

### 3.4 List Autocomplete Suggester (`list-suggester`)

Applies to multi-value linked-entity fields (`attendees`, `default-attendees`). Behaviour:

- All single-value suggester behaviours apply (type-to-filter, keyboard nav, enriched display, wikilink storage).
- **Chip UI** — selected items appear as removable chips above the input.
- **Remove chip** — clicking `×` on a chip removes that item.
- **Deduplication** — adding a duplicate item is silently ignored.
- **Auto-reopen** — the suggestion list automatically reopens after each selection so multiple items can be added in sequence.

### 3.5 Immediate Persistence

- All field changes are persisted immediately via `processFrontMatter` without a separate save button.
- There is no unsaved-changes state.

### 3.6 Auto-Refresh

- The component subscribes to vault `modify` events.
- On modification of the current file, it re-renders after a **500 ms debounce**.
- This keeps displayed values in sync when another process edits the file externally.

### 3.7 Self-Write Suppression

- An `isUpdating` flag is set to `true` before writing via `processFrontMatter`.
- The vault `modify` event triggered by the component's own write is detected and ignored.
- The flag is cleared after the write completes.
- This prevents an infinite re-render loop.

---

## 4. Data Requirements

- Field type configuration (which fields belong to which entity, and what input type they use) is defined in `src/processors/entity-field-config.ts`.
- Frontmatter is read from `metadataCache` at render time and written via `processFrontMatter` on change.
- Suggestion lists are sourced from `QueryService` (wraps Dataview API).

---

## 5. UI/UX Requirements

- Each field renders as its appropriate input type: text, dropdown, textarea, date picker, datetime picker, suggester combobox, or list-suggester combobox.
- Chips for list suggesters appear above the input in the order they were added.
- The `×` button on a chip must be clearly distinguishable and keyboard-accessible.
- Suggester dropdown must appear overlaid on the note content, not push layout.
- Error states (e.g. Dataview unavailable) must display a clear message rather than a blank or broken UI.

---

## 6. Dependencies & Cross-References

- **PRD-001** — Frontmatter schemas that `pm-properties` reads and writes.
- **PRD-002** — Commands populate these fields at creation; `pm-properties` allows post-creation editing.
- **PRD-007** — Dataview graceful degradation: if Dataview is unavailable, suggesters cannot query entities.

---

## 7. Acceptance Criteria

- [ ] `pm-properties` renders the correct fields for all 11 entity types.
- [ ] `reference` entity renders Topics (list-suggester), Client (suggester), and Engagement (suggester) fields.
- [ ] `reference-topic` entity renders no fields (empty descriptor; no `pm-properties` block in template).
- [ ] Changing a field value via the editor persists the change to frontmatter immediately.
- [ ] Autocomplete suggesters filter options by case-insensitive substring as the user types.
- [ ] Engagement and person suggesters show `"Name (Client)"` when a client link is present.
- [ ] Only the plain entity name (as a wikilink) is stored in frontmatter, not the enriched display text.
- [ ] List suggesters display selected items as removable chips; duplicates are silently ignored.
- [ ] The suggestion list reopens automatically after each chip selection.
- [ ] The component re-renders within 500 ms of an external modification to the current file.
- [ ] The component does not re-render infinitely when it writes to frontmatter itself (`isUpdating` suppression works).
- [ ] Selecting `(None)` in a single suggester clears the field value.

---

## 8. Out of Scope

- Editing arbitrary frontmatter keys not defined in `entity-field-config.ts`.
- Bulk editing across multiple files.
- Undo/redo of property changes.
- Inline validation or required-field enforcement.
