# Architecture

## Three-Layer Architecture

```
Layer 3: Processors & UI   (code block renderers, modals, settings tab)
Layer 2: Commands           (user-facing actions, orchestrate services + modals)
Layer 1: Services & Utils   (pure logic, Dataview API wrapper, independently testable)
```

## Service Dependency Graph

```
main.ts (Plugin)
  ├── settings: PluginSettings
  ├── queryService: QueryService(app, getDataviewApi)
  ├── entityService: EntityService(app, settings, templateService)
  ├── templateService: TemplateService()
  ├── taskParser: TaskParser()
  ├── scaffoldService: VaultScaffoldService(app, settings)
  ├── commands/*   → queryService, entityService, modals
  └── processors/* → queryService, taskParser, UI components
```

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
EntityService                    TaskParser (for task views)
    │                                   │
    ▼                                   ▼
Vault API (create/modify)        UI Components (DOM rendering)
```

## Key Services

### `QueryService` (`src/services/query-service.ts`)
Wraps the Dataview plugin API. Never imported by the plugin directly — obtained via `app.plugins.plugins['dataview'].api`. Returns typed arrays of `DataviewPage` objects.

Key methods:
- `getActiveEntitiesByTag(tag)` — powers entity suggesters in modals
- `getLinkedEntities(folder, tag, property, file)` — powers pm-table relationships
- `getClientFromEngagementLink(link)` — traverses engagement → client chain
- `getParentProject(file)` — resolves project note → parent project

### `EntityService` (`src/services/entity-service.ts`)
Handles all vault file creation. Reads templates from `TemplateService`, resolves path conflicts, creates folders, sets frontmatter via `processFrontMatter`.

**Wikilink frontmatter convention**: Fields that hold wikilinks (e.g. `engagement`, `client`, `convertedFrom`) are never baked into template content via string substitution. Instead they are always set via `processFrontMatter` after file creation. This avoids YAML parsing issues caused by unquoted `[[...]]` sequences in raw template text.

### `TemplateService` (`src/services/template-service.ts`)
Returns embedded template strings for all 8 entity types. Templates use `{{variable}}` placeholders processed by `processTemplate()`. Templates include `pm-*` code blocks instead of Meta Bind syntax.

### `TaskParser` (`src/services/task-parser.ts`)
Regex-based parser for the Tasks plugin emoji format. Does not depend on the Tasks plugin API. Used by `pm-tasks` processor when checkbox state is toggled (to update the source markdown).

## Code Block Processors

All processors follow the same pattern:
1. `registerMarkdownCodeBlockProcessor(language, handler)`
2. Handler instantiates a `MarkdownRenderChild` subclass
3. `render()` parses YAML config via Obsidian's `parseYaml()`
4. Renders DOM components into `containerEl`
5. Error boundary wraps the render call

### `pm-properties`
Reads the current file's frontmatter via `metadataCache`. Renders form fields (inputs, selects, textareas, entity suggesters). Changes persist immediately via `processFrontMatter`. Auto-refreshes on vault `modify` events filtered to the current file (500ms debounce). An `isUpdating` flag suppresses re-render during the component's own writes to prevent infinite loops.

### `pm-table`
Delegates to `QueryService` for data. Renders an HTML `<table>` with Obsidian-style internal links.

### `pm-actions`
Maps `type` strings to plugin command IDs. Calls `app.commands.executeCommandById()` on click.

### `pm-tasks` (dashboard mode)
Filter state is a plain JS object local to the render child — no frontmatter writes. Queries all tasks from `dv.pages()`, applies multi-stage filtering, renders by context/date/priority/tag. Checkbox toggle reads the source file, updates the task line, and writes back via `vault.modify()`.

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
daily notes/
utility/
views/             ← scaffolded view files
```

The scaffold service also creates `.base` files (Obsidian Bases) alongside `.md` view files. `.base` files define named table views with filters, column order, and sort rules. The `.md` view files embed these via `![[Base File.base#view_name]]` and include `pm-actions` buttons for entity creation. Obsidian Bases is a dependency for the entity list views.

## Dataview Dependency

Dataview is checked for at `onLayoutReady` time. If not found, a Notice is shown but the plugin continues to load (commands and non-query processors still work). The `QueryService.dv()` method returns `null` when unavailable, and all methods guard against this.
