# PRD-008: RAID Tracker

## 1. Overview

The RAID Tracker is a first-class entity system for managing Risks, Assumptions, Issues, and Decisions (RAID items) within an Obsidian vault. RAID items are vault notes with structured frontmatter, created through the plugin's standard command + modal + `pm-properties` pattern.

A cursor-line editor command (`PM: Tag Line as RAID Reference`) lets users annotate any line in any note with a directional reference to a RAID item. A `MarkdownPostProcessor` transforms these inline annotations into styled directional badges. Each RAID item note includes a `pm-raid-references` code block that aggregates all annotated lines from across the vault. A `pm-raid-dashboard` code block provides a filterable dashboard with a Likelihood × Impact heat-map matrix and items grouped by RAID category.

The feature was designed in `docs/superpowers/specs/2026-03-21-raid-tracker-design.md` and implemented across issues #13 (core feature) and #22–#38 (bug fixes and refinements).

---

## 2. User Stories

- As a consultant, I want to create RAID items (Risks, Assumptions, Issues, Decisions) linked to a client engagement so I can track project concerns in a structured way.
- As a user, I want to tag any line in any note as a directional reference to a RAID item so I can capture the relationship between meeting notes, decisions, and risks without leaving my note.
- As a user, I want tagged references to render as styled badges in reading view so I can scan annotations at a glance without reading raw annotation syntax.
- As a user, I want each RAID item note to show all notes that reference it so I can see the full context around a risk or decision.
- As a project lead, I want a filterable dashboard with a Likelihood × Impact matrix so I can assess overall risk posture and prioritise action.
- As a user, I want RAID items relevant to my current note (same client/engagement) surfaced first when tagging so I can quickly select the right item.

---

## 3. Functional Requirements

### 3.1 `PM: Create RAID Item` Command

Creates a RAID item note via a sequential modal flow:

1. **Name** — `InputModal`: prompt "RAID item name"
2. **RAID Type** — `SuggesterModal<RaidType>` — Risk / Assumption / Issue / Decision
3. **Engagement** (optional) — `SuggesterModal` over active engagements displayed as "Eng (Client)"; includes a (None) option
4. **Owner** (optional) — `SuggesterModal` over active people displayed as "Person (Client)"; includes a (None) option

**Implementation note (issue #34):** This command uses multiple sequential `SuggesterModal` steps rather than `EntityCreationModal` because RAID items have more required fields than the two-field (name + optional parent) pattern `EntityCreationModal` handles. Chaining `EntityCreationModal` for further steps is prohibited; each step in a multi-step command must use `SuggesterModal` or `InputModal` directly.

On confirm:
- Creates `raid/<Name>.md` from the RAID item template
- Sets `raid-type`, `engagement`, `owner` via `processFrontMatter`
- Sets `raised-date` to today's ISO date
- Sets defaults: `status: Open`, `likelihood: Medium`, `impact: Medium`
- Navigates to the new file
- Logs each modal step result at DEBUG level (required by issue #28)

### 3.2 `PM: Tag Line as RAID Reference` Command (editor command)

Registered as an `editorCallback` so it appears in Obsidian's slash command menu.

Flow:
1. **Capture cursor position synchronously** before any modal opens to prevent stale-cursor bugs after async modal resolution.
2. Read the current file's frontmatter for `client` and `engagement` for context-aware sorting.
3. Open `SuggesterModal<DataviewPage>` — all active `#raid` items. Items whose `client` or `engagement` matches the current note are sorted to the top, prefixed with `★`. Each item displays as `[R] Name (Engagement)` using the RAID type initial.
4. On item selected, open `SuggesterModal<DirectionOption>` — three direction options derived from the selected item's `raid-type`:
   - `↑ Positive — <type-label>` (e.g. "↑ Positive — Mitigates")
   - `↓ Negative — <type-label>` (e.g. "↓ Negative — Escalates")
   - `· Neutral — Notes`
5. On direction selected, append `{raid:<direction>}[[Name]]` to the captured cursor line via `editor.setLine()`.
6. Either cancellation (step 3 or step 4) shows `Notice(MSG.CANCELLED)` and aborts without writing.

**Implementation note (issue #39):** An earlier implementation used a two-dropdown compound modal (`RaidTagModal`). This was replaced with two sequential `SuggesterModal.choose()` calls, consistent with the Create RAID Item command and the broader convention that multi-step flows use sequential `SuggesterModal` instances.

### 3.3 Badge Renderer (`raid-badge-processor`)

Registered as a `MarkdownPostProcessor` with `sortOrder: 100` to run after Obsidian's internal wikilink resolution (issue #41).

On each rendered element:
1. Walk all text nodes using a `TreeWalker` to collect nodes containing the `{raid:(positive|negative|neutral)}` pattern before mutating the DOM.
2. For each matching node, find the adjacent `<a class="internal-link">` sibling to identify the linked RAID item.
3. Read the RAID item file's frontmatter from `metadataCache` to resolve its `raid-type`.
4. Map direction + `raid-type` → display label (see Section 4.2).
5. Replace the `{raid:...}` text with a `<span class="raid-badge raid-badge--<direction>">` containing the direction icon and label.
6. If the vault file does not exist or lacks a `raid-type` key, use the generic fallback labels: `positive → "Supports"`, `negative → "Challenges"`, `neutral → "Notes"`.
7. Errors processing any individual node are caught and logged via `console.warn`; remaining nodes continue processing (per-node error isolation, issue #41).

### 3.4 `pm-properties` — `raid-item` Entity Type

Rendered fields in order:

| Field | Control type | Options / source |
|-------|-------------|-----------------|
| RAID Type | Suggester | Risk, Assumption, Issue, Decision |
| Status | Suggester | Open, In Progress, Resolved, Closed |
| Likelihood | Suggester | High, Medium, Low |
| Impact | Suggester | High, Medium, Low |
| Client | Autocomplete | Active clients |
| Engagement | Autocomplete | Active engagements ("Eng (Client)") |
| Owner | Autocomplete | Active people ("Person (Client)") |
| Raised Date | Date picker | Auto-set at creation; editable |
| Closed Date | Date picker | Auto-set on Resolved/Closed; editable |
| Description | Textarea | Free text |

**Auto-close behaviour:** When status changes to `Resolved` or `Closed` and `closed-date` is not already set, `processFrontMatter` writes `closed-date` to today. When status reverts to `Open` or `In Progress`, `closed-date` is cleared. This side-effect is implemented in the status field's `onChange` handler in `pm-properties-processor.ts`.

### 3.5 `pm-raid-references` Processor

Placed in each RAID item note (included in the template). No configuration options — the RAID item name is inferred from the current file's basename.

Rendering:
1. Query backlinks via `dv.pages("[[" + raidItemBasename + "]]")` — returns all vault pages containing a wikilink to the current file. This is the correct Dataview link-source syntax (not a quoted folder path); see Section 6.2.
2. For each backlink file, read raw content via `vault.read()`.
3. Find all lines matching `{raid:(positive|negative|neutral)}[[<CurrentItemName>]]`.
4. For each matching line, render a badge using the type-specific label and the line text (stripped of the annotation).
5. Group by source note (H4 heading with internal link to the source note).
6. Sort source notes by modification date, newest first.
7. On render error (e.g. Dataview unavailable), display a `.pm-error` element with the error message.
8. If no references found: render `.raid-references-empty` with "No references yet. Use PM: Tag Line as RAID Reference to link notes to this item."

### 3.6 `pm-raid-dashboard` Processor

Optional YAML config (all keys have defaults):

```yaml
raidTypes: [Risk, Assumption, Issue, Decision]
statusFilter: [Open, In Progress]
clientFilter: []
engagementFilter: []
```

**Filter panel (top):**
- RAID type chips: R / A / I / D (multi-select toggle)
- Status chips: Open / In Progress / Resolved / Closed (multi-select)
- Client autocomplete filter
- Engagement autocomplete filter
- Free-text search (filters on item title)

**Matrix summary:**
- 3×3 Likelihood (rows: High/Medium/Low) × Impact (columns: Low/Medium/High) heat-map
- Each cell shows a count of items matching that cell under active filters
- Colour-coded: High×High = red, Low×Low = green, graduated
- Clicking a cell toggles a matrix cell filter; matching rows are highlighted in the item groups below

**Item counts strip:** `Risks: N | Assumptions: N | Issues: N | Decisions: N` — counts items under active filters.

**Item groups:** One table per RAID type (Risks, Assumptions, Issues, Decisions), hidden when empty:

| Title | Status | L × I | Age | Owner |
|-------|--------|-------|-----|-------|

- **Title** links to the RAID item note
- **L × I** rendered as a coloured dot (e.g. `H×H` in red)
- **Age** = days since `raised-date`, shown as `Nd`; calculated from `.ts` milliseconds when `raised-date` is a Dataview DateTime object (issue #27)
- **Owner** avatar from first/last initials, resolved from `DataviewLink` object if necessary (issue #32)

**Filter state:** Plain JS object on the `MarkdownRenderChild` instance — ephemeral, reset on re-render, no frontmatter writes.

**Data fetch:** The dashboard calls `getAllRaidItems()`, which returns all RAID items regardless of status. Status filtering is applied in the UI layer (via `applyFilters()`) so that the Resolved and Closed status filter chips produce correct results. `getActiveRaidItems()` is intentionally not used here; it is reserved for contexts where only active items are wanted (e.g. the RAID item suggester in `PM: Tag Line as RAID Reference`).

**Error handling:** If `getAllRaidItems()` throws (e.g. Dataview unavailable), renders a `.pm-error` element and returns (issue #43).

---

## 4. Data Requirements

### 4.1 RAID Item Frontmatter Schema

**File location:** `raid/<Name>.md`
**Vault tag:** `#raid`

```yaml
tags:
  - "#raid"
raid-type: Risk | Assumption | Issue | Decision
client: "[[Client Name]]"           # optional wikilink
engagement: "[[Engagement Name]]"   # optional wikilink
status: Open | In Progress | Resolved | Closed
likelihood: High | Medium | Low
impact: High | Medium | Low
owner: "[[Person Name]]"            # optional wikilink
raised-date: YYYY-MM-DD             # auto-set at creation
closed-date: YYYY-MM-DD             # auto-set on Resolved/Closed
description:                        # optional free text
```

All wikilink fields (`client`, `engagement`, `owner`) are written via `processFrontMatter` after file creation, following the existing convention. When read back, these fields may be Dataview `DataviewLink` objects rather than plain strings; consumers must call `String()` or extract `.path` as appropriate (issues #26, #32).

### 4.2 Line Annotation Format

Annotation appended to the cursor line by `PM: Tag Line as RAID Reference`:

```
{raid:positive}[[RAID Item Name]]
{raid:negative}[[RAID Item Name]]
{raid:neutral}[[RAID Item Name]]
```

In raw markdown, `{raid:positive}` is literal text. The badge post-processor transforms it to a styled span in reading view only; the raw markdown is unchanged.

### 4.3 Direction → Label Mapping

| Direction | Risk | Assumption | Issue | Decision |
|-----------|------|------------|-------|----------|
| `positive` | Mitigates | Validates | Resolves | Supports |
| `negative` | Escalates | Invalidates | Compounds | Challenges |
| `neutral` | Notes | Notes | Notes | Notes |

Generic fallback labels (used when `raid-type` is unknown):

| Direction | Fallback |
|-----------|---------|
| `positive` | Supports |
| `negative` | Challenges |
| `neutral` | Notes |

Direction icons: `positive → ↑`, `negative → ↓`, `neutral → ·`

### 4.4 Allowed Field Values

| Field | Allowed values |
|-------|---------------|
| `raid-type` | Risk, Assumption, Issue, Decision |
| `status` | Open, In Progress, Resolved, Closed |
| `likelihood` | High, Medium, Low |
| `impact` | High, Medium, Low |
| `direction` | positive, negative, neutral |

Inactive statuses (excluded from active item queries): `Resolved`, `Closed`

> **Note on query scope:** `getActiveRaidItems()` and `getRaidItemsForContext()` both exclude Resolved/Closed items and are appropriate for contexts where only actionable items are wanted (e.g. the RAID item suggester). The dashboard uses `getAllRaidItems()` instead, which returns all statuses, so that the Resolved and Closed status filter chips in the dashboard UI function correctly. Status filtering in the dashboard happens at the UI layer, not at the data-fetch layer.

---

## 5. UI/UX Requirements

### 5.1 Modal Patterns

- All multi-step flows use sequential `SuggesterModal.choose()` calls. No chained `EntityCreationModal` instances.
- Each modal step returns a Promise resolving to the selected item or `null` on cancellation.
- A `FOCUS_DELAY_MS` timeout is applied before opening each modal to prevent spurious closes from in-flight DOM events from the preceding modal (e.g. an Enter keydown being captured by the new modal).
- Cancellation at any step shows `Notice(MSG.CANCELLED)` and aborts the command without writing.

### 5.2 pm-modal Styling (issues #35, #37)

All modals created by RAID commands use standard Obsidian modal styling. No custom modal frame CSS is introduced beyond the `pm-modal` class set on the outer element. This ensures visual consistency with all other plugin modals.

### 5.3 Badge CSS Classes

| Class | Colour | Use |
|-------|--------|-----|
| `.raid-badge` | — | Base class on all badges |
| `.raid-badge--positive` | Green | Positive direction |
| `.raid-badge--negative` | Red | Negative direction |
| `.raid-badge--neutral` | Blue | Neutral direction |

Badge colours use Obsidian CSS variables (`var(--color-green)`, `var(--color-red)`, `var(--color-blue)`) to respect theme settings.

### 5.4 pm-raid-references CSS (issue #38, updated issue #50)

The `pm-raid-references` block uses the following CSS classes:

| Class | Element |
|-------|---------|
| `.raid-references-empty` | Empty state placeholder (`<p>`) |
| `.pm-raid-references` | Outer flex container for all groups |
| `.pm-raid-references__group` | Wrapper `<div>` for one source-note group (heading + list) |
| `.pm-raid-references__group-heading` | `<h4>` heading with source note link |
| `.pm-raid-references__list` | `<ul>` list of annotated lines within a group |
| `.pm-raid-references__item` | `<li>` single annotated line row |
| `.raid-badge` | Direction badge `<span>` (shared with badge renderer) |
| `.raid-badge--positive` / `--negative` / `--neutral` | Direction-specific badge colour modifier |

Groups are rendered in descending modification-date order (`TFile.stat.mtime`, newest first).

---

## 6. Dependencies & Cross-References

### 6.1 Dataview Plugin

- Required for `pm-raid-references` and `pm-raid-dashboard` rendering. Obtained via `QueryService.dv()`, which returns `null` if Dataview is unavailable; both processors handle this gracefully with a `.pm-error` element.
- `getActiveRaidItems()` and `getRaidItemsForContext()` query via `ENTITY_TAGS.raid` (`#raid`), not a hardcoded string (issue #43).
- **Backlink query syntax (issue #40):** `dv.pages("[[ItemName]]")` — link-source syntax, NOT `dv.pages('"[[ItemName]]"')` (folder-source syntax). The quoted form incorrectly searches for a folder whose name is the literal string `"[[ItemName]]"`.
- **DateTime coercion (issue #27):** When `raised-date` is queried from Dataview, it may be a Luxon DateTime object with a `.ts` millisecond timestamp rather than a plain string. Age calculation uses `typeof raisedRaw === "object" && "ts" in raisedRaw ? raisedRaw.ts : new Date(String(raisedRaw)).getTime()`.

### 6.2 `pm-properties`

RAID items use `entity-field-config.ts` for their `pm-properties` field configuration. No changes to the `pm-properties-processor.ts` itself are required — only a new entry in the entity field config.

### 6.3 `pm-actions`

The `create-raid-item` action type is added to `ACTION_COMMAND_MAP` in `shared-renderers.ts`. A scaffold note (`views/RAID.md`) combining `pm-actions` and `pm-raid-dashboard` is created by `VaultScaffoldService`.

### 6.4 Settings (issue #24)

Four coordinated changes required:
1. `FolderSettings` interface — add `raid: string`
2. `DEFAULT_FOLDERS` constant — add `raid: "raid"`
3. `DEFAULT_SETTINGS.folders` — add `raid: DEFAULT_FOLDERS.raid`
4. Settings UI — add `{ key: "raid", name: "RAID folder" }` to `folderFields`

Settings must be deep-merged at load time so that older saved settings (missing the `raid` key) are merged with the defaults rather than overwriting them. Failure to deep-merge results in all folders reverting to defaults when the plugin is first run after upgrade.

### 6.5 DataviewLink Handling (issues #26, #32)

Dataview may return wikilink fields (`client`, `engagement`, `owner`) as `DataviewLink` objects rather than plain strings. Filter comparisons and display must call `String(value)` or extract `.path` / `.display` to obtain a comparable value. Passing a `DataviewLink` directly to string comparison always fails; passing to a DOM text node renders `[object Object]`.

---

## 7. Acceptance Criteria

- [ ] `PM: Create RAID Item` command creates a well-formed note at `raid/<Name>.md` with all frontmatter fields initialised correctly
- [ ] `PM: Tag Line as RAID Reference` appends `{raid:<direction>}[[Name]]` to the exact cursor line captured before the modal sequence opened
- [ ] Cancellation at either modal step in `PM: Tag Line as RAID Reference` shows `Notice(MSG.CANCELLED)` and leaves the line unmodified
- [ ] Context-aware RAID item sorting surfaces items matching the current note's client or engagement first, with a `★` prefix
- [ ] Badge renderer displays type-specific labels with correct colour coding in reading view; falls back to generic labels when `raid-type` is unresolvable
- [ ] Badge renderer runs after Obsidian's wikilink resolution (sortOrder: 100) so the adjacent `<a class="internal-link">` element is present when the processor executes
- [ ] Badge renderer processes all text nodes in isolation; an error on one node does not prevent remaining nodes from being processed
- [ ] `pm-properties` renders all 10 RAID item fields with appropriate controls; status change to Resolved/Closed auto-sets `closed-date`; revert auto-clears it
- [ ] `pm-raid-references` correctly finds and displays all annotated lines across the vault; empty state shows correct placeholder; uses link-source Dataview syntax
- [ ] `pm-raid-dashboard` renders matrix, item counts, and grouped tables; all five filters (type, status, client, engagement, search) work correctly; matrix cell click toggles cell filter
- [ ] RAID folder path is configurable in Settings; settings deep-merge preserves the `raid` folder key when upgrading from older saved settings
- [ ] `DataviewLink` objects in `client`, `engagement`, and `owner` fields are handled correctly in filter comparisons and display rendering
- [ ] `raised-date` Dataview DateTime objects (`.ts` milliseconds) are handled correctly in age calculation
- [ ] All `pm-raid-*` processors render a `.pm-error` element (not throw) when Dataview is unavailable
- [ ] `ENTITY_TAGS.raid` constant is used in all Dataview tag queries (no hardcoded `'#raid'` strings)
- [ ] All new logic has unit tests; `npm run test:coverage` passes all thresholds (70% lines/functions/statements, 65% branches)
- [ ] `npm run lint`, `npm run test`, `npm run build` all pass

---

## 8. Out of Scope

- RAID item linking to projects or persons beyond the existing wikilink frontmatter fields
- Bulk import of RAID items
- Export of RAID data (CSV, PDF)
- E2E tests for RAID processor rendering
- Offline / non-Dataview fallback for `pm-raid-references` and `pm-raid-dashboard` beyond the error state
- Editing the annotation format after it has been written (only creation is in scope)
