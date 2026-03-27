# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- New release sections are prepended by .ci/bump-version.sh -->

## [Unreleased]

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
