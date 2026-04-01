# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- New release sections are prepended by .ci/bump-version.sh -->

## [0.3.5-beta.5] - 2026-04-01

### Fixed

- fix(pm-raid-references): render annotation line text via `MarkdownRenderer.render()` with the backlink file's path as `sourcePath`, so bold, italic, wikilinks, and inline code in annotated lines render as proper HTML ([#82](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/82)).

## [0.3.5-beta.4] - 2026-03-31

### Fixed

- Fixed project priority being stored as a string instead of a number in frontmatter by coercing the select value via `valueType: 'number'` on `FieldDescriptor` ([#81](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/81)).

## [0.3.5-beta.3] - 2026-03-31

### Fixed

- Fixed reference card title click doing nothing — now opens the note in a new tab via NavigationService in all three view modes ([#80](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/80)).

## [0.3.5-beta.2] - 2026-03-31

### Added

- Added "+ New Reference" and "+ New Topic" quick-create buttons to the Reference Dashboard panel. "+ New Reference" pre-populates the topic field when a node is selected in the sidebar ([#79](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/79)).

### Fixed

- Fixed `EntityService.createReferenceTopic` facade silently dropping the `parentName` argument, causing the `parent` frontmatter field to be absent when creating a reference topic with a selected parent ([#77](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/77)).
- Fixed Reference Dashboard opening in the right-hand sidebar instead of the main editor pane — now uses `workspace.getLeaf('tab')` ([#76](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/76)).
- Fixed "Open Dashboard →" in `pm-references` code blocks not pre-filtering the Reference Dashboard to the current topic; the dashboard now opens with the topic's node pre-selected in the sidebar. Also fixed the summary card reference count to reflect only the filtered topic subset rather than all references ([#78](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/78)).

## [0.3.5-beta.1] - 2026-03-30

### Added

- Migrated `pm-references` Reference Dashboard from a code block processor to a dedicated Obsidian `ItemView` panel (`PM: Open Reference Dashboard` command + ribbon icon), definitively resolving the persistent hierarchical topic nesting problem caused by `.markdown-rendered` CSS interference ([#75](https://gitlab.n3.pingleberry.com/obsidian/obsidian-plugin-project-manager/-/issues/75)).
- Filter state (view mode, active chips, selected node) now persists to `plugin.settings.ui.referenceDashboardFilters` in `data.json` instead of note frontmatter, and is restored when the panel is reopened.
- Added `data-depth` attributes to topic tree nodes and nested content groups for CSS depth-indicator styling.

### Changed

- Existing `pm-references` code blocks now render a compact summary card (reference count + "Open Dashboard →" button) instead of the full interactive dashboard.

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
