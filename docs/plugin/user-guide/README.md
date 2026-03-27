# Project Manager Plugin — User Guide

Project Manager is an Obsidian plugin that turns your vault into a structured project management workspace. It introduces a client → engagement → project hierarchy, a RAID tracker, a task dashboard, and a reference knowledge base — all built on standard Obsidian notes and frontmatter.

---

## Contents

| # | Section | What it covers |
|---|---------|----------------|
| 1 | [Getting Started](01-getting-started.md) | Installation, vault setup, folder structure, entity overview |
| 2 | [Settings Reference](02-settings-reference.md) | Every setting explained |
| 3 | [Commands Reference](03-commands-reference.md) | All 16 commands with pre-conditions and modal flows |
| 4 | [Code Block Processors](04-processors/) | Detailed reference for all 9 `pm-*` code blocks |
| 5 | [Entity Templates](05-entity-templates.md) | Standard note structure for each of the 11 entity types |
| 6 | [Workflows](06-workflows.md) | End-to-end walkthroughs of common multi-step operations |

---

## Code Block Processors

| Processor | Purpose |
|-----------|---------|
| [`pm-properties`](04-processors/pm-properties.md) | Inline frontmatter editor — edit entity fields without touching raw YAML |
| [`pm-table`](04-processors/pm-table.md) | Relationship table — lists entities linked to the current note |
| [`pm-actions`](04-processors/pm-actions.md) | Action buttons — trigger creation commands from any note |
| [`pm-entity-view`](04-processors/pm-entity-view.md) | Combined section — heading + action button + relationship table in one block |
| [`pm-tasks`](04-processors/pm-tasks.md) | Task dashboard — filterable, sortable view of all vault tasks |
| [`pm-recurring-events`](04-processors/pm-recurring-events.md) | Recurring meeting events — chronological tile grid of all event instances |
| [`pm-raid-references`](04-processors/pm-raid-references.md) | RAID references — lists notes that annotate the current RAID item |
| [`pm-raid-dashboard`](04-processors/pm-raid-dashboard.md) | RAID dashboard — heat-map matrix, count strip, and item tables |
| [`pm-references`](04-processors/pm-references.md) | Reference library — filterable view of all reference documents |

---

## Quick Start

1. Install the plugin and enable it in **Settings → Community Plugins**
2. Open the command palette and run **PM: Set Up Vault Structure** — this creates all required folders and default view files
3. Create your first client with **PM: Create Client**
4. See [Getting Started](01-getting-started.md) for a full walkthrough
