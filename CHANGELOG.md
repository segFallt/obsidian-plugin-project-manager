# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- New release sections are prepended by .ci/bump-version.sh -->

## [Unreleased]

### Changed

- Replaced tag-triggered `release.yml` with self-contained `auto-tag.yml` workflow; GitHub Release is now created independently of GitLab tag mirroring, with the tag and release created atomically after the full quality gate passes.

## [0.2.0] - 2026-03-26

### Added

- RAID log and Reference Dashboard

### Fixed

- various bug squashing
