# PRD-004: Relationship Views & Actions (`pm-table`, `pm-actions`, `pm-entity-view`)

## 1. Overview

Three code block processors render relationship data and action buttons in entity notes. `pm-table` renders a typed relationship table queried from Dataview. `pm-actions` renders configurable action buttons that invoke plugin commands, optionally pre-seeding entity context. `pm-entity-view` composes headings, actions, and tables into a structured entity view using the entity view registry.

---

## 2. User Stories

- As a user, I want to see all engagements associated with a client directly in the client note.
- As a user, I want to see all project notes linked to a project in the project note.
- As a user, I want to create related records (e.g. a new engagement for a client) from within the entity note, with the parent entity pre-selected.
- As a user, I want entity notes to have consistent, structured sections (relationships + actions) without manually composing code blocks.

---

## 3. Functional Requirements

### 3.1 `pm-table` — Relationship Tables

**Syntax:**
```
```pm-table
type: <table-type>
```
```

**Table types:**

| `type` value | Shows | Used in |
|---|---|---|
| `client-engagements` | Engagements where `client` = current file | Client notes |
| `client-people` | People where `client` = current file | Client notes |
| `engagement-projects` | Projects where `engagement` = current file | Engagement notes |
| `related-project-notes` | Notes with `relatedProject` = current file, plus all backlinks | Project notes |
| `mentions` | All vault files that backlink to the current file | Person notes |

- Tables render as HTML `<table>` elements with Obsidian-style internal links.
- Data is sourced from `QueryService.getLinkedEntities()` and related methods (wrapping Dataview API).
- If Dataview is unavailable, the table displays a "Dataview is not available" message.

### 3.2 `pm-actions` — Action Buttons

**Syntax:**
```
```pm-actions
actions:
  - type: <action-type>
    label: <button text>
    style: primary | default | destructive
```
```

**Built-in action types (10):**

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

**Custom command support:** Any action can use `commandId: <full-obsidian-command-id>` instead of `type` to invoke an arbitrary registered command.

**Button styles:**
- `primary` — highlighted call-to-action appearance
- `default` — standard button appearance
- `destructive` — visually signals a destructive operation

**Action context (pre-selection):**

An action can include a `context` field specifying a frontmatter property of the current note:
```yaml
- type: create-engagement
  label: New Engagement
  style: primary
  context:
    field: client
```
When the button is clicked, `ActionContextManager.set()` is called with the value of that frontmatter field from the current note. The invoked command's modal then calls `ActionContextManager.consume()` to read and clear the pre-selected value, skipping the corresponding selection step.

**Default templates:** The following entity templates include a default `pm-actions` block:

| Template | Default button |
|----------|----------------|
| Client | New Client (`create-client`) |
| Engagement | New Engagement (`create-engagement`) |
| Project | New Project Note (`create-project-note`), New Project (`create-project`) |
| Person | New Person (`create-person`) |

### 3.3 `pm-entity-view` — Structured Entity View

`pm-entity-view` renders a complete structured view for an entity, composing headings, action buttons, and relationship tables from the **entity view registry** (`entity-view-registry.ts`).

**Registry contents (`ENTITY_VIEW_SECTIONS`):**

| Entity type | Section name | Heading | Action buttons | Tables |
|-------------|-------------|---------|---------------|--------|
| `project` | `linked` | "Linked" | New Project Note (`create-project-note`, context: `relatedProject`) | `related-project-notes` |
| `client` | `engagements` | "Engagements" | New Engagement (`create-engagement`, context: `client`) | `client-engagements` |
| `client` | `people` | "People" | New Person (`create-person`, context: `client`) | `client-people` |
| `engagement` | `projects` | "Projects" | New Project (`create-project`, context: `engagement`) | `engagement-projects` |
| `person` | `mentions` | "Mentions" | *(none)* | `mentions` |

Each section renders in order: heading → action buttons → table.

---

## 4. Data Requirements

- `pm-table` queries are powered by `QueryService` methods (`getLinkedEntities`, `getProjectNotes`, backlinks resolution).
- `pm-actions` maps `type` strings to plugin command IDs at render time; no data queries required.
- `pm-entity-view` reads the current note's frontmatter to resolve context values for pre-seeded actions.

---

## 5. UI/UX Requirements

- Tables must render within the note body with appropriate column widths and clickable wikilinks.
- Action buttons must be horizontally arranged and visually distinct by style.
- `pm-entity-view` sections must stack vertically: heading → buttons → table.
- All three processors must display a clear error message (not a blank block) when an error occurs during rendering.

---

## 6. Dependencies & Cross-References

- **PRD-001** — Relationship fields (`client`, `engagement`, `relatedProject`) queried by `pm-table`.
- **PRD-002** — Commands invoked by `pm-actions` buttons; `ActionContextManager` consume pattern.
- **PRD-007** — Dataview graceful degradation for table rendering.

---

## 7. Acceptance Criteria

- [ ] Each `pm-table` type renders the correct set of related entities for the current file.
- [ ] `pm-table` displays a "Dataview is not available" message when Dataview is not loaded.
- [ ] `pm-actions` renders buttons with the correct labels and visual styles.
- [ ] Clicking a `pm-actions` button invokes the corresponding plugin command.
- [ ] When a `context` field is specified, `ActionContextManager.set()` is called with the correct value before command invocation.
- [ ] The invoked command's modal reads and clears the context via `ActionContextManager.consume()`.
- [ ] `commandId` actions invoke the specified arbitrary command.
- [ ] `pm-entity-view` renders all sections defined in the registry for the entity type of the current note.
- [ ] Each section renders heading → buttons → table in the correct order.

---

## 8. Out of Scope

- Sorting or filtering within `pm-table` results.
- Pagination of relationship tables.
- Custom table types beyond the 5 defined.
- User-defined registry sections (all sections are defined in code, not YAML).
