# PRD-002: Entity Commands

## 1. Overview

The plugin registers 16 commands under the `PM:` prefix in the Obsidian command palette. Twelve commands create new entity files, two convert an existing entity to another type, one scaffolds the vault folder structure, and one tags a selected line as a RAID reference. Each creation command opens a modal to collect the required fields, then delegates to `EntityCreationService` to create the file and navigate to it.

---

## 2. User Stories

- As a user, I want to create any entity type from the command palette without leaving my current note.
- As a user, I want entity creation modals to offer autocomplete for linked entities (e.g. selecting a client when creating an engagement) so I don't have to type names manually.
- As a user, I want action buttons in notes to pre-populate the creation modal with the current note's context (e.g. clicking "New Project Note" in a project note pre-selects that project).
- As a user, I want to promote an inbox note to a project without losing the original note's engagement context.
- As a user, I want my vault folders created automatically on first use so I don't have to manage folder structure manually.

---

## 3. Functional Requirements

### 3.1 Command List

| Command | Type | Description |
|---------|------|-------------|
| `PM: Create Client` | Create | Create a new client note |
| `PM: Create Engagement` | Create | Create a new engagement note |
| `PM: Create Project` | Create | Create a new project note |
| `PM: Create Person` | Create | Create a new person note |
| `PM: Create Inbox Note` | Create | Create a new inbox note |
| `PM: Create Single Meeting` | Create | Create a single meeting note |
| `PM: Create Recurring Meeting` | Create | Create a recurring meeting definition |
| `PM: Create Recurring Meeting Event` | Create | Create an event note for a recurring meeting |
| `PM: Create Project Note` | Create | Create a note linked to a project |
| `PM: Create Reference Topic` | Create | Create a new reference topic note |
| `PM: Create Reference` | Create | Create a new reference note linked to one or more topics |
| `PM: Create RAID Item` | Create | Create a new RAID log entry (Risk, Assumption, Issue, or Decision) |
| `PM: Convert Inbox to Project` | Convert | Promote an inbox note to a full project |
| `PM: Convert Single Meeting to Recurring` | Convert | Promote a single meeting to a recurring series |
| `PM: Set Up Vault Structure` | Scaffold | Create required folders and default view files |
| `PM: Tag Line as RAID Reference` | Tag | Tag the current editor line as a RAID reference (editor command) |

### 3.2 Modal Behaviour

- Each create command opens a modal that collects the fields required to create the entity.
- Modals for entities that reference parent entities (engagement, project, client) include an autocomplete suggester field.
- Autocomplete suggesters filter by case-insensitive substring match as the user types.
- Engagement and person options are displayed as `"Name (Client)"` when the entity has a client link.
- Only the plain entity name is stored as a wikilink (e.g. `[[Eng1]]`), not the enriched display text.
- Pressing `Enter` in an autocomplete field selects the highlighted option.
- Pressing `Escape` closes the suggestion list without selecting.

### 3.3 ActionContextManager (Pre-selected Context)

- When a `pm-actions` button carries a `context` field (see PRD-004), `ActionContextManager.set()` is called before the command is invoked.
- The subsequent command's modal calls `ActionContextManager.consume()` (read-and-clear) to retrieve the pre-selected value and skip the corresponding selection step.
- `consume()` clears the context after reading, ensuring it is used exactly once.
- Example: clicking "New Project Note" in a project note pre-populates the project field in the modal.

### 3.4 File Creation Flow

For all create commands, `EntityCreationService`:

1. Reads the template for the entity type from `TemplateService`.
2. Processes `{{variable}}` placeholders in the template.
3. Resolves any path conflicts (e.g. duplicate file names).
4. Creates any required parent folders.
5. Creates the file via the Obsidian Vault API.
6. Sets wikilink frontmatter fields via `processFrontMatter` after creation.
7. Delegates navigation to `NavigationService`.

### 3.5 Navigation After Creation

- After a file is created, `NavigationService` opens it in the current leaf via `workspace.getLeaf().openFile(file)`.
- The user lands directly on the new entity note.

### 3.6 Convert: Inbox to Project

`PM: Convert Inbox to Project` via `EntityConversionService.convertInboxToProject()`:

1. Presents a modal to select the inbox note to convert.
2. Creates a new project note with the same name and the inbox note's `engagement` value.
3. Sets `convertedFrom` on the new project to `[[inbox/<InboxName>]]`.
4. Sets `status: Complete` and `convertedTo: [[projects/<ProjectName>]]` on the inbox note.

### 3.7 Convert: Single Meeting to Recurring

`PM: Convert Single Meeting to Recurring` via `EntityConversionService.convertSingleToRecurring()`:

1. Presents a modal to select the single meeting note.
2. Creates a recurring meeting note inheriting the engagement and other relevant fields.

### 3.8 Scaffold Vault

`PM: Set Up Vault Structure` via `VaultScaffoldService`:

1. Creates all required entity folders (configurable paths from Settings).
2. Creates default view `.md` files embedding `pm-actions` buttons for entity creation.
3. Creates `.base` files (Obsidian Bases) alongside view files.
4. Safe to run on an existing vault — does not overwrite existing files.

### 3.9 Create Reference Topic

`PM: Create Reference Topic`:

1. Opens an `InputModal` prompting for the topic name.
2. Creates `reference/reference-topics/<Name>.md` from the Reference Topic template.
   - Template includes a `pm-actions` block with a `create-reference` action (context: `topic`) and a `pm-references` block pre-filtered to that topic.
3. Opens the new topic note on creation.

**ActionContextManager pre-fill:** No pre-fill on this command — a topic has no parent entity.

### 3.10 Create Reference

`PM: Create Reference`:

1. Opens an `EntityCreationModal` variant collecting:
   - **Name** — text input (required)
   - **Topics** — `list-suggester` over all `#reference-topic` files; at least one topic required before confirming; topics stored as `[[Topic Name]]` wikilinks
   - **Client** (optional) — `suggester` over active `#client` files; includes a `(None)` option
   - **Engagement** (optional) — `suggester` over active `#engagement` files, displayed as `"Eng (Client)"`; includes a `(None)` option
2. Creates `reference/references/<Name>.md` from the Reference template.
3. Writes `topics`, `client`, `engagement` via `processFrontMatter` after file creation.
4. Opens the new reference note on creation.

**ActionContextManager pre-fill:** When triggered from a `pm-actions` button with a `context` field:
- From a Reference Topic page (`field: topic`) — pre-populates the topics list with that topic name (wrapped as `[[topicName]]`)
- From a Client page (`field: client`) — pre-populates the client field
- From an Engagement page (`field: engagement`) — pre-populates the engagement field

---

## 4. Data Requirements

- The set of available entity types and their templates is defined in `TemplateService` / `template-constants.ts`.
- Template files are embedded in the plugin — no template files need to exist in the vault.
- Autocomplete suggestions for parent entities are sourced from `QueryService.getActiveEntitiesByTag(tag)` (status: Active entities only, unless otherwise specified).

---

## 5. UI/UX Requirements

- Commands appear in the Obsidian command palette under the `PM:` prefix.
- Modals must be keyboard-navigable (arrow keys, Enter, Escape).
- After creation, the new note is immediately visible and active in the editor.
- The scaffold command provides visual feedback (Notice) on completion.

---

## 6. Dependencies & Cross-References

- **PRD-001** — Entity schemas that commands must populate.
- **PRD-003** — `pm-properties` renders the fields that commands create.
- **PRD-004** — `pm-actions` buttons trigger these commands, optionally with a pre-selected context.
- **PRD-007** — Folder paths used by creation and scaffold commands come from Settings.

---

## 7. Acceptance Criteria

- [ ] All 16 commands are registered and appear in the command palette with the `PM:` prefix.
- [ ] Each create command opens a modal and creates the file in the correct configured folder.
- [ ] Wikilink fields are set via `processFrontMatter` after file creation, not via template string substitution.
- [ ] The created file is opened immediately after creation.
- [ ] Autocomplete suggesters in modals filter by case-insensitive substring and display enriched `"Name (Client)"` labels for engagements and people.
- [ ] `ActionContextManager.consume()` pre-populates the modal field when a context is set by a `pm-actions` button.
- [ ] Convert Inbox to Project sets `status: Complete` and `convertedTo` on the inbox note, and `convertedFrom` on the new project.
- [ ] Scaffold vault creates folders and view files without overwriting existing content.
- [ ] `PM: Create Reference Topic` creates a note with `pm-actions` and `pm-references` blocks and opens it immediately.
- [ ] `PM: Create Reference` requires at least one topic before confirming; writes `topics`, `client`, `engagement` via `processFrontMatter`.
- [ ] `ActionContextManager` pre-fill works for `create-reference` from Reference Topic, Client, and Engagement pages.

---

## 8. Out of Scope

- Bulk creation of multiple entities in one command.
- Editing or deleting entity files via commands (deletion is handled by Obsidian natively).
- Custom command registration by users beyond `commandId` in `pm-actions`.
