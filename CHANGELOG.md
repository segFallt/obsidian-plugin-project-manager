# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- New release sections are prepended by .ci/bump-version.sh -->

## [Unreleased]

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
