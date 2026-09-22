# Architecture

## Three-Layer Architecture

```
Layer 3: Processors, Views & UI   (code block renderers, ItemView panels, modals, settings tab)
Layer 2: Commands                  (user-facing actions, orchestrate services + modals)
Layer 1: Services & Utils          (pure logic, Dataview API wrapper, independently testable)
```

### Layer 3 Components

- **`src/processors/`** — Markdown code block processors (e.g. `pm-tasks`, `pm-references`, `pm-properties`). Each processor is a `MarkdownRenderChild` subclass that renders into `containerEl` inside `.markdown-rendered`.
- **`src/views/`** — Obsidian `ItemView` panels. These render into `contentEl` which lives entirely outside `.markdown-rendered`, eliminating note-level CSS interference. Currently contains:
  - `ReferenceDashboardItemView` (`pm-reference-dashboard`) — the note-less side-panel host (a `DashboardItemViewHost` subclass) for the `ReferenceDashboardView` component, which runs on the shared dashboard shell. Filter state is persisted to plugin settings (via `SettingsViewStore`) instead of note frontmatter.
- **`src/ui/`** — Reusable UI components (e.g. `FilterChipSelect`, `PropertySuggest`) consumed by processors, views, and modals.

## Detailed UML Diagrams

Mermaid diagrams for deep structural reference, located in [`docs/plugin/architecture/`](architecture/):

| Diagram | Description |
|---------|-------------|
| [01 — Service Class Diagram](architecture/01-service-class-diagram.md) | All service interfaces and their implementations |
| [02 — Service Dependency Graph](architecture/02-service-dependency-graph.md) | Directed dependency graph across all service classes |
| [03 — Plugin Initialization Sequence](architecture/03-plugin-initialization-sequence.md) | `onload()` → `initServices()` → `registerAllCommands()` → `registerAllProcessors()` |
| [04 — Narrow Interface Bundles](architecture/04-narrow-interface-bundles.md) | ISP narrow-interface pattern and consumer mapping |
| [05 — Processor Class Hierarchy](architecture/05-processor-class-hierarchy.md) | All processors, their base class, and view-class compositions |
| [06 — Command Execution Sequence](architecture/06-command-execution-sequence.md) | End-to-end `CreateProjectCommand` execution traced |
| [07 — Task Processing Pipeline](architecture/07-task-processing-pipeline.md) | `pm-tasks` dashboard data flow and filter persistence loop |
| [08 — Entity Hierarchy Resolution](architecture/08-entity-hierarchy-resolution.md) | Dual-path client/engagement resolution logic |

## Service Dependency Graph

```
main.ts (Plugin)
  ├── queryService: QueryService(getDataviewApi, settings.folders)
  ├── hierarchyService: EntityHierarchyService(getDataviewApi, settings.folders)
  ├── navigationService: NavigationService(app)
  ├── notificationService: NotificationService()  ← INotificationService (Notice wrapper)
  ├── templateService: TemplateService()
  ├── creationService: EntityCreationService(app, settings, templateService, navigationService, notificationService)
  ├── conversionService: EntityConversionService(app, settings, creationService)
  ├── entityService: EntityService(creationService, conversionService)  ← thin facade
  ├── scaffoldService: VaultScaffoldService(app, settings, notificationService)
  ├── taskParser: TaskParser()
  ├── filterService: TaskFilterService(settings.folders)
  ├── sortService: TaskSortService()
  ├── actionContext: ActionContextManager()
  ├── commandExecutor: CommandExecutor(app)
  ├── testDataService: TestDataService(app, settings, creationService as IEntityMaterializer, loggerService)
  ├── commands/*   → CommandServices (narrow subset of services)
  └── processors/* → TaskProcessorServices | PropertyProcessorServices | ActionProcessorServices | RaidProcessorServices | ReferenceProcessorServices
```

> **Entity read axis.** The pm-tasks dashboard does not read Dataview directly; it resolves its data through the `IEntityQuery<TItem>` contract (`src/services/entity-query.ts`), with `TaskQuery` built per-block in the pm-tasks processor. This is the read primitive the dashboard shell composes — `TaskQuery`, `RaidQuery`, and `RefQuery` all implement the same one-`resolve()` contract, one per entity type. `RefQuery` additionally owns the reference-topic tree derivation the topic view renders from.

> **View-render axis.** The pluggable "body" a dashboard renders is an `IViewRenderer<TItem>` (`src/processors/view-renderer.ts`): a read-pure renderer given a `ViewRenderContext` (already-filtered items + precomputed lookups + an `onFilterChange` hook), optionally declaring the filter facet it `ownsFacet`. The four pm-tasks views are the first implementors; the shell selects and drives them without touching Dataview.

## Narrow Interface Pattern

Consumers declare only the services they actually need:

| Consumer type         | Interface                   | Key fields                                          |
|-----------------------|-----------------------------|-----------------------------------------------------|
| Command handlers      | `CommandServices`           | app, settings, queryService, entityService, hierarchyService, actionContext |
| Task processors       | `TaskProcessorServices`     | app, settings, queryService, taskParser, filterService, sortService |
| Property processors   | `PropertyProcessorServices` | app, settings, queryService, loggerService          |
| Action processors     | `ActionProcessorServices`   | app, settings, commandExecutor, actionContext        |
| Scaffold commands     | `ScaffoldCommandServices`   | scaffoldService, loggerService                      |
| RAID processors       | `RaidProcessorServices`     | app, settings, queryService, loggerService          |

`PluginServices` (the superset) is used only in `main.ts` for wiring and in test helpers.

## Data Flow

```
User Action (command palette / button click / note render)
    │
    ▼
Command (orchestration) ─── or ─── Code Block Processor (on render)
    │                                   │
    ▼                                   ▼
Modal (user input)               QueryService (wraps Dataview API)
    │                                   │
    ▼                                   ▼
EntityCreationService            TaskParser (for task views)
    │                                   │
    ▼                                   ▼
NavigationService                UI Components (DOM rendering)
    │
    ▼
Vault API (create/modify)
```

## Key Services

### `EntityCreationService` (`src/services/entity-creation-service.ts`)
Handles all vault file creation. Reads templates from `TemplateService`, resolves path conflicts, creates folders, sets frontmatter via `processFrontMatter`. Delegates navigation to `NavigationService` and success notifications to `NotificationService`.

The `materializeEntity(type, name, folder, options)` primitive owns the folder/template/notification policy for a single note. Its options — `extraVars`, `contentTransform`, `frontmatter`, `notice`, and `open` — gate each optional step. `createEntity()` is a thin wrapper (notice on), and `TestDataService` reuses the same primitive through the narrow `IEntityMaterializer` interface with notifications suppressed. This keeps a single creation pipeline instead of duplicating it in the test-data generator.

**Wikilink frontmatter convention**: Fields that hold wikilinks (e.g. `engagement`, `client`, `convertedFrom`) are never baked into template content via string substitution. Instead they are always set via `processFrontMatter` after file creation. This avoids YAML parsing issues caused by unquoted `[[...]]` sequences in raw template text.

### `EntityConversionService` (`src/services/entity-conversion-service.ts`)
Handles `convertInboxToProject()` and `convertSingleToRecurring()`. Delegates entity creation to `EntityCreationService`.

### `EntityService` (`src/services/entity-service.ts`)
Thin facade combining `EntityCreationService` and `EntityConversionService`. Maintains backward compatibility for consumers that need both capabilities.

### `NavigationService` (`src/services/navigation-service.ts`)
Encapsulates `workspace.getLeaf().openFile(file)`. Extracted from `EntityService` to satisfy SRP and enable isolated testing.

### `NotificationService` (`src/services/notification-service.ts`)
Thin wrapper over Obsidian's `Notice`, injected as `INotificationService` so the services layer signals user-facing messages without constructing UI directly. Consumed by `EntityCreationService` (success notices) and `VaultScaffoldService` (scaffold-complete notice); no `new Notice(...)` remains in `src/services/`.

### `ActionContextManager` (`src/services/action-context-manager.ts`)
Replaces the former mutable `pendingActionContext` field on `PluginServices`. Provides `set()`, `get()`, and `consume()` (read-and-clear) for passing a pre-selected entity context from an action button click to the subsequent command invocation.

### `CommandExecutor` (`src/services/command-executor.ts`)
Encapsulates the unsafe `(app as any).commands.executeCommandById()` cast. Provides a typed `ICommandExecutor` interface so consumers never touch the internal Obsidian command API directly.

### `QueryService` (`src/services/query-service.ts`)
Wraps the Dataview plugin API. Returns typed arrays of `DataviewPage` objects.

Key methods:
- `getActiveEntitiesByTag(tag)` — powers entity suggesters in modals
- `getLinkedEntities(folder, tag, property, file)` — powers pm-table relationships
- `getProjectNotes(file)` — resolves project-note files linked to a project
- `getActiveRecurringMeetings()` — folders-based query for recurring meeting files

Implements the narrow `IEntityQueryService` interface. Hierarchy resolution (client/engagement traversal) is **not** here — it lives in `EntityHierarchyService`.

### `EntityHierarchyService` (`src/services/entity-hierarchy-service.ts`)
Canonical resolver for entity hierarchy (client and engagement) from a `DataviewPage`. All consumers — RAID dashboard, task filter, reference views — use this service. It reads Dataview (via a lazy `getDv()` accessor) and the folder settings directly; it owns the traversal outright rather than delegating.

- `resolveClientName(page)` — dual-path client resolution: (1) direct `page.client` field; (2) `getEngagementNameForPath → getClientFromEngagementLink` chain (covers direct engagement, `relatedProject → project.engagement`, and `recurring-meeting-event → meeting.engagement`); (3) parent-project fallback — a project note whose parent project carries a direct client recurses on the parent project page.
- `resolveEngagementName(page)` — runs `getEngagementNameForPath(page.file.path)`.
- `getEngagementForEntity` / `getClientForEntity` / `getParentProject` / `getEngagementNameForPath` / `getClientFromEngagementLink` — the underlying traversal primitives (class methods, off the narrow interface).

### `TemplateService` (`src/services/template-service.ts`)
Returns template strings for all 9 entity types via a static lookup map. Template strings are defined as named exports in `src/services/template-constants.ts`. Templates use `{{variable}}` placeholders processed by `processTemplate()`.

### `TaskFilterService` / `TaskSortService` (`src/services/task-filter-service.ts`, `task-sort-service.ts`)
Injected into `TaskProcessorServices`. Previously constructed inline inside processors (DIP violation); now wired in `main.ts` and injected.

`TaskFilterService`'s matching logic is decomposed into a generic, dependency-free **Filter capability** (`src/services/filter-engine.ts`): a `FilterEngine.apply(items, spec, state)` pure function driven by a static `FilterSpec` (a catalog of keyed `Facet`s — each an `accessor` or a closure-captured `predicate`, with an optional `appliesWhen(viewMode)` view-gate) and a dynamic `FilterState` (`selections` + `viewMode`). Any per-facet dependency (`dv`, `hierarchyService`, `folders`) is captured in the predicate closure, so the engine touches none. Facets are addressable by key, and `spec.specWithout(key)` yields a reduced catalog — the dashboard shell uses this to compute all-other-facet counts for an interactive renderer that declares `ownsFacet` (e.g. the RAID matrix). The public `TaskFilterService` methods are thin adapters that build the task spec/state and delegate to the engine, so the API surface is unchanged.

### `TaskParser` (`src/services/task-parser.ts`)
Regex-based parser for the Tasks plugin emoji format. Does not depend on the Tasks plugin API. Used by `pm-tasks` processor when checkbox state is toggled.

### `TestDataService` (`src/services/test-data-service.ts`)
Generates realistic sample vault data for development and demo purposes. All generated files are prefixed with `[TEST]` for easy identification. Accessible via **Settings → Developer Tools**.

- `generateTestData()` — creates 90 files (10 per entity type) in parent-first order so all foreign-key wikilinks reference already-created entities. Each file gets 5 tasks injected under its `# Notes` heading, with 2 past and 3 future due dates. Returns `{ totalFiles, totalTasks, errors }`.
- `cleanTestData()` — deletes all vault files whose basename starts with `[TEST]`. Returns count deleted.

Generation routes every file through `EntityCreationService.materializeEntity` (via the narrow `IEntityMaterializer` interface) with notifications suppressed, injecting the demo task block through the `contentTransform` option rather than duplicating the creation pipeline.

Name pools and task descriptions live in `src/services/test-data-constants.ts`. Entity generation order: Clients → People, Engagements → Projects, Inbox, Single Meetings, Recurring Meetings → Project Notes, Recurring Meeting Events.

## Code Block Processors

All processors follow the same pattern:
1. `registerMarkdownCodeBlockProcessor(language, handler)`
2. Handler instantiates a `MarkdownRenderChild` subclass
3. `render()` parses YAML config via Obsidian's `parseYaml()`
4. Renders DOM components into `containerEl`
5. Error boundary wraps the render call

### `pm-properties`
Reads the current file's frontmatter via `metadataCache`. Renders form fields via `renderField()` (in `property-field-renderers.ts`). Field type configuration lives in `entity-field-config.ts`. Changes persist immediately via `processFrontMatter`. Auto-refreshes on vault `modify` events (500ms debounce). An `isUpdating` flag suppresses re-render during the component's own writes to prevent infinite loops. The editor is fully entity-agnostic: entity-specific field side-effects are co-located with each entity's field schema as an `ENTITY_FIELD_HOOKS` `onFieldChange` (e.g. the RAID item auto-sets/clears `closed-date` on a status change), which the editor dispatches generically — it never branches on entity type.

### Entity registry (`entity-registry.ts`)
One thin identity catalog and one query registry, both keyed by the existing `EntityType`. `ENTITY_KINDS` maps each kind to its optional Dataview tag, optional default folder, and field schema (the three underlying key-sets — `EntityType`, `ENTITY_TAGS`, `DEFAULT_FOLDERS` — do not align, so this catalog is the one reconciling map). `ENTITY_QUERIES` (an `EntityQueryRegistry`) is a **runtime-populated factory table** — a kind resolves to a freshly built `IEntityQuery` given a live Dataview accessor, never a static import-time instance — populated during init by back-filling the shipped `RaidQuery`/`RefQuery`. It is `Partial`-tolerant: an unregistered kind resolves to `null`, so a generic by-kind consumer never breaks while the migration is in flight.

### `pm-table`
Delegates to `QueryService` for data. Renders an HTML `<table>` with Obsidian-style internal links.

### `pm-actions`
Maps `type` strings to plugin command IDs. Calls `commandExecutor.executeCommandById()` on click. Sets `actionContext` when an action button carries a `context` field, so the invoked command can skip its selection modal and use the pre-selected value.

### `pm-tasks` (dashboard mode)
Filter state now persists via the `ViewStateStore` abstraction (`src/processors/view-state-store.ts`) — the note-bound `FrontmatterViewStore` writes the state under a **per-block** `pm-view-state.<blockKey>` frontmatter key, where `blockKey` is an explicit `id:` in the block YAML or a hash of the block source, so multiple pm-tasks blocks in one note keep independent state. A legacy flat `pm-tasks-filters` value is migrated forward (copy-not-delete) into the per-block entry on first load, leaving the legacy key as a read-only fallback so no block resets. The generic `DashboardRenderChild` (`src/processors/dashboard-render-child.ts`) owns the Obsidian lifecycle: it debounces auto-refresh on vault edits and consults `store.isOwnWrite` to skip its own write-echo (replacing the former `isUpdating` time-window flag). Data-flow orchestration lives in the lifecycle-free, Obsidian-free `DashboardShell` POJO (`src/processors/dashboard-shell.ts`): it resolves tasks through the entity read axis `IEntityQuery<TItem>` (`src/services/entity-query.ts`) — `TaskQuery` wraps the utility-excluded `dv.pages()` scan and is the first implementor of the contract the shell composes (RAID/Reference queries join it later) — applies the spec-driven `FilterEngine`, then delegates to one of four **read-pure** view renderers — each implementing `IViewRenderer<TItem>` (`src/processors/view-renderer.ts`) — in `src/processors/dashboard-views/`. The dashboard pre-resolves every Dataview read into a `ViewRenderContext`: the filtered items, the sort context/mtime maps, and a parent-path map plus a display-name map (which replace `ContextViewRenderer`'s former `dv` reads), so the renderers draw only from their context and never touch `dv`:

- `ContextViewRenderer` — groups by context (Project / Person / Meeting / Inbox / etc.)
- `DateViewRenderer` — groups into Overdue / Today / Tomorrow / This Week / Upcoming / No Date
- `PriorityViewRenderer` — groups by priority level 1–4 (Urgent → Low)
- `TagViewRenderer` — groups by tag, Untagged last

An `IViewRenderer` may declare `ownsFacet` (an interactive renderer naming the single filter facet it drives) and receive an `onFilterChange` callback; the four task views are passive and declare neither. This is the render axis the dashboard shell composes alongside the entity-read axis.

Checkbox toggle reads the source file, updates the task line, and writes back via `vault.modify()`.

### `pm-raid-references`
Placed in each RAID item note. Uses `dv.pages("[[" + currentFile.basename + "]]")` to find all vault files that link to the current RAID item. For each backlink file, reads raw content via `vault.read()` and scans for lines containing the `{raid:(positive|negative|neutral)}[[ItemName]]` annotation pattern. Renders a grouped list of tagged lines with directional badges and source note links. Each `<li>` uses a two-row layout: badge and source link on the first row; annotation line text rendered via `MarkdownRenderer.render()` as a block below (only when non-empty). The backlink file's path is passed as `sourcePath` so wikilinks in annotation text resolve relative to the annotating note, not the RAID item.

### `pm-raid-dashboard`
Renders a Likelihood × Impact heat-map matrix summary plus RAID items grouped by type (Risk / Assumption / Issue / Decision), supporting filtering by RAID type, status, client, engagement, and matrix cell selection. It runs on the **same capability spine as `pm-tasks`**: the former 512-line `PmRaidDashboardRenderChild` god-class is dissolved into small implementors behind the shell's interfaces.

- **Read** — `RaidQuery` (`src/services/raid-query.ts`) implements `IEntityQuery<DataviewPage>` as a pure base read of the `#raid` pages sorted by raised-date. (`QueryService.getAllRaidItems` was removed — the dashboard was its only caller.)
- **Filter** — a RAID `FilterSpec` (`src/services/raid-filter.ts`) over the shared `FilterEngine`: keyed facets for type/status/search/matrix-cell plus captured-predicate facets for client/engagement that resolve names via `IEntityHierarchyService`.
- **Render** — a single composite `RaidDashboardRenderer` (`src/processors/raid-views/`) the shell dispatches, composing the **interactive** `RaidMatrixRenderer` and the passive `RaidItemGroupRenderer` (count strip + grouped tables). The matrix declares `ownsFacet = "matrixCell"`, so the shell feeds it `ctx.facetItems` (the set filtered by every facet *except* the matrix cell); a cell click emits `onFilterChange({ matrixCell })` and the renderers stay read-pure.
- **Host & persistence** — hosted by the generic `DashboardRenderChild` (preserving `MarkdownRenderChild` registration + the error boundary). Filter state persists through the `ViewStateStore` (`FrontmatterViewStore`) under the existing `pm-raid-dashboard-filters` frontmatter key. Only the durable subset (`raidTypes`/`statusFilter`/`clientFilter`/`engagementFilter`) is saved — `searchText` and `matrixCell` stay ephemeral, enforced by the `SavedRaidDashboardFilters` type passed to `save`.

> **Deliberate change:** a selected matrix cell now keeps the *other* cells' counts (computed over `ctx.facetItems`) instead of zeroing them.

### `pm-references` / Reference Dashboard
The `pm-references` code block renders a compact **summary card** (reference count + "Open Dashboard" button); the full dashboard lives in the note-less `ReferenceDashboardItemView` side-panel. Both run on the **same capability spine as `pm-tasks` / RAID**, and the dashboard is a genuine **multi-mode** view (topic / client / engagement) that uses the shell's `views[mode]` dispatch.

- **Read** — `RefQuery` (`src/services/ref-query.ts`) implements `IEntityQuery<DataviewPage>` as a pure base read of the `#reference` pages, and additionally owns the reference-topic tree derivation (`getReferenceTopicTree` / `getTopicDescendants`, moved off `QueryService` — the dashboard was their only caller, so `getReferences`/`getReferencesByTopic` were removed).
- **Filter** — a reference `FilterSpec` (`src/services/reference-filter.ts`) over the shared `FilterEngine`: a keyed search facet plus captured-predicate facets for topics (normalized-name intersection), clients (resolved via `IEntityHierarchyService`), and engagements. `selectedNode` is **not** a facet (it is renderer scoping/display state) and `viewMode` selects the renderer.
- **Render** — three renderers the shell dispatches by `viewMode` (`src/processors/reference-views/`): `TopicViewRenderer` (sidebar tree + nested groups) and a single `FlatGroupedViewRenderer` instantiated twice (client / engagement), differing only in the name each resolves. All are read-pure `IViewRenderer`s: the sidebars build from the **unfiltered** node-set supplied via `ctx.helpers` (topic tree + all references), the content groups from the already-filtered `ctx.items`, and a node click emits `onFilterChange({ selectedNode })`. Shared card/group/empty-state DOM lives in `reference-card-renderer.ts`.
- **Host & persistence** — hosted by the generic `DashboardItemViewHost` (the note-less ItemView twin of `DashboardRenderChild`; registers no vault-modify listener). Filter state persists through the `ViewStateStore` (`SettingsViewStore`) under `settings.ui.referenceDashboardFilters`. Only the durable subset (`viewMode`/`topics`/`clients`/`engagements`/`selectedNode`) is saved — `searchText` stays ephemeral, enforced by the `SavedReferenceFilters` type. The summary-card processor routes its `selectedNode` pre-selection through the **same** store key (read-modify-write) so the two writers never race.

### `MarkdownPostProcessor` — RAID Badge Renderer
Registered via `registerMarkdownPostProcessor` (not a code block processor). Scans rendered HTML for `{raid:(positive|negative|neutral)}` text nodes adjacent to internal wikilinks, resolves the linked RAID item's type from `metadataCache`, and replaces the pair with a styled `<span class="raid-badge">` + preserved link. Direction is mapped to a type-specific label (e.g. `positive` + Risk → "Mitigates").

## Architecture Decision Notes

### Why a facade for `EntityService`?
`EntityService` is retained as a single entry point for backward-compatibility with tests and consumers that need both creation and conversion. Internally it delegates to `EntityCreationService` and `EntityConversionService` so each sub-service has a single responsibility.

### Why narrow interfaces instead of a service locator?
Narrow interfaces (ISP) make dependencies explicit at the call site, improve IDE discoverability, and allow unit tests to provide only the subset of services a processor actually needs — reducing mock boilerplate.

### Why `ActionContextManager` instead of mutable state?
The former `pendingActionContext` on `PluginServices` was a shared mutable field — fragile under concurrent commands and invisible to type-checking. `ActionContextManager.consume()` provides explicit, one-shot read-and-clear semantics, making the data flow auditable.

### Why `CommandExecutor`?
`app.commands.executeCommandById` is not in Obsidian's public TypeScript types, requiring an unsafe cast at every call site. `CommandExecutor` isolates the cast to one place and exposes a typed `ICommandExecutor` interface.

### Why a `ViewStateStore` capability?
Dashboard filter-state persistence is a genuine variation point with two real implementors — note-bound code-block dashboards (pm-tasks, RAID) persist to their host note's frontmatter, while the note-less References side-panel persists to plugin settings. The `ViewStateStore` interface (`src/processors/view-state-store.ts`) captures the one narrow `load(key)`/`save(key, state)` contract; `FrontmatterViewStore` (over a minimal `FrontmatterIO` port, `src/processors/frontmatter-io.ts`) and `SettingsViewStore` are its adapters. The frontmatter adapter recognises its own writes **by value** — a one-shot pending-echo consume with a canonical serialization that normalizes `[]`/`null`/absent as equivalent (Obsidian coerces empty frontmatter arrays to `null` on write) — replacing each render child's time-window `isUpdating` flag, and funnels all per-note writes through a shared per-file serializer so sibling per-block sub-keys are never clobbered. The store is key-agnostic: a caller may persist under a flat key (`pm-tasks-filters`), a nested per-block key (`pm-view-state.<blockKey>`), or a settings dot-path (`referenceDashboardFilters`). The note-less `SettingsViewStore` adapter needs no echo suppression (settings writes raise no metadata-cache event) and backs the References dashboard; the summary-card processor shares its key via read-modify-write so the two writers never race.

## Vault Folder Structure

Default folder layout (all paths configurable via Settings → Folder Paths):

```
clients/
engagements/
projects/
projects/notes/
people/
inbox/
meetings/
  single/          ← single meeting notes
  recurring/       ← recurring meeting notes
raid/              ← RAID item notes (#raid tag)
daily notes/
utility/
views/             ← scaffolded view files (includes views/RAID.md)
```

The scaffold service also creates `.base` files (Obsidian Bases) alongside `.md` view files. `.base` file content is defined in `src/services/scaffold-constants.ts`. `.md` view files embed these via `![[Base File.base#view_name]]` and include `pm-actions` buttons for entity creation. Obsidian Bases is a dependency for the entity list views.

## Dataview Dependency

Dataview is checked for at `onLayoutReady` time. If not found, a Notice is shown but the plugin continues to load (commands and non-query processors still work). The `QueryService.dv()` method returns `null` when unavailable, and all methods guard against this.

## Tasks Plugin Dependency

The Tasks community plugin (`obsidian-tasks-plugin`) is a required dependency for structured task authoring. The plugin checks for its presence at `onLayoutReady`; if absent, a Notice is shown but the plugin continues to load. `TaskParser` parses the Tasks emoji format (due dates, priority emojis, completion markers) via regex — no Tasks plugin API calls are made. Task date and priority data will be absent from `pm-tasks` output when the Tasks plugin is not installed.
