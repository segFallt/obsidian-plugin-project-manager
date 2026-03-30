# PRD-009: Reference Entity & `pm-references` Dashboard

## 1. Overview

The Reference entity system introduces two new vault entity types — **Reference** and **Reference Topic** — together with a `pm-references` code block processor that renders a filterable, multi-view dashboard. References are knowledge notes (URLs, articles, freeform notes) categorised by one or more Reference Topics and optionally linked to a Client or Engagement. The feature was designed in issue #7 and refined in follow-up issues #25, #30, #34, #35, and #38.

This PRD covers: the Reference and Reference Topic data model (see also PRD-001 §3.1–3.2), the `PM: Create Reference` and `PM: Create Reference Topic` commands (see also PRD-002 §3.9–3.10), the `pm-properties` field configuration (see also PRD-003 §3.3.1–3.3.2), the `pm-actions` action types (see also PRD-004 §3.2), the `pm-references` dashboard processor, and the related settings and scaffold changes (see also PRD-007 §3.1, §3.5, §4.1).

---

## 2. User Stories

- As a consultant, I want to store references (links, articles, runbooks) in my vault and tag them by topic so I can find them by subject area.
- As a user, I want to browse all references by topic, client, or engagement so I can surface relevant materials for a given context.
- As a user, I want to filter references by multiple topics simultaneously and see which items match, so I can narrow a broad topic area to what I need.
- As a user, I want to create a reference from within a Reference Topic note so it is automatically pre-tagged with that topic.
- As a user, I want to search references by title across all topics so I can find a specific item quickly.
- As a user, I want collapsible topic groups so I can focus on one area at a time without scrolling through unrelated items.
- As a user, I want reference cards to show context chips (topic, client, engagement) so I can see at a glance what a reference is associated with.
- As a user, I want my filter selections persisted so the dashboard remembers my state when I navigate away and return.

---

## 3. Functional Requirements

### 3.1 `pm-references` Code Block Syntax

```yaml
```pm-references
viewMode: topic          # topic | client | engagement (default: topic)
```
```

The `pm-references` code block now renders a **compact summary card** showing the reference count and an "Open Dashboard →" button that activates the Reference Dashboard ItemView panel (see §3.10). The full interactive dashboard has moved to the ItemView panel.

All YAML keys remain accepted for forward-compatibility, but the code block no longer renders the full dashboard. The `filter` and `mode` keys are parsed and ignored by the summary card renderer.

### 3.2 Dashboard Controls

Rendered as a compact row above the filter panel:

- **View mode tab strip** — three tabs: `By Topic` / `By Client` / `By Engagement`. Clicking a tab switches the grouping without clearing active filters.
- **Filters toggle button** — labelled `Filters ▾`; expands and collapses the filter panel.
- **Search input** — text field that filters reference cards by title (case-insensitive substring).

### 3.3 Filter Panel

Collapsible panel below the controls row (default: collapsed). Contains three chip rows:

| Row | Chips | Logic |
|-----|-------|-------|
| TOPIC | One chip per Reference Topic file | Multi-select; OR logic across chips |
| CLIENT | One chip per active Client | Multi-select; OR logic across chips |
| ENGAGEMENT | One chip per active Engagement | Multi-select; OR logic across chips |

Cross-dimension logic is AND: a reference must satisfy all provided non-empty filter dimensions simultaneously.

A **Clear Filters** button resets all active chip selections and the search field.

### 3.4 By Topic View (default)

The By Topic view uses a **two-column layout**: a topic-tree sidebar on the left and a reference list on the right.

**Sidebar (topic tree):**
- Renders the full Reference Topic hierarchy as a nested tree using `getReferenceTopicTree()`.
- Root topics are listed alphabetically; children are listed alphabetically under their parent.
- Each tree node is clickable. Clicking a node sets `selectedNode` in filter state and filters the reference list to that topic and all its descendants (via `getTopicDescendants()`).
- The active node is highlighted. Clicking the active node again deselects it (clears `selectedNode`), showing all topics.
- Expand/collapse arrows allow collapsing subtrees without changing the filter selection.

**Reference list (right panel):**
- When a node is selected: references are grouped by the matched topics within the selected node's subtree, sorted alphabetically by topic name.
- When no node is selected: all topics are shown grouped alphabetically (original flat behaviour).
- A reference with multiple topics appears under each of its matched topic groups.
- In secondary topic groups (not the first topic in the reference's `topics[]` array), the card shows an `"also in <Primary Topic>"` hint tag, where Primary Topic is the first entry in `topics[]`.
- Each group header: topic name + count badge (items in group under active filters) + collapse arrow. Groups are individually collapsible.
- If a topic group is empty under active filters, it is hidden.

### 3.5 By Client View

- References grouped by resolved client name, sorted alphabetically.
- Client resolution: `reference.client` directly, OR `reference.engagement → engagement.client` if `reference.client` is absent.
- References with no resolvable client appear in an **Unassigned** group at the bottom.

### 3.6 By Engagement View

- References grouped by engagement name, sorted alphabetically.
- References with no `engagement` field appear in an **Unassigned** group at the bottom.

### 3.7 Reference Card Anatomy

Each reference card contains:

- Document icon (🗒 or equivalent)
- Reference title as a wikilink to the reference note
- `"also in <Topic>"` hint tag (secondary topic groups only; see §3.4)
- Context chips: one chip per topic + one for client (if set) + one for engagement (if set)

### 3.8 Filter State Persistence

Interactive filter state (active chip selections, view mode, selected sidebar node) is persisted after each user interaction. The persistence path depends on the rendering context:

**ItemView panel (§3.10) — persists to plugin settings:**
Filter state is stored in `plugin.settings.ui.referenceDashboardFilters` and written to the plugin data file via `plugin.saveSettings()`. This keeps the filter state global across all notes and vault sessions.

```typescript
// plugin.settings.ui.referenceDashboardFilters shape (SavedReferenceFilters):
{
  viewMode?: "topic" | "client" | "engagement";
  topics?: string[];
  clients?: string[];
  engagements?: string[];
  selectedNode?: string;
}
```

**Legacy code block path (deprecated) — previously persisted to note frontmatter:**
The original implementation persisted to `pm-references-filters` in the host note's frontmatter. This path is no longer used since the code block was simplified to a summary card in issue #75.

### 3.9 (Reserved)

### 3.10 Reference Dashboard ItemView Panel

The Reference Dashboard is hosted in a dedicated Obsidian `ItemView` panel, registered under the view type `pm-reference-dashboard`.

**View type constant:** `PM_REFERENCE_DASHBOARD_VIEW_TYPE = "pm-reference-dashboard"` (exported from `src/constants.ts`)

**Activation command:** `PM: Open Reference Dashboard` (command ID: `project-manager:open-reference-dashboard`). Registered during `onLayoutReady`. If the view is already open in any leaf, the command reveals it instead of creating a duplicate. Otherwise it opens in the right sidebar (`workspace.getRightLeaf(false)`).

**Ribbon icon:** Displayed when `settings.ui.showRibbonIcons` is `true`. Uses the `book-open` icon. Clicking the icon calls the same activation helper as the command.

**Lifecycle:**
- Registered via `this.registerView(...)` inside `onLayoutReady()` in `main.ts`.
- On open (`onOpen()`): adds the `pm-reference-dashboard-view` CSS class to `contentEl`, constructs the `ReferenceDashboardView` component, restores saved filters from `plugin.settings.ui.referenceDashboardFilters`, and registers a vault `modify` event listener for debounced auto-refresh.
- On close (`onClose()`): clears the debounce timer, empties `contentEl`, and nullifies the dashboard view reference.
- On plugin unload: all leaves of type `pm-reference-dashboard` are detached via `workspace.detachLeavesOfType(...)` before logger flush.

**Source:** `src/views/reference-dashboard-item-view.ts`, exported via `src/views/index.ts`.

---

## 4. Data Requirements

### 4.0 Reference Topic Frontmatter

```yaml
tags:
  - "#reference-topic"
status: Active | Inactive
parent: "[[Parent Topic Name]]"   # optional; omit for root topics
```

The `parent` field is a wikilink to another Reference Topic. Root topics omit the field entirely. The field is written via `processFrontMatter` by `PM: Update Reference Topic`.

### 4.1 QueryService Additions

```typescript
getReferencesByTopic(topicName: string): DataviewPage[]
// Returns all #reference pages where topics[] contains [[topicName]].
// topicName is a display name (e.g. "Architecture"); method wraps in wikilink for comparison.

getReferences(filters?: {
  topics?: string[];       // wikilink strings — OR logic within array
  clients?: string[];      // OR logic — matches direct client OR engagement.client
  engagements?: string[];  // OR logic within array
}): DataviewPage[]
// Returns all #reference pages matching optional filter criteria.
// Cross-dimension logic is AND: a reference must satisfy all non-empty filter arrays.
// Client resolution uses dual-path: direct reference.client OR reference.engagement → engagement.client.

getReferenceTopicTree(): TopicNode[]
// Returns all #reference-topic pages assembled into a forest (array of root TopicNode objects).
// Each node's children array contains its direct children, recursively populated.
// Root topics are those with no parent field (or parent field absent/null).

getTopicDescendants(topicName: string): string[]
// Returns a flat array of display names for all descendant topics of the given topic (all depths).
// Does not include the topic itself — returns only descendants. Used to expand a selected node in the sidebar to include all nested topics
// when filtering references.
```

### 4.2 Client Dual-Path Resolution

The client filter resolves the effective client for a reference by checking:
1. `reference.client` directly
2. `reference.engagement → engagement.client` (via Dataview page lookup on the engagement)

Both paths may return Dataview `DataviewLink` objects; consumers must call `String(value)` or extract `.path` for comparison.

### 4.3 Wikilink Format in Filter Arrays

All filter arrays (`topics`, `clients`, `engagements`) in `SavedReferenceFilters` use wikilink strings (e.g. `"[[Architecture]]"`), matching the format stored in Reference frontmatter. Comparisons must use the wikilink string form, not bare names.

### 4.4 Types

```typescript
interface TopicNode {
  name: string;           // display name of the Reference Topic
  path: string;           // vault file path
  children: TopicNode[];  // direct children, recursively populated
}
```

```typescript
type ReferenceViewMode = "topic" | "client" | "engagement";

interface PmReferencesConfig {
  mode?: "dashboard";
  viewMode?: ReferenceViewMode;
  filter?: {
    topics?: string[];   // wikilink strings — seeds initial chip selection
    client?: string;     // wikilink string — seeds initial selection
    engagement?: string; // wikilink string — seeds initial selection
  };
}

interface ReferenceFilters {
  viewMode: ReferenceViewMode;
  topicFilter: string[];
  clientFilter: string[];
  engagementFilter: string[];
  searchText: string;
  selectedNode?: string;  // display name of the selected topic tree node; undefined = no node selected
}

interface SavedReferenceFilters {
  viewMode?: ReferenceViewMode;
  topicFilter?: string[];
  clientFilter?: string[];
  engagementFilter?: string[];
}
```

---

## 5. UI/UX Requirements

All colours follow the **Catppuccin Mocha** palette. The `pm-references` dashboard matches the density and visual language of `pm-tasks` and `pm-raid-dashboard`.

### 5.1 Dashboard Container

```css
background: #1e1e2e;
border: 1px solid #3a3a5c;
border-radius: 8px;
padding: 14px 16px;
font-size: 12px;
font-family: sans-serif;
color: #cdd6f4;
```

### 5.2 Controls Row

**View-mode tab strip** (By Topic / By Client / By Engagement):

```css
/* strip container */
background: #181825;
border-radius: 5px;
padding: 2px;
gap: 2px;

/* inactive tab */
padding: 4px 12px;
border-radius: 4px;
font-size: 11px;
font-weight: 600;
color: #6c7086;

/* active tab */
background: #313244;
color: #cdd6f4;
```

**Filters button:**

```css
padding: 4px 10px;
border-radius: 4px;
font-size: 11px;
font-weight: 600;
background: #313244;
border: 1px solid #45475a;
color: #cdd6f4;
```

**Search input:**

```css
background: #181825;
border: 1px solid #45475a;
border-radius: 4px;
padding: 4px 8px;
font-size: 11px;
color: #cdd6f4;
```

### 5.3 Filter Panel

**Panel container:**

```css
background: #181825;
border-radius: 6px;
padding: 10px 12px;
```

**Row labels** (TOPIC, CLIENT, ENGAGEMENT):

```css
font-size: 10px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.5px;
color: #6c7086;
min-width: 70px;
```

**Filter chips — default state:**

```css
padding: 2px 8px;
border-radius: 4px;
font-size: 10px;
font-weight: 600;
background: #313244;
border: 1px solid #45475a;
color: #cdd6f4;
```

**Filter chips — active (Topic) — Catppuccin Mauve:**

```css
background: #cba6f730;
border-color: #cba6f7;
color: #cba6f7;
```

**Filter chips — active (Client / Engagement) — Catppuccin Blue:**

```css
background: #89b4fa30;
border-color: #89b4fa;
color: #89b4fa;
```

Topic and client/engagement active chips are visually differentiated by colour (Mauve vs Blue). This is implemented via separate CSS modifier classes: `pm-ref-filter-chip--active-topic` and `pm-ref-filter-chip--active-context` (or equivalent cascade via `pm-ref-filter-chip--topic` carrying its own active-state colour).

Row labels use `text-transform: uppercase` in CSS so no TypeScript change is needed for casing.

### 5.4 Group Headers

```css
/* header row */
padding: 6px 0 4px;
border-bottom: 1px solid #313244;

/* group title */
font-size: 12px;
font-weight: 700;
color: #cdd6f4;

/* count badge */
background: #313244;
border: 1px solid #45475a;
border-radius: 10px;
padding: 1px 7px;
font-size: 10px;
font-weight: 700;
color: #a6adc8;

/* collapse arrow */
color: #6c7086;
font-size: 10px;
```

### 5.5 Reference Cards

```css
/* card container */
background: #181825;
border: 1px solid #313244;
border-radius: 5px;
padding: 7px 10px;
gap: 8px;

/* card container — hover */
border-color: #45475a;

/* document icon */
color: #6c7086;
font-size: 13px;

/* reference title */
color: #89dceb;
font-size: 12px;
font-weight: 600;
text-decoration: underline;
```

### 5.6 Context Chips (on reference cards)

```css
/* shared chip base */
padding: 1px 6px;
border-radius: 3px;
font-size: 10px;
font-weight: 600;

/* topic chip */
background: #cba6f720;
color: #cba6f7;
border: 1px solid #cba6f740;

/* client chip */
background: #89b4fa20;
color: #89b4fa;
border: 1px solid #89b4fa40;

/* engagement chip */
background: #a6e3a120;
color: #a6e3a1;
border: 1px solid #a6e3a140;

/* "also in X" secondary hint */
background: #45475a40;
color: #6c7086;
border: 1px solid #45475a;
font-style: italic;
```

### 5.7 CSS Class Index

| Class | Element |
|-------|---------|
| `.pm-references` | Dashboard container |
| `.pm-references__toolbar` | Controls row |
| `.pm-references__tabs` | Tab strip container |
| `.pm-references__tab` / `--active` | View-mode tabs |
| `.pm-references__filters-toggle` | Filters button |
| `.pm-references__search` | Search input |
| `.pm-references__filter-panel` | Collapsible filter panel |
| `.pm-references__filter-row` | Topic / Client / Engagement chip rows |
| `.pm-references__filter-label` | Row labels |
| `.pm-references__chips` | Chip container within a row |
| `.pm-ref-filter-chip` | Filter chip (default state) |
| `.pm-ref-filter-chip--topic` | Topic chip type |
| `.pm-ref-filter-chip--active-topic` | Active topic chip (Mauve) |
| `.pm-ref-filter-chip--active-context` | Active client/engagement chip (Blue) |
| `.pm-references__clear-filters` | Clear filters button |
| `.pm-ref-group` | Collapsible reference group |
| `.pm-ref-group__header` | Group header row |
| `.pm-ref-group__title` | Group heading text |
| `.pm-ref-group__count` | Count badge |
| `.pm-ref-group__body` | Group body (collapsible) |
| `.pm-ref-card` | Reference card |
| `.pm-ref-card__title-row` | Card title row |
| `.pm-ref-card__icon` | Document icon |
| `.pm-ref-card__hint` | "also in X" secondary hint |
| `.pm-ref-card__chips` | Context chips container |
| `.pm-ref-chip` | Context chip (base) |
| `.pm-ref-chip--topic` | Topic context chip |
| `.pm-ref-chip--client` | Client context chip |
| `.pm-ref-chip--engagement` | Engagement context chip |
| `.pm-ref-empty` | Empty state message |
| `.pm-references__body` | Two-column layout wrapper (sidebar + list) |
| `.pm-references__sidebar` | Topic tree sidebar container |
| `.pm-ref-tree` | Topic tree root `<ul>` |
| `.pm-ref-tree__node` | Tree node `<li>` |
| `.pm-ref-tree__node--selected` | Currently selected tree node |
| `.pm-ref-tree__toggle` | Expand/collapse arrow for subtree |
| `.pm-ref-tree__children` | Nested child `<ul>` |
| `.pm-references__panel` | Reference list panel (right column) |

---

## 6. Dependencies & Cross-References

### 6.1 Dataview Plugin

`pm-references` requires Dataview. `QueryService.dv()` returns `null` when Dataview is unavailable; the processor renders a `.pm-error` element and returns rather than throwing. `getReferencesByTopic()` and `getReferences()` both guard against `dv() === null`.

### 6.2 Entity Commands (PRD-002)

- `PM: Create Reference Topic` — creates Reference Topic notes containing `pm-actions` (type: `create-reference`, context: `topic`) and `pm-references` (pre-filtered to that topic).
- `PM: Create Reference` — creates Reference notes; at least one topic is required (issue #25 — Reference Topics must have `status: Active` in frontmatter so `getActiveEntitiesByTag(ENTITY_TAGS.referenceTopic)` returns results).

### 6.3 `pm-actions` Action Types (PRD-004)

`create-reference` and `create-reference-topic` are registered in `ACTION_COMMAND_MAP` in `shared-renderers.ts`. The Reference Topic template and `views/References.md` scaffold file use these action types.

### 6.4 Settings & Folder Paths (PRD-007)

`folders.references` and `folders.referenceTopics` settings keys control where reference files are created and where the scaffold creates folders. See PRD-007 §3.1 and §4.1.

### 6.5 File Name Constraint (issue #30)

Reference file names must not contain colons (`:`) — Obsidian prohibits colons in file names on Windows. Test data constants (`REFERENCE_NAMES`) must not use colons; any display name with a colon should substitute a safe separator (e.g. ` - `).

### 6.6 Modal Styling (issues #34, #35)

Reference and Reference Topic create modals use `EntityCreationModal` following the same `.pm-modal-field` / `.pm-modal-buttons` CSS class structure as Client, Engagement, and Project modals. No inline styles.

### 6.7 Create Reference modal UI controls (issue #69)

`ReferenceCreationModal` uses the following UI components:

| Field | Component | Config |
|-------|-----------|--------|
| Topics | `FilterChipSelect` | `showUnassignedCheckbox: false`; options mapped as `{ displayText: name, value: '[[name]]' }`; pre-selected topics passed as `selectedValues` |
| Client | `PropertySuggest` | `includeNone: true`; options mapped as `{ displayText: name, value: name }`; pre-selected client passed as `currentValue` |
| Engagement | `PropertySuggest` | `includeNone: true`; options mapped as `{ displayText: name, value: name }`; pre-selected engagement passed as `currentValue` |

All three component instances must have `destroy()` called in `onClose()` to release Obsidian suggest popovers.

---

## 7. Acceptance Criteria

### Data Model

- [ ] Reference Topic notes are created at `reference/reference-topics/<Name>.md` with `#reference-topic` tag and `status: Active` frontmatter; topic suggester in `PM: Create Reference` lists them correctly (issue #25)
- [ ] Reference notes are created at `reference/references/<Name>.md` with `#reference` tag, `topics[]` wikilink array, and optional `client` / `engagement` wikilinks written via `processFrontMatter`
- [ ] Reference file names do not contain colons (issue #30)
- [ ] Reference Topic frontmatter supports an optional `parent` field containing a wikilink to another Reference Topic; root topics omit the field (issue #70)
- [ ] `parent` field is written and cleared via `processFrontMatter` by `PM: Update Reference Topic` (issue #70)

### Commands

- [ ] `PM: Create Reference Topic` creates a note with a `pm-actions` block (`create-reference`, context: `topic`) and a `pm-references` block pre-filtered to that topic; opens the new note immediately
- [ ] `PM: Create Reference` requires at least one topic; `topics`, `client`, `engagement` are written via `processFrontMatter` after file creation
- [ ] `ActionContextManager` pre-fill works from Reference Topic page (topic field), Client page (client field), and Engagement page (engagement field)
- [ ] `PM: Update Reference Topic` registers in the command palette; two-step modal: select topic → assign or clear parent; writes `parent` via `processFrontMatter`; selecting `(None)` removes the field entirely (issue #70)

### Service Layer

- [ ] `QueryService.getReferenceTopicTree()` returns a forest of `TopicNode` objects with all `#reference-topic` pages correctly assembled into parent–child relationships (issue #70)
- [ ] `QueryService.getTopicDescendants(topicName)` returns all descendants at all depths, not including the topic itself (issue #70)
- [ ] A cycle in the `parent` graph (A → B → A) does not cause an infinite loop; `getReferenceTopicTree()` handles cycles gracefully (issue #70)

### Property Editor

- [ ] `pm-properties entity: reference` renders Topics (list-suggester), Client (suggester), Engagement (suggester)
- [ ] `reference-topic` has no `pm-properties` block in its template; its `ENTITY_FIELDS` entry is an empty array

### Dashboard (`pm-references`)

- [ ] `pm-references` code block renders the dashboard with controls row (tab strip, Filters button, search input)
- [ ] By Topic view groups references by topic alphabetically; a reference with multiple topics appears in each relevant group
- [ ] By Client view groups by resolved client (direct or via engagement); unlinked references in Unassigned group
- [ ] By Engagement view groups by engagement; unlinked references in Unassigned group
- [ ] Topic / Client / Engagement filter chips toggle correctly; active chips visually differentiated (Mauve vs Blue)
- [ ] Cross-dimension filter logic is AND; same-dimension is OR
- [ ] Search field filters reference cards by title (case-insensitive substring)
- [ ] `"also in <Primary Topic>"` hint appears on cards in non-primary topic groups
- [ ] Filter state persisted to `pm-references-filters` frontmatter; restored on page reload
- [ ] When Dataview is unavailable, a `.pm-error` element is shown (not a thrown error)
- [ ] By Topic view renders a topic-tree sidebar using the hierarchy from `getReferenceTopicTree()`; nested topics are indented under their parent (issue #70)
- [ ] Clicking a tree node sets `selectedNode` and filters the reference list to that topic and all its descendants via `getTopicDescendants()`; clicking the active node again clears the selection (issue #70)
- [ ] `selectedNode` is persisted to `pm-references-filters` frontmatter and restored on page reload (issue #70)

### Settings & Scaffold

- [ ] `folders.references` and `folders.referenceTopics` settings render, persist, and reset to defaults correctly
- [ ] Scaffold creates `reference/references/`, `reference/reference-topics/`, `views/References.md`, `views/Reference Topics.md`, `views/Reference Topics Base.base`
- [ ] Settings deep-merge preserves reference folder keys when upgrading from older saved settings

### CSS

- [ ] All `.pm-references*` and `.pm-ref-*` CSS classes have rules in `styles.css` matching the Catppuccin Mocha spec (§5)
- [ ] Active topic filter chips render in Mauve (`#cba6f7`); active client/engagement chips render in Blue (`#89b4fa`) (issue #38)
- [ ] Filter row labels render uppercase via `text-transform: uppercase` CSS (issue #38)
- [ ] `.pm-references__body`, `.pm-references__sidebar`, `.pm-references__panel` implement the two-column sidebar layout (issue #70)
- [ ] `.pm-ref-tree`, `.pm-ref-tree__node`, `.pm-ref-tree__node--selected`, `.pm-ref-tree__toggle`, `.pm-ref-tree__children` all have rules in `styles.css`; active node is visually highlighted (issue #70)

### Documentation

- [ ] `docs/plugin/data-model.md` Reference Topic section includes the `parent` field with its optional-field comment (issue #70)
- [ ] PRD-002 command table and acceptance criteria reflect the `PM: Update Reference Topic` command (issue #70)
- [ ] PRD-009 §4.0, §4.1, §4.4, §3.4, §5.7, and §7 are updated to reflect hierarchical topics (issue #70)

---

## 8. Out of Scope

- Editing or deleting reference files via the dashboard (read-only view).
- Sorting references within a group beyond alphabetical by title.
- Pagination of reference groups or cards.
- Offline / non-Dataview fallback for the dashboard beyond the error state.
- Cross-vault reference sharing.
- Export of reference data (CSV, PDF).
- Custom view modes beyond topic / client / engagement.
- E2E tests for dashboard rendering.
