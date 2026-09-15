# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- New release sections are prepended by .ci/bump-version.sh -->

## [Unreleased]

### Changed

- Introduced the `IEntityQuery<TItem>` contract (`src/services/entity-query.ts`) — the entity read axis the dashboard shell composes — and extracted `TaskQuery` as its first implementor around the pm-tasks `dv.pages()` scan. The pm-tasks dashboard now resolves its tasks through `IEntityQuery.resolve()` instead of an inline private read, with behaviour unchanged ([#28](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/28)).
- Extracted the "# Notes" section content surgery into a single `src/utils/notes-section.ts` helper (`insertIntoNotesSection` / `extractNotesSection`) that owns the `NOTES_MARKER` branching; the entity-creation, entity-conversion, and test-data services now delegate to it instead of each duplicating the marker format ([#14](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/14)).
- Refactored the entity-creation pipeline around a single `EntityCreationService.materializeEntity` primitive: the test-data generator now reuses the real creation path through a narrow `IEntityMaterializer` interface (with notifications suppressed for bulk generation) instead of duplicating it, and success notices are lifted out of the services layer into an injected `INotificationService` so no `new Notice(...)` remains in `src/services/` ([#12](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/12)).
- Moved the `update-reference-topic` command's inline frontmatter mutation into a reusable `EntityCreationService.setReferenceTopicParent` method that resolves the topic note by its folder path and sets or clears the parent wikilink, leaving the command thin with no direct vault mutation — the last command that called `processFrontMatter` directly ([#13](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/13)).
- Extracted a shared `PromiseModal<T>` base for the field modals, centralising the settle-once promise lifecycle, `onClose` null-resolution, and a pre-settle `onDismiss()` cleanup hook, plus shared button-row and submit/cancel keyboard helpers. The five field modals (input, entity-creation, reference-creation, reference-topic-creation, reference-topic-update) now build on this base, and the input modal's button row was standardised onto the styled `pm-modal-buttons` class. Behaviour is unchanged ([#9](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/9)).
- Relocated the `AutocompleteOption` type from `src/ui/components/property-suggest.ts` to the shared `src/types.ts` hub and repointed all consumers to it, so `src/utils/filter-utils.ts` no longer imports upward into the `ui/` layer; the `filter-chip-select.ts` re-export shim was removed, leaving one canonical source ([#18](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/18)).
- Entity-creation commands are now registered from a shared descriptor table, and the repeated per-command error handling (`try/catch → log → Notice`) is collapsed into a single `withCommandErrorNotice` wrapper reused across all sixteen error-reporting commands. Command IDs, names, modals, and all user-facing messages are unchanged ([#5](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/5)).
- Consolidated the hand-built internal-link anchors across the RAID dashboard, RAID references, recurring events, topic, task-by-project, and context views behind a single shared `createInternalLink` DOM helper, keeping the standard class, `data-href`, and custom click navigation consistent ([#19](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/19)).
- The `ReferenceProcessorServices` object is now built through a single `buildReferenceProcessorServices(plugin)` factory co-located with its interface, instead of hand-maintaining the identical field-for-field literal in both the Reference Dashboard item view and the processor registrar ([#20](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/20)).
- Extracted the hand-rolled debounced-refresh lifecycle (`debounceTimer` + `setTimeout`/`clearTimeout`) into a single shared `debounced(fn, ms)` helper (`src/utils/debounce.ts`) and adopted it across every processor and view that auto-refreshes or throttles input ([#8](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/8)).
- `LoggerService` now accesses the vault adapter through a single typed `IVaultFileAdapter` port, replacing the three divergent inline `as unknown as {...}` casts that were duplicated across its log read/write/list/prune paths. The adapter contract is declared once and cast in one place, mirroring the `CommandExecutor` boundary precedent ([#16](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/16)).

### Fixed

- Fixed the entity-creation path silently discarding injected notes content when a note had no `# Notes` heading; the shared helper now appends a fresh `# Notes` section instead of dropping the body ([#14](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/14)).
- Fixed a latent HTML-injection hazard in internal-note links: several views built anchors by interpolating the raw file name/path into `innerHTML`, so a note whose name contained `<`, `>`, or `&` broke or injected markup. Link text is now set via `textContent`, rendering such names as literal text ([#19](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/19)).
- Fixed a leaked debounce timer in the task dashboard, tasks-by-project, and reference dashboard views: their search-input throttle timer had no teardown path and could fire after the view was torn down. Each view now exposes a `destroy()` that cancels the pending refresh, invoked from its owner (`pm-tasks` processor unload and the Reference Dashboard panel close) ([#8](https://gitlab.n3.pingleberry.com/obsidian/obsidiantemplates-claude-code/-/issues/8)).


## [0.4.1] - 2026-07-06

### Fixed

- Fixed every `pm-actions` button (New Client/Engagement/Project Note/Reference, Open Reference Dashboard, the Set Up Vault settings button, and the Reference Dashboard create buttons) silently doing nothing after the v0.4.0 plugin rename. The button → command wiring built command IDs from a stale `project-manager:` prefix that no longer matched the renamed `manifest.id`. The manifest-id prefix now lives in a single injected place (`CommandExecutor`), and every command ID is sourced from one shared `COMMAND_IDS` registry consumed by both registration and dispatch, so a future rename can never desync them again ([#93](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/93)).

## [0.4.0] - 2026-07-06

### Fixed

- Fixed the phantom "1" project priority: the priority select now prepends a neutral `(none)` option for unset project priority instead of implicitly showing the first option, and completes the priority scale to 1–5 (adds 5 = Someday) so all levels are selectable and reachable in the task priority dashboard ([#84](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/84)).
- Fixed task-checkbox toggles in recurring-event tiles being silently lost — clicking a checkbox in a `pm-recurring-events` tile now persists the change back to the source event note instead of only updating the rendered DOM ([#89](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/89)).

### Added

- `pm-raid-references` now supports header-scoped references — a RAID annotation on a heading pulls in the whole section beneath it; line-scoped references are unchanged ([#90](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/90)).

## [0.3.5] - 2026-04-02

### Added

- Added "+ New Reference" and "+ New Topic" quick-create buttons to the Reference Dashboard panel. "+ New Reference" pre-populates the topic field when a node is selected in the sidebar ([#79](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/79)).
- Migrated `pm-references` Reference Dashboard from a code block processor to a dedicated Obsidian `ItemView` panel (`PM: Open Reference Dashboard` command + ribbon icon), definitively resolving the persistent hierarchical topic nesting problem caused by `.markdown-rendered` CSS interference ([#75](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/75)).
- Filter state (view mode, active chips, selected node) now persists to `plugin.settings.ui.referenceDashboardFilters` in `data.json` instead of note frontmatter, and is restored when the panel is reopened.
- Added `data-depth` attributes to topic tree nodes and nested content groups for CSS depth-indicator styling.

### Changed

- improve(pm-raid-references): remove redundant per-item inline source link; the group heading already renders the file name as a navigable internal link ([#83](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/83)).
- Existing `pm-references` code blocks now render a compact summary card (reference count + "Open Dashboard →" button) instead of the full interactive dashboard.

### Fixed

- fix(pm-raid-references): render annotation line text via `MarkdownRenderer.render()` with the backlink file's path as `sourcePath`, so bold, italic, wikilinks, and inline code in annotated lines render as proper HTML ([#82](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/82)).
- Fixed project priority being stored as a string instead of a number in frontmatter by coercing the select value via `valueType: 'number'` on `FieldDescriptor` ([#81](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/81)).
- Fixed reference card title click doing nothing — now opens the note in a new tab via NavigationService in all three view modes ([#80](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/80)).
- Fixed `EntityService.createReferenceTopic` facade silently dropping the `parentName` argument, causing the `parent` frontmatter field to be absent when creating a reference topic with a selected parent ([#77](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/77)).
- Fixed Reference Dashboard opening in the right-hand sidebar instead of the main editor pane — now uses `workspace.getLeaf('tab')` ([#76](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/76)).
- Fixed "Open Dashboard →" in `pm-references` code blocks not pre-filtering the Reference Dashboard to the current topic; the dashboard now opens with the topic's node pre-selected in the sidebar. Also fixed the summary card reference count to reflect only the filtered topic subset rather than all references ([#78](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/78)).

## [0.3.4] - 2026-03-30

### Fixed

- Hardened `pm-references` CSS nesting: replaced `display: flex` on `<details>.pm-ref-group` with `display: block` to fix a Chromium native disclosure layout quirk that made `margin-left` indentation imperceptible; added `border-left` depth guides to sidebar `.pm-ref-tree__children` and nested content `.pm-ref-group` for two distinct visual signals per hierarchy level; scoped all `.pm-ref-*` rules under `.pm-references` for specificity against Obsidian theme overrides ([#74](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/74)).
- Added unit tests for `client-view-renderer.ts` and `engagement-view-renderer.ts` (sidebar alphabetical list, grouped content, empty state, unassigned group, selected node filtering) and toggle click simulation tests for the topic tree sidebar ([#74](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/74)).

## [0.3.3] - 2026-03-30

### Fixed

- Fixed visually flat topic nesting in `pm-references` sidebar tree by restructuring the DOM: introduced a `pm-ref-tree__item` block wrapper per node so `.pm-ref-tree__children` is a sibling of the flex label row rather than a flex item inside it ([#73](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/73)).

## [0.3.2] - 2026-03-30

### Fixed

- Fixed case-insensitive parent name resolution in `getReferenceTopicTree()` so child topics whose `parent` wikilink uses a different capitalisation than the canonical filename (e.g. `[[kubernetes]]` pointing to `Kubernetes.md`) are correctly nested instead of being promoted to root ([#72](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/72)).

## [0.3.1] - 2026-03-30

### Fixed

- Fixed hierarchical topic tree nesting in `pm-references` sidebar and default content panel, restoring parent–child indentation and nested collapsible groups ([#71](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/71)).

## [0.3.0] - 2026-03-30

### Added

- Added hierarchical parent–child support to Reference Topics: optional `parent` wikilink field in frontmatter, `getReferenceTopicTree()` and `getTopicDescendants()` query methods, `PM: Update Reference Topic` command to assign or clear parent, and updated `PM: Create Reference Topic` to include optional parent selection (`PropertySuggest` with `includeNone: true`) ([#70](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/70)).
- Redesigned `pm-references` dashboard with a two-panel sidebar + content layout: hierarchical topic tree sidebar for By Topic mode, flat client/engagement lists for other modes, and nested collapsible groups in the content panel when a parent node is selected ([#70](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/70)).

## [0.2.5] - 2026-03-29

### Changed

- Replaced static checkbox list and native `<select>` elements in `ReferenceCreationModal` with `FilterChipSelect` type-ahead for topics and `PropertySuggest` for client/engagement fields, bringing the creation dialog in line with the plugin's broader UX conventions ([#69](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/69)).

## [0.2.4] - 2026-03-27

### Added

- Added 8 Mermaid UML architecture diagrams covering service classes, dependency graph, initialization sequence, narrow interface bundles, processor hierarchy, command execution, task pipeline, and entity hierarchy resolution (`docs/plugin/architecture/`) ([#61](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/61)).
- Documented slash command invocation availability and `pm-actions` action-type coverage per command in the commands reference, including an editor-command vs. global-command explainer ([#68](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/68)).

### Changed

- Promoted `resolveClientName` to `IQueryService` and removed the private `resolvePageClient` helper from `QueryService`; `EntityHierarchyService.resolveClientName` now delegates to `queryService.resolveClientName` rather than duplicating the traversal logic ([#60](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/60)).

### Fixed

- Fixed broken image paths in `04-processors/` user guide: all 14 PNG references now correctly resolve via `../assets/` ([#67](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/67)).

## [0.2.3] - 2026-03-27

### Added

- Tasks community plugin declared as a required dependency: startup Notice shown when `obsidian-tasks-plugin` is absent, mirroring the existing Dataview check. Installation guide updated with step-by-step instructions for both dependency plugins ([#66](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/66)).
- Comprehensive user guide covering all 9 code block processors, 16 commands, all settings, all 11 entity types, and 6 end-to-end workflow walkthroughs (`docs/plugin/user-guide/`), with 28 screenshots captured from a live Obsidian instance ([#58](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/58)).

## [0.2.2] - 2026-03-27

### Fixed

- Remove unsupported `--create-tag` flag from `gh release create` in `auto-tag.yml` workflow, fixing pipeline failure on `ubuntu-latest` runner (`gh` implicitly creates the tag from the supplied tag name when the flag is absent).

## [0.2.1] - 2026-03-26

### Changed

- Replaced tag-triggered `release.yml` with self-contained `auto-tag.yml` workflow; GitHub Release is now created independently of GitLab tag mirroring, with the tag and release created atomically after the full quality gate passes.

## [0.2.0] - 2026-03-26

### Added

- RAID log and Reference Dashboard

### Fixed

- various bug squashing
