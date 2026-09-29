# PRD-010: Contextual Search & the `pm-search` Panel

## 1. Overview

Contextual search adds a cross-entity finder to the vault. A dedicated `pm-search` `ItemView` panel lets a user type a query and jump to any project-management entity — Client, Engagement, Project, Person, meeting, Inbox note, Project Note, RAID item, Reference, or Reference Topic — whose **name** or **body content** contains the query (a case-insensitive substring match on both), narrowed by entity type, and scoped to a client, engagement, or person. Name matches are listed above body-only matches, and within each group an earlier occurrence of the query comes first. Selecting a result opens the underlying note.

The feature is built in three layers: a headless **search substrate** (enumeration, type resolution, a content-source seam that reads note body text, tiered ranking over name and body, and a client/engagement/person scope model), a **panel** hosting the search box, the scope drawer, results, and empty states, and an **entity-type filter** of family-grouped toggles. A shared, theme-adaptive `--pm-*` token layer backs the panel's appearance, and a single `ENTITY_PRESENTATION` registry supplies each type's label, icon, and family colour so no view keeps its own type-to-style map.

This PRD covers: the search substrate and its `SearchService` contract (see also `architecture.md` and PRD-001 §3.5 for the relationship-traversal spine it reuses), the person-association scope facet, the `pm-search` panel and its command entry points (see also PRD-007 §3, §4.1 for settings), the scope drawer and its auto-seeded chips, the `--pm-*` styling foundation, and the panel's persisted filter state (`settings.ui.savedSearchFilters`). It is the primary home for the `savedSearchFilters` key, mirroring how PRD-009 §3.8 documents `referenceDashboardFilters`.

---

## 2. User Stories

- As a consultant, I want to search every entity in my vault by name from one panel so I can jump to a client, project, meeting, or RAID item without remembering where it lives.
- As a user, I want to find a note by typing any part of its name, in any letter case, with the matched text highlighted so I can see why a result is listed.
- As a user, I want to restrict a search to one or more entity types so a common word does not bury the Project I want under meetings and notes.
- As a user, I want each result to show its type and its Client › Engagement breadcrumb so I can tell two similarly-named notes apart at a glance.
- As a user, I want to narrow a search to a client, engagement, or person so I can see only the entities under that part of the hierarchy.
- As a user, I want a person scope that follows the relationships the vault actually records — the person's own note, RAID items they own, meetings they attend, and their reporting line — so "everything involving Dana" returns the right notes.
- As a user, I want the panel to open from the command palette or a ribbon icon, and to reveal the existing panel rather than open a second one.
- As a user, I want my type and scope selections remembered between sessions so the panel reopens the way I left it.
- As a user, I want the panel to tell me clearly when Dataview is off, rather than failing silently or throwing.

---

## 3. Functional Requirements

### 3.1 The `pm-search` Panel

The search UI is a note-less Obsidian `ItemView`, not a code block. It is hosted by `PmSearchItemView` (a `DashboardItemViewHost` subclass) and renders the `PmSearchView` component into the leaf's `contentEl`.

**View type constant:** `PM_SEARCH_VIEW_TYPE = "pm-search"` (exported from `src/constants.ts`).

**Activation command:** `PM: Open Search` (command ID `engagement-project-manager:open-search`), registered during `onLayoutReady`. If a `pm-search` leaf is already open in any leaf, the command reveals it instead of creating a duplicate; otherwise it opens as a main-editor tab (`workspace.getLeaf("tab")`).

**Ribbon icon:** shown when `settings.ui.showRibbonIcons` is `true`. Uses the `search` icon; clicking it calls the same activation helper as the command.

**Lifecycle.** The view type is registered via `this.registerView(...)` **synchronously in `onload()`** in `main.ts`, before the workspace restores its saved layout, so a restored `pm-search` leaf resolves to the real view rather than Obsidian's "plugin has gone away" placeholder. The view constructs without throwing: `getViewType()`, `getDisplayText()`, and `getIcon()` return module constants that are safe to read while the `ItemView` base constructor runs (Obsidian 1.7.2+ calls `getViewType()` during `super()`). On unload, all `pm-search` leaves are detached via `workspace.detachLeavesOfType(...)`.

**Source:** `src/views/pm-search-item-view.ts` and `src/views/pm-search-view.ts`, exported via `src/views/index.ts`.

### 3.2 Panel Layout

The panel is a vertical stack:

- A **command zone** (`.pm-search__cz`) holding, top to bottom, the search box, the filter zone (a controls row with the "Narrow by…" scope add button and a Clear button, the active-scope chips bar, and the collapsible drawer), and the count row.
- A scrolling **results area** (`.pm-search__results`) below it.

### 3.3 Search Box

- A leading search glyph, a text input, and a trailing clear button that appears only when the field is non-empty. Whitespace-only input counts as non-empty for the clear button, even though it browses (§3.4).
- Placeholder: **"Search by name or content…"**.
- Input is debounced through `DEBOUNCE_MS.SEARCH` before a repaint.
- Clearing the field cancels the pending search and repaints immediately (browse mode).

### 3.4 Ranking (name + body content)

- **Query normalization:** leading and trailing whitespace is trimmed from the query before matching; inner whitespace is kept, so a multi-word query matches only as one literal phrase (for example `acme portal` matches a name or body containing "acme portal", not one that has "acme" and "portal" apart). Normalization lives in one pure module (`normalizeQuery` / `isBrowseQuery`), shared by the search service and the panel.
- Results are ranked over an **ordered set of match fields** — the note's **name** (tier 0) then its **body content** (tier 1) — where each field is scored through **its own injected matcher**, selected per field (the ordered `SearchField[]` descriptor list behind the `ITextMatcher` abstraction). Both fields use the **strict case-insensitive substring** matcher (`SubstringMatcher`): the trimmed query must occur verbatim, in any letter case, somewhere in the field's text. A name that holds the query's characters only as a gapped subsequence (for example `acm` against "A Cool Meeting") does not match. A candidate wins the tier of the first field whose text matches, and the name tier always ranks above the body tier.
- **Strict name tiering:** every name match ranks **above** every body-only match. Within a tier, survivors are ordered by match score, and the score favors an earlier first occurrence of the query in the winning field: an earlier occurrence (a prefix first) ranks higher, and ties are broken alphabetically by name, so ordering is deterministic. Non-matches (neither name nor body) are excluded.
- Body text is read from the vault behind the `IContentProvider` seam (§4.1), so the ranking substrate stays free of any `obsidian` import. Because that read is asynchronous, `search` is asynchronous (§4.1).
- A **body-derived** match carries a single **snippet**: a fixed-width window over the first body occurrence, ellipsised when clipped (§3.5). A name match carries no snippet.
- **Browse:** an empty or whitespace-only query is an explicit `SearchService` rule, not a match: it lists every in-scope entity, sorted alphabetically by name, without reading any body and without highlighting. A browse result carries no match evidence and no snippet.
- Every ranked result carries its **match evidence** (`SearchResult.match`, §4.2): the field it matched on and the matched runs in that field's text. The panel highlights the name from this evidence, and only when the result matched on its **name**; it does not match the query again itself. The substring matcher reports one run, the first occurrence of the query, so that is what is highlighted in the name. A body-only match highlights nothing in the name; its snippet carries the highlight instead. The panel highlights every run in the match evidence, so a matcher that reported more occurrences would show them all.
- Each highlighted run is wrapped in an `.hl` span tinted with the `--pm-sky` highlight colour, in the result name for a name match and in the snippet for a body match.

### 3.5 Result Rows

Each result (`.pm-search__result`) is a full-width button with:

- An **icon gutter** (`.pm-search__result-icon`): a rounded square tinted with the entity type's family colour at low opacity, holding the type's Lucide icon stroked in the family colour.
- A **name** (`.pm-search__result-name`), single line with ellipsis, with matched runs highlighted: the first occurrence of the query, for a name match; a body-only match shows no name highlight.
- A **body snippet** (`.pm-search__snippet`), rendered **only** for a body-derived match: a single line beneath the name showing the matched body excerpt, with the matched run highlighted (`.hl`). A name match shows no snippet.
- A **breadcrumb** (`.pm-search__crumb`): the levels above the item, ordered **Client › Engagement**, segments joined by a `›` separator (`.pm-search__crumb-sep`). A Reference or Reference Topic that resolves to no client or engagement reads **"Knowledge base"**.
- A **type pill** (`.pm-search__result-type`), right-aligned, showing the type's label.

Selecting a row opens the underlying note through `NavigationService.openFile`.

### 3.6 Entity-Type Filter

The drawer holds a family-grouped set of type toggles (`.pm-search__ttog`), driven by `aria-pressed`. The 12 entity types are a **fixed, bounded set**, so they are a toggle group rather than a searchable field.

- Toggles are grouped by family, each family under a heading: **Accounts** (Client, Engagement, Project), **People** (Person), **Meetings** (Single Meeting, Recurring Meeting, Recurring Meeting Event), **Capture** (Inbox Note), **Knowledge** (Reference, Reference Topic, Project Note), and **Risk** (RAID Item). The grouping and ordering come from `ENTITY_FAMILY_GROUPS`.
- Each toggle carries a leading family-colour dot, its type label, and a pressed state.
- Selection is **OR within the type dimension**. With no toggle pressed, results include **every type** ("no filter = all").
- Each enabled type also appears as a removable chip in the active-scope chips bar (`.pm-search__chips`); removing the chip un-presses the toggle, and the two stay in sync.

Type labels, icons, and family colours come from the `ENTITY_PRESENTATION` registry (§4.4); the view carries no per-type branch.

### 3.7 Hierarchy & Person Scope

The search substrate constrains results to a `SearchScope` with three facets — **client**, **engagement**, and **person** — each an OR set of names, combined with AND across facets. An empty or absent facet imposes no constraint.

- **Client** and **Engagement** scope reuse `EntityHierarchyService.resolveClientName` / `resolveEngagementName` — the same relationship-traversal spine the task, RAID, and reference dashboards use (see PRD-001 §3.5 and `architecture.md`).
- **Person** scope resolves through `PersonAssociationResolver.peopleOf(page)`, which reads only fields the data model carries: the Person note itself (`#person`), a RAID item's `owner`, a meeting's `attendees`, a recurring meeting's `default-attendees`, and the Person's `reports-to` chain (cycle-guarded). **There is no team / team-members field**, so none is read.

The panel drawer exposes these facets as searchable, multi-add chip controls (the same UX as the Task Dashboard filters), reusing `FilterChipSelect`, so each facet scales past a handful of clients or people. On open, `PmSearchView.autoSeed` resolves the active note's client and engagement and pre-adds each (when it resolves and is not already selected) as an inferred scope chip — marked with a leading home glyph and removable like any other. `FACET_BINDINGS` is the single place the facet-to-field mapping lives, so `scopeOf` projects the populated facets into a `SearchScope` and the persistence layer iterates the facets generically, with no per-facet branch.

### 3.8 Filter-State Persistence

The panel persists its filter state to plugin settings, exactly as the Reference Dashboard persists `referenceDashboardFilters`. State is stored in `plugin.settings.ui.savedSearchFilters` and written through the shared `SettingsViewStore` (which calls `plugin.saveSettings()`), so it is global across notes and vault sessions rather than tied to a host note. There is no host note and therefore no frontmatter key. `PmSearchView.persist` calls `serializeSearchFilters` on every filter change, and `initSearchFilterState` rebuilds the in-memory state on reopen.

```typescript
// plugin.settings.ui.savedSearchFilters shape (SavedSearchFilters):
{
  clients?: string[];      // resolved client names in scope (OR within facet)
  engagements?: string[];  // resolved engagement names in scope
  people?: string[];       // person names in scope
  types?: EntityType[];    // enabled entity-type toggles; empty/absent = every type
}
```

The query string and the drawer's open/closed state are **ephemeral** and are not persisted.

> **Merge caveat.** `mergeSettings` is only two levels deep (the top level and the `ui` object), so the nested `savedSearchFilters` object is replaced wholesale on upgrade rather than key-merged. The panel must read each sub-key defensively and default any missing one at read time, so adding a field in a later version cannot leave it `undefined` for an existing user.

### 3.9 Empty & Error States

The results area renders a centred state (`.pm-search__empty`) with a glyph, a title, and a guidance line when there are no rows:

- **No match** (a query that is non-empty after trimming, nothing matches): title **`No matches for "<query>"`**, where `<query>` is the trimmed query, line **"Try a shorter or different query."** A whitespace-only query browses (§3.4), so it never shows this state.
- **Dataview unavailable:** a crossed-screen glyph, title **"Search needs Dataview"**, line **"Enable the Dataview plugin so the vault can be indexed."** The panel does not throw — `SearchService.search` returns `[]` when Dataview is absent, and the count row reads **"—"**.
- An empty or whitespace-only query with no in-scope entities (for example, an empty vault) simply shows no rows (browse mode, nothing yet).

---

## 4. Data Requirements

### 4.1 `SearchService` Contract

```typescript
interface ISearchService {
  // Enumerates the pages of the requested `types`, keeps those satisfying every
  // populated `scope` leg, then branches on the trimmed `query`:
  //   - an empty or whitespace-only query browses: every scoped page, sorted by
  //     name, with no body reads and no match evidence;
  //   - any other query ranks the scoped pages over name and body, each by a
  //     case-insensitive substring (the query must occur in the text), with name
  //     matches above body-only matches and non-matches dropped.
  // Resolves to a read-only list of SearchResults. Asynchronous because body
  // text is read from the vault behind a content-provider seam. An empty scope
  // imposes no hierarchy constraint; resolves to [] (never rejects) when
  // Dataview is absent.
  search(query: string, scope: SearchScope, types: EntityType[]): Promise<readonly SearchResult[]>;
}
```

`SearchService` composes the pipeline behind this narrow interface: normalize the query (trim outer whitespace) → enumerate the requested types' candidates → constrain by the active scope facets through the pure `FilterEngine` (scope is body-independent, so it prunes before the reads) → then one of two branches. For an empty or whitespace-only query, **browse**: sort every scoped candidate by name, reading no body. For any other query, **rank**: resolve each survivor's body text through the injected `IContentProvider`, then rank over name and body (name tier above body tier), attaching each result's match evidence. Either branch finally maps each survivor to a `SearchResult`. The body read lives behind `ObsidianContentProvider`, so `SearchService` and the ranker still carry no `obsidian` import and unit-test headless with a fake matcher and a fake content provider. A per-note read failure is caught and mapped to empty content (that note contributes no body match; the search never rejects), and an absent Dataview resolves to `[]`.

### 4.2 Search Types

```typescript
interface SearchScope {
  clients?: string[];      // resolved client names a candidate must resolve up to (any of)
  engagements?: string[];  // resolved engagement names a candidate must resolve up to (any of)
  people?: string[];       // person names a candidate must be associated with (any of)
}

interface SearchResult {
  page: DataviewPage;   // the matched page
  type: EntityType;     // the type it was enumerated as
  client?: string;      // resolved client breadcrumb, present only when it resolves
  engagement?: string;  // resolved engagement breadcrumb, present only when it resolves
  snippet?: SearchSnippet; // body-match excerpt, present ONLY for a body-derived match
  match?: SearchMatch;     // match evidence, present on every ranked result, absent on browse
}

interface SearchMatch {
  field: MatchField;             // the field the result matched on: "name" or "body"
  matches: readonly MatchRun[];  // the query's matched runs in that field's text
}

type MatchField = "name" | "body";        // a match field (derived from MATCH_FIELD)
type MatchRun = readonly [number, number]; // one matched run: [start, end) character offsets

interface SearchSnippet {
  text: string;                  // the windowed body excerpt (ellipsised when clipped)
  matches: readonly MatchRun[];  // highlight offsets [start, end) within `text`
}

interface EntityCandidate {
  page: DataviewPage;
  type: EntityType;
}
```

The body excerpt is a single fixed-width window over the first body occurrence; its width is a centralized named constant (default 120 characters, so it can become a user setting later). The content-source seam is a narrow port:

```typescript
interface IContentProvider {
  // Resolves a page's body text; the Obsidian-backed implementation
  // (ObsidianContentProvider) reads it via Vault.cachedRead and strips the
  // leading YAML frontmatter. Resolves to "" when there is nothing to read.
  textFor(page: DataviewPage): Promise<string>;
}
```

Scope semantics: **OR within a facet, AND across facets**. A facet leg is applied only when it carries names, so an empty leg is unconstrained.

### 4.3 Enumeration & Type Resolution

- `EntityEnumerator.candidates(type)` lists a type's candidate pages, dispatching on the type's `ENTITY_KINDS` descriptor: a `tag`-strategy kind is read by its Dataview tag (a tagged note anywhere in the vault is a candidate), a `folder`-strategy kind by its folder. Dispatch is by strategy alone — no per-type branch — so a new entity type is enumerated by its registration. Returns `[]` when Dataview is unavailable.
- `EntityTypeResolver.resolve(page)` labels a page with its `EntityType`, matching by tag first and by the most specific (longest) folder otherwise, so a nested page (e.g. a project note under `projects/notes/…`) resolves to its own kind rather than an ancestor's.

### 4.4 Presentation Registry

`ENTITY_PRESENTATION` (in `src/entity-registry.ts`) is the single presentation source for the search panel, the type filter, and the chips. One descriptor per `EntityType`:

```typescript
interface EntityPresentation {
  label: string;           // user-facing type name
  icon: string;            // Obsidian/Lucide icon id
  familyColorToken: string;// CSS custom-property name carrying the family colour
}
```

| Type | Label | Icon | Family colour token | Family |
|------|-------|------|---------------------|--------|
| `client` | Client | `building-2` | `--pm-entity-client` | Accounts |
| `engagement` | Engagement | `briefcase` | `--pm-entity-engagement` | Accounts |
| `project` | Project | `folder-kanban` | `--pm-entity-project` | Accounts |
| `person` | Person | `user` | `--pm-entity-person` | People |
| `single-meeting` | Single Meeting | `calendar` | `--pm-entity-single-meeting` | Meetings |
| `recurring-meeting` | Recurring Meeting | `calendar-clock` | `--pm-entity-recurring-meeting` | Meetings |
| `recurring-meeting-event` | Recurring Meeting Event | `calendar-check` | `--pm-entity-recurring-meeting-event` | Meetings |
| `inbox` | Inbox Note | `inbox` | `--pm-entity-inbox` | Capture |
| `reference` | Reference | `book-open` | `--pm-entity-reference` | Knowledge |
| `reference-topic` | Reference Topic | `folder-tree` | `--pm-entity-reference-topic` | Knowledge |
| `project-note` | Project Note | `file-text` | `--pm-entity-project-note` | Knowledge |
| `raid-item` | RAID Item | `shield-alert` | `--pm-entity-raid-item` | Risk |

`ENTITY_FAMILY_GROUPS` maps each family to its member types in display order; `ENTITY_FAMILY_LABEL` supplies the heading text.

### 4.5 Persisted Settings

`plugin.settings.ui.savedSearchFilters` — see §3.8 for the shape and merge behaviour. This is the primary specification for the key; PRD-007 §4.1 lists it in the settings schema (shape only).

---

## 5. UI/UX Requirements

The panel is **theme-adaptive**: every colour and dimension reads a central `--pm-*` CSS custom property defined in `styles.css`, and most `--pm-*` tokens map to an Obsidian theme variable so the panel follows the active theme. There is no fixed Catppuccin palette in the styling; the **Catppuccin Mocha** hex values below are the **dark-theme reference** the mockups were drawn against, not literals baked into the panel. The exception is the entity-type family colours, which are **fixed accent tokens** because Obsidian exposes no per-entity variable. This token layer is the canonical styling foundation the plugin's other dashboards can adopt.

The panel matches the density and visual language of `pm-tasks`, `pm-raid-dashboard`, and the Reference Dashboard.

### 5.1 Token Layer (`--pm-*`)

**Neutrals — mapped to theme variables (Mocha reference in comments):**

```css
--pm-crust:   var(--background-primary-alt);          /* #11111b */
--pm-mantle:  var(--background-secondary);            /* #181825 — inputs, hover, drawer, chips */
--pm-base:    var(--background-primary);              /* #1e1e2e — panel */
--pm-surface0:var(--background-modifier-border);      /* #313244 — pill fill, borders */
--pm-surface1:var(--background-modifier-border-hover);/* #45475a — input/chip borders */
--pm-surface2:var(--background-modifier-border-focus);/* #585b70 — dashed add border, crumb sep */
--pm-overlay0:var(--text-faint);                      /* #6c7086 — muted text, icons */
--pm-overlay2:var(--text-muted);                      /* #9399b2 — home glyph, note tint */
--pm-subtext0:var(--text-muted);                      /* #a6adc8 */
--pm-subtext1:var(--text-normal);                     /* #bac2de */
--pm-text:    var(--text-normal);                     /* #cdd6f4 — primary text */
```

**Identity & highlight:**

```css
--pm-blue: var(--interactive-accent);  /* #89b4fa — panel identity: focus rings, active scope, Client family */
--pm-sky:  #89dceb;                     /* match highlight (fixed accent) */
```

**Entity-type family colours (fixed accents):**

| Token | Mocha value | Type(s) |
|-------|-------------|---------|
| `--pm-entity-client` | `#89b4fa` | Client |
| `--pm-entity-engagement` | `#a6e3a1` | Engagement |
| `--pm-entity-project` | `#94e2d5` | Project |
| `--pm-entity-person` | `#fab387` | Person |
| `--pm-entity-single-meeting` / `-recurring-meeting` / `-recurring-meeting-event` | `#f5c2e7` | Meetings |
| `--pm-entity-inbox` | `#f9e2af` | Inbox Note |
| `--pm-entity-project-note` | `#9399b2` | Project Note |
| `--pm-entity-raid-item` | `#eba0ac` | RAID Item |
| `--pm-entity-reference` | `#cba6f7` | Reference |
| `--pm-entity-reference-topic` | `#b4befe` | Reference Topic |

Additional `--pm-*` tokens define the type scale (`--pm-font-*`, `--pm-weight-*`), spacing (`--pm-space-*`), radii (`--pm-radius-*`), the transition duration (`--pm-transition`), focus-ring width/alpha, dot sizes, and icon sizes.

### 5.2 Type Scale & Motion

- Type scale (px / weight): search input 14/500, result name 13/600 (matched run weight 750, colour `--pm-sky`), type pill 10/650, breadcrumb 11/500, family heading 10/700, toggle chip 11/600, count 12 (tabular figures). The type family is the Obsidian interface sans (system-ui stack). Labels are sentence case.
- Radii: inputs and rows 6–7px, chips and pills 10–13px, panel 10px.
- Transitions run ~0.12–0.14s on `border-color`, `box-shadow`, and `transform` only; chevrons rotate 180° when a drawer is open. `prefers-reduced-motion` disables them.
- Focus: inputs show a `--pm-blue` border plus a 2px blue focus ring (focus-within); result rows show an inset 1px `--pm-surface2` ring (focus-visible). Every control is keyboard-operable.

### 5.3 Search Box

- Container: flex, background `--pm-mantle`, 1px `--pm-surface1` border, radius 7, full-width at the top of the command zone; focus-within shows the `--pm-blue` border and ring.
- Leading `--pm-overlay2` search glyph; input text `--pm-text`; placeholder `--pm-overlay0`. A trailing clear button (`--pm-overlay0` → `--pm-text` on hover) shows only when the field is non-empty.

### 5.4 Result Row

- Row: full-width button, flex, gap, padding, radius 7; hover and focus use a `--pm-mantle` background, focus-visible adds the inset ring.
- Icon gutter: rounded square, background the family colour at `--pm-family-tint-alpha`, holding the type's 15×15 icon stroked in the family colour.
- Name: `--pm-text`, single line, ellipsis; for a name match only, the matched run (the first occurrence of the query) `.hl` in `--pm-sky` at weight 750; a body-only match shows no name highlight.
- Body snippet (body matches only): a muted single line beneath the name — `--pm-subtext0` text at the breadcrumb size (`--pm-font-crumb`), ellipsis; matched runs `.hl` in `--pm-sky`.
- Type pill: `--pm-subtext0` text on `--pm-surface0` with a 1px `--pm-surface1` border, right-aligned and non-shrinking.
- Breadcrumb: `--pm-overlay0`, ellipsis; `›` separators in `--pm-surface2`.

### 5.5 Type Toggles

- Grouped by family; each family under a 10/700 `--pm-overlay0` heading above a wrapping row of chips.
- Toggle chip: inline-flex, 11/600, radius 12, a leading family-colour dot at `--pm-dot-idle-alpha`. Default: text `--pm-subtext0`, background `--pm-base`, 1px `--pm-surface1` border. Pressed (`aria-pressed="true"`): text `--pm-text`, border blue at `--pm-toggle-on-border-alpha`, background blue at `--pm-toggle-on-bg-alpha`, and the dot at full opacity.

### 5.6 Filter Zone & Chips

- **Controls row** (`.pm-search__controls`): the scope add button and the Clear button, side by side.
  - **"Narrow by…" add button** (`.pm-search__add`): a leading plus glyph, the label **"Narrow by client, engagement, person…"**, and a trailing chevron that rotates when the drawer is open. The add button *is* the drawer toggle (`aria-expanded` tracks the drawer); there is no separate filter button.
  - **Clear button** (`.pm-search__clear-filters`): the label **"Clear"**, shown only when a scope facet or type toggle is active. Clicking it clears every scope facet and type toggle at once.
- **Active-scope chips bar** (`.pm-search__chips`): a wrapping row directly under the controls. It carries a removable chip per selected scope value (each with its facet-colour dot) and per enabled type (family-colour dot, label, remove control). An inferred chip auto-seeded from the active note prefixes a home glyph (`.pm-search__chip-home`). When no filter is active it shows the empty-state line **"Searching the whole vault. Add a filter to narrow."** (`.pm-search__chips-empty`).
- **Drawer** (`.pm-search__drawer`, open modifier `--open`): a collapsible panel holding, top to bottom, the client / engagement / person scope facets (`.pm-search__facet`, each a `FilterChipSelect` type-ahead) and then the family-grouped type toggles.

### 5.7 Empty States

A centred block: a 22×22 `--pm-overlay0` glyph, a 13/600 `--pm-text` title, and a 12px line. See §3.9 for the exact copy per state.

### 5.8 Reference Screenshots

The interactive prototype captured the panel with the filter drawer collapsed and expanded, the scope add type-ahead, a multi-facet scope, the no-result state, the Dataview-off state, and the type toggles. These live as GitLab upload attachments on the child specs and are **not** mirrored into the repository's `docs/plugin/user-guide/assets/` directory.

<!-- Screenshot placeholders — no local assets exist for the pm-search panel yet.
     When captured, store them under docs/plugin/user-guide/assets/ and embed here:
       pm-search-hero.png            (panel: search box + results, drawer collapsed)
       pm-search-filter-drawer.png   (drawer expanded: type toggles + scope facets)
       pm-search-scope-add.png       (facet type-ahead popover)
       pm-search-empty.png           (no-result state)
       pm-search-dataview-off.png    (Dataview-unavailable state)
     Until then the panel is described in prose above and in the user guide. -->

### 5.9 CSS Class Index

Classes actually emitted by `PmSearchView` / defined in `styles.css`:

| Class | Element |
|-------|---------|
| `.pm-search` | Panel root |
| `.pm-search__cz` | Command zone |
| `.pm-search__input` | Search box container |
| `.pm-search__input-icon` | Leading search glyph |
| `.pm-search__input-field` | Text input |
| `.pm-search__clear` | Clear button (shown when non-empty) |
| `.pm-search__filter-zone` | Filter zone wrapper |
| `.pm-search__controls` | Controls row (add + Clear) |
| `.pm-search__add` | "Narrow by…" scope add button (the drawer toggle) |
| `.pm-search__add-icon` | Add button leading plus glyph |
| `.pm-search__add-label` | Add button label |
| `.pm-search__add-chevron` | Add button chevron |
| `.pm-search__clear-filters` | Clear-all-filters button (shown when a filter is active) |
| `.pm-search__chips` | Active-scope chips bar |
| `.pm-search__chips-empty` | Empty-bar guidance line |
| `.pm-search__chip` | A scope/type chip |
| `.pm-search__chip-dot` | Chip family-colour dot |
| `.pm-search__chip-home` | Inferred (auto-seeded) chip home glyph |
| `.pm-search__chip-label` | Chip label |
| `.pm-search__chip-remove` | Chip remove control |
| `.pm-search__drawer` / `--open` | Collapsible drawer |
| `.pm-search__facet` | One scope facet (client / engagement / person) |
| `.pm-search__facet-label` | Scope facet label |
| `.pm-search__types` | Type-toggle container |
| `.pm-search__type-group` | One family group |
| `.pm-search__type-group-heading` | Family heading |
| `.pm-search__type-row` | Wrapping row of toggles |
| `.pm-search__ttog` | Type toggle chip |
| `.pm-search__ttog-dot` | Toggle family-colour dot |
| `.pm-search__ttog-label` | Toggle label |
| `.pm-search__count` | Count row |
| `.pm-search__results` | Scrolling results area |
| `.pm-search__result` | A result row |
| `.pm-search__result-icon` | Family-tinted icon gutter |
| `.pm-search__result-main` | Name + optional body snippet + breadcrumb column |
| `.pm-search__result-name` | Result name |
| `.hl` | Matched run within the name (name match) or the body snippet (body match) |
| `.pm-search__snippet` | Body-match snippet line (body-derived matches only) |
| `.pm-search__result-type` | Type pill |
| `.pm-search__crumb` | Breadcrumb |
| `.pm-search__crumb-sep` | Breadcrumb `›` separator |
| `.pm-search__empty` | Empty / error state block |
| `.pm-search__empty-icon` | State glyph |
| `.pm-search__empty-title` | State title |
| `.pm-search__empty-line` | State guidance line |

---

## 6. Dependencies & Cross-References

### 6.1 Dataview Plugin

Search requires Dataview. `QueryService.dv()` returns `null` when Dataview is unavailable; `SearchService.search` then returns `[]` and the panel renders the "Search needs Dataview" state rather than throwing. Enumeration reads (`getEntitiesByTag` / `getEntitiesByFolder`) and the `reports-to` walk in `PersonAssociationResolver` all guard against a null accessor.

### 6.2 Relationship-Traversal Spine (PRD-001, PRD-005)

Client and engagement scope and the result breadcrumb reuse `EntityHierarchyService.resolveClientName` / `resolveEngagementName` — the same dual-path traversal the task and reference dashboards use. See PRD-001 §3.5 and `architecture.md` (`EntityHierarchyService`, diagram 08).

### 6.3 Presentation Registry (PRD-003, PRD-004)

`ENTITY_PRESENTATION`, `ENTITY_KINDS`, and `ENTITY_FAMILY_GROUPS` live in `src/entity-registry.ts` alongside the property-editor field schema. The search panel reads only the presentation and family tables.

### 6.4 Settings & Persistence (PRD-007, PRD-009)

`settings.ui.savedSearchFilters` is persisted through the shared `SettingsViewStore` (`ViewStateStore` capability), the same mechanism the Reference Dashboard uses for `referenceDashboardFilters` (PRD-009 §3.8). PRD-007 §4.1 lists the field in the settings schema (shape only).

### 6.5 Shared UI Components

The scope drawer reuses `FilterChipSelect` (which wraps `PropertySuggest`, as wired in the Task Dashboard), not new controls. The bounded type toggles are a compact `aria-pressed` group, not `FilterChipSelect` (which is for unbounded instance lists).

---

## 7. Acceptance Criteria

### Search Substrate

- [x] Ranking scores each candidate over name (tier 0) then body (tier 1): every name match ranks above every body-only match, within each tier an earlier first occurrence of the query ranks first, ties broken alphabetically by name, non-matches excluded
- [x] A candidate whose body contains the query but whose name does not is returned with a body-match snippet
- [x] A candidate whose name contains the query anywhere (including mid-name) is returned, in any letter case
- [x] A candidate whose name holds the query's characters only as a gapped subsequence (not a contiguous run), and whose body does not contain the query, is not returned
- [x] Within the name tier, a name with an earlier occurrence of the query ranks above one with a later occurrence
- [x] An empty or whitespace-only query browses every in-scope entity, sorted by name, without reading any body
- [x] Leading and trailing spaces in the query are ignored; inner spaces are kept, so a multi-word query matches only as one phrase
- [x] A per-note read failure yields no body match for that note and never fails the whole search
- [x] Client scope keeps only candidates that resolve up to a selected client
- [x] Engagement scope keeps only candidates that resolve up to a selected engagement
- [x] Person scope keeps only candidates that involve a selected person — the Person note itself, RAID items they own, meetings they attend (`attendees` / `default-attendees`), and their `reports-to` chain — with no team-members field assumed
- [x] Facets combine OR within a facet and AND across facets; no scope leaves results unconstrained by hierarchy
- [x] `SearchService.search` resolves to `[]` (never rejects) when Dataview is unavailable
- [x] `SearchService` and the ranker carry no `obsidian` import — the body read stays behind `ObsidianContentProvider` — and unit-test headless with a fake matcher and a fake content provider

### Panel

- [x] `PM: Open Search` opens the panel; running it again reveals the existing leaf rather than opening a second one
- [x] A restored `pm-search` leaf renders the real view, not the "plugin has gone away" placeholder
- [x] A ribbon icon opens the panel when `settings.ui.showRibbonIcons` is enabled
- [x] Typing lists matching entities best-first over name and body with matched text highlighted; an empty or whitespace-only query browses without highlighting
- [x] A body-derived match renders a single highlighted snippet line beneath the name
- [x] A name match highlights the first occurrence of the query in the result name
- [x] A body-only match highlights nothing in the result name
- [x] Only the latest query's results are shown — an out-of-order earlier async result does not replace a newer paint
- [x] Each row shows a family-tinted type icon, the name, a Client › Engagement breadcrumb (or "Knowledge base" for a reference with no client/engagement), and a type pill
- [x] Selecting a row opens the corresponding note via `NavigationService.openFile`
- [x] The count row reads "N results", or "—" when Dataview is off
- [x] The no-match, and Dataview-absent states render with the specified copy and the panel does not throw
- [x] The no-match title echoes the trimmed query

### Entity-Type Filter

- [x] Enabling one type restricts results to that type; enabling several includes all of them (OR within the type dimension)
- [x] With no toggle pressed, results include every type
- [x] Each enabled type appears as a chip in the active-scope bar; removing the chip un-presses the toggle, and toggle and chip stay in sync
- [x] Toggle chips are family-grouped with the specified headings, colours, and pressed state, all from the registry

### Hierarchy & Person Scope

- [x] The drawer exposes client / engagement / person facets as searchable multi-add chips (`FilterChipSelect`)
- [x] Adding a client/engagement/person chip narrows results to that facet; multiple chips widen within a facet (OR) and combine across facets (AND)
- [x] On open, the active note's resolved client and engagement are pre-added as inferred scope chips
- [x] Removing a scope chip widens results accordingly

### Persistence

- [x] Type toggles and scope facets persist to `settings.ui.savedSearchFilters` via `SettingsViewStore` and are restored on next open
- [x] Missing `savedSearchFilters` sub-keys default at read time, so a settings upgrade cannot leave a facet `undefined` (two-level `mergeSettings` caveat)

### Styling

- [x] All panel colours and dimensions read central `--pm-*` tokens; no view re-declares hex literals
- [x] Neutral/identity `--pm-*` tokens map to Obsidian theme variables so the panel is theme-adaptive; entity-family colours are fixed accent tokens
- [x] Type label, icon, and family colour for every row, toggle, and chip come solely from `ENTITY_PRESENTATION`

---

## 8. Out of Scope

- Editing, creating, or deleting entities from the panel (it is navigate-only).
- Searching non-entity notes (daily notes, arbitrary Markdown) or attachments.
- Ranking signals beyond first-occurrence position (for example a word-start or shorter-name bonus, recency, frequency, or pinning).
- Typo-tolerant (fuzzy) name matching: a name matches only when it contains the query as written, in any letter case.
- Token-based multi-word matching (each word of the query matched separately): a multi-word query matches only as one phrase.
- *Planned extension, not a non-goal:* highlighting every occurrence of the query. The match contract already carries a list of runs and the panel highlights every run it is given, so this needs only a matcher that reports every occurrence.
- A downward, multi-hop person traversal — the person facet reads only the fields the model records (`owner`, `attendees` / `default-attendees`, `reports-to`, and the Person note itself); there is no team / team-members field.
- Offline / non-Dataview fallback beyond the "Search needs Dataview" state.
- Cross-vault search.
- Generalising the `--pm-*` token layer onto the other dashboards (a separate follow-on initiative).
