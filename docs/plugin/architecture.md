# Architecture

## Three-Layer Architecture

```
Layer 3: Processors & UI   (code block renderers, modals, settings tab)
Layer 2: Commands           (user-facing actions, orchestrate services + modals)
Layer 1: Services & Utils   (pure logic, Dataview API wrapper, independently testable)
```

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
  ├── queryService: QueryService(app, getDataviewApi)
  ├── navigationService: NavigationService(app)
  ├── templateService: TemplateService()
  ├── creationService: EntityCreationService(app, settings, templateService, navigationService)
  ├── conversionService: EntityConversionService(app, settings, creationService)
  ├── entityService: EntityService(creationService, conversionService)  ← thin facade
  ├── scaffoldService: VaultScaffoldService(app, settings)
  ├── taskParser: TaskParser()
  ├── filterService: TaskFilterService(settings.folders)
  ├── sortService: TaskSortService()
  ├── actionContext: ActionContextManager()
  ├── commandExecutor: CommandExecutor(app)
  ├── testDataService: TestDataService(app, settings, templateService, loggerService)
  ├── commands/*   → CommandServices (narrow subset of services)
  └── processors/* → TaskProcessorServices | PropertyProcessorServices | ActionProcessorServices | RaidProcessorServices
```

## Narrow Interface Pattern

Consumers declare only the services they actually need:

| Consumer type         | Interface                   | Key fields                                          |
|-----------------------|-----------------------------|-----------------------------------------------------|
| Command handlers      | `CommandServices`           | app, settings, queryService, entityService, actionContext |
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
Handles all vault file creation. Reads templates from `TemplateService`, resolves path conflicts, creates folders, sets frontmatter via `processFrontMatter`. Delegates navigation to `NavigationService`.

**Wikilink frontmatter convention**: Fields that hold wikilinks (e.g. `engagement`, `client`, `convertedFrom`) are never baked into template content via string substitution. Instead they are always set via `processFrontMatter` after file creation. This avoids YAML parsing issues caused by unquoted `[[...]]` sequences in raw template text.

### `EntityConversionService` (`src/services/entity-conversion-service.ts`)
Handles `convertInboxToProject()` and `convertSingleToRecurring()`. Delegates entity creation to `EntityCreationService`.

### `EntityService` (`src/services/entity-service.ts`)
Thin facade combining `EntityCreationService` and `EntityConversionService`. Maintains backward compatibility for consumers that need both capabilities.

### `NavigationService` (`src/services/navigation-service.ts`)
Encapsulates `workspace.getLeaf().openFile(file)`. Extracted from `EntityService` to satisfy SRP and enable isolated testing.

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
- `resolveClientName(page)` — dual-path client resolution: direct `page.client` field or `getEngagementNameForPath → getClientFromEngagementLink` chain (covers direct engagement, `relatedProject → project.engagement`, and `recurring-meeting-event → meeting.engagement`)

### `EntityHierarchyService` (`src/services/entity-hierarchy-service.ts`)
Canonical resolver for entity hierarchy (client and engagement) from a `DataviewPage`. All consumers — RAID dashboard, task filter, reference views — should use this service rather than calling `QueryService` primitive methods directly.

- `resolveClientName(page)` — delegates to `queryService.resolveClientName(page)`. `QueryService` owns the traversal logic; `EntityHierarchyService` provides the stable, interface-level entry point for all higher-layer consumers.
- `resolveEngagementName(page)` — delegates to `queryService.getEngagementNameForPath(page.file.path)`.

### `TemplateService` (`src/services/template-service.ts`)
Returns template strings for all 9 entity types via a static lookup map. Template strings are defined as named exports in `src/services/template-constants.ts`. Templates use `{{variable}}` placeholders processed by `processTemplate()`.

### `TaskFilterService` / `TaskSortService` (`src/services/task-filter-service.ts`, `task-sort-service.ts`)
Injected into `TaskProcessorServices`. Previously constructed inline inside processors (DIP violation); now wired in `main.ts` and injected.

### `TaskParser` (`src/services/task-parser.ts`)
Regex-based parser for the Tasks plugin emoji format. Does not depend on the Tasks plugin API. Used by `pm-tasks` processor when checkbox state is toggled.

### `TestDataService` (`src/services/test-data-service.ts`)
Generates realistic sample vault data for development and demo purposes. All generated files are prefixed with `[TEST]` for easy identification. Accessible via **Settings → Developer Tools**.

- `generateTestData()` — creates 90 files (10 per entity type) in parent-first order so all foreign-key wikilinks reference already-created entities. Each file gets 5 tasks injected under its `# Notes` heading, with 2 past and 3 future due dates. Returns `{ totalFiles, totalTasks, errors }`.
- `cleanTestData()` — deletes all vault files whose basename starts with `[TEST]`. Returns count deleted.

Name pools and task descriptions live in `src/services/test-data-constants.ts`. Entity generation order: Clients → People, Engagements → Projects, Inbox, Single Meetings, Recurring Meetings → Project Notes, Recurring Meeting Events.

## Code Block Processors

All processors follow the same pattern:
1. `registerMarkdownCodeBlockProcessor(language, handler)`
2. Handler instantiates a `MarkdownRenderChild` subclass
3. `render()` parses YAML config via Obsidian's `parseYaml()`
4. Renders DOM components into `containerEl`
5. Error boundary wraps the render call

### `pm-properties`
Reads the current file's frontmatter via `metadataCache`. Renders form fields via `renderField()` (in `property-field-renderers.ts`). Field type configuration lives in `entity-field-config.ts`. Changes persist immediately via `processFrontMatter`. Auto-refreshes on vault `modify` events (500ms debounce). An `isUpdating` flag suppresses re-render during the component's own writes to prevent infinite loops.

### `pm-table`
Delegates to `QueryService` for data. Renders an HTML `<table>` with Obsidian-style internal links.

### `pm-actions`
Maps `type` strings to plugin command IDs. Calls `commandExecutor.executeCommandById()` on click. Sets `actionContext` when an action button carries a `context` field, so the invoked command can skip its selection modal and use the pre-selected value.

### `pm-tasks` (dashboard mode)
Filter state is a plain JS object local to the render child — no frontmatter writes. Queries all tasks from `dv.pages()`, applies multi-stage filtering via `TaskFilterService`, then delegates to one of four view renderers in `src/processors/dashboard-views/`:

- `ContextViewRenderer` — groups by context (Project / Person / Meeting / Inbox / etc.)
- `DateViewRenderer` — groups into Overdue / Today / Tomorrow / This Week / Upcoming / No Date
- `PriorityViewRenderer` — groups by priority level 1–4 (Urgent → Low)
- `TagViewRenderer` — groups by tag, Untagged last

Checkbox toggle reads the source file, updates the task line, and writes back via `vault.modify()`.

### `pm-raid-references`
Placed in each RAID item note. Uses `dv.pages("[[" + currentFile.basename + "]]")` to find all vault files that link to the current RAID item. For each backlink file, reads raw content via `vault.read()` and scans for lines containing the `{raid:(positive|negative|neutral)}[[ItemName]]` annotation pattern. Renders a grouped list of tagged lines with directional badges and source note links.

### `pm-raid-dashboard`
Renders a Likelihood × Impact heat-map matrix summary plus RAID items grouped by type (Risk / Assumption / Issue / Decision). Filter state is a plain JS object local to the render child — no frontmatter writes. Queries all `#raid` tagged pages via `QueryService`. Supports filtering by RAID type, status, client, engagement, and matrix cell selection.

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
