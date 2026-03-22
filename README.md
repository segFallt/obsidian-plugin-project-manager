# Project Manager — Obsidian Plugin

A first-class Obsidian plugin implementing a **Client → Engagement → Project** hierarchy for consulting and contracting project management.

A native Obsidian plugin for consulting and contracting project management, with Dataview as a query dependency.

---

## Requirements

- **Obsidian** 1.4.0+
- **Dataview** community plugin (installed and enabled)

---

## Features

### Entity Hierarchy

- **Clients** — organisations or individuals you work for
- **Engagements** — contracts or retainers with a client
- **Projects** — discrete pieces of work within an engagement
- **People** — contacts at a client
- **Inbox Notes** — quick captures that can be converted to projects
- **Meetings** — single and recurring meeting notes with attendees

### Commands (Command Palette)

| Command                        | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| `PM: Create Client`            | Create a new client note                                  |
| `PM: Create Engagement`        | Create an engagement, linked to an active client          |
| `PM: Create Project`           | Create a project with auto-generated notes directory      |
| `PM: Create Person`            | Create a person linked to a client                        |
| `PM: Create Inbox Note`        | Create an inbox capture                                   |
| `PM: Create Single Meeting`    | Create a meeting note                                     |
| `PM: Create Recurring Meeting` | Create a recurring meeting                                |
| `PM: Create Project Note`      | Create a note inside the active project's notes directory |
| `PM: Convert Inbox to Project` | Convert the active inbox note to a project                |
| `PM: Set Up Vault Structure`   | Create all folders and default views                      |

### Code Block Processors

#### `pm-properties` — Interactive frontmatter editor

Renders form fields bound to the current note's frontmatter.

````markdown
```pm-properties
entity: project
```
````

Supported entities: `client`, `engagement`, `project`, `person`, `inbox`, `single-meeting`, `recurring-meeting`, `project-note`

#### `pm-table` — Entity relationship tables

Renders contextual tables of linked entities.

````markdown
```pm-table
type: client-engagements
```
````

| Type                    | Shows                                               |
| ----------------------- | --------------------------------------------------- |
| `client-engagements`    | Engagements where `client` links to current file    |
| `client-people`         | People where `client` links to current file         |
| `engagement-projects`   | Projects where `engagement` links to current file   |
| `related-project-notes` | Notes with `relatedProject` linking to current file |
| `mentions`              | All vault files backlinking to current file         |

#### `pm-actions` — Action buttons

Renders styled buttons that execute plugin commands.

````markdown
```pm-actions
actions:
  - type: create-project-note
    label: New Project Note
    style: primary
  - type: convert-inbox
    label: Convert to Project
    style: primary
```
````

Available `type` values match command IDs: `create-client`, `create-engagement`, `create-project`, `create-person`, `create-inbox`, `create-single-meeting`, `create-recurring-meeting`, `create-project-note`, `convert-inbox`, `scaffold-vault`.

#### `pm-tasks` — Task dashboard and by-project views

Full-featured task views with interactive filtering.

````markdown
```pm-tasks
mode: dashboard
```
````

````markdown
```pm-tasks
mode: by-project
```
````

**Dashboard filters**: view mode (Context/Date/Priority/Tag), sort, completion, context type, client, engagement, project status, inbox status, meeting date, due date, priority, text search.

**By-project filters**: project status, text filter, show completed.

All filter state is component-local — no frontmatter writes on filter change.

---

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub release](https://github.com/segFallt/obsidian-plugin-project-manager/releases)
2. Copy to `<vault>/.obsidian/plugins/project-manager/`
3. Enable in **Settings → Community Plugins**

---

## Getting Started

1. Ensure Dataview is installed and enabled
2. Run `PM: Set Up Vault Structure` to create folders and default views
3. Create your first client with `PM: Create Client`
4. Create an engagement with `PM: Create Engagement`
5. Create a project with `PM: Create Project`

---

## Vault Structure

```
clients/          ← Client notes (#client tag)
engagements/      ← Engagement notes (#engagement tag)
projects/         ← Project notes (#project tag)
  notes/          ← Project sub-notes (relatedProject frontmatter)
people/           ← Person notes (#person tag)
inbox/            ← Inbox capture notes
meetings/         ← Meeting notes
daily notes/      ← Daily notes
views/            ← Dashboard views created by scaffold command
```

---

## Settings

Access via **Settings → Project Manager**.

- **Folder Paths** — configure where each entity type is stored
- **Default Values** — default statuses for new entities
- **UI Preferences** — default task view mode, show completed toggle
- **Vault Management** — scaffold button

---

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Tests
npm test

# Tests with coverage
npm run test:coverage
```

See [`docs/plugin/architecture.md`](docs/plugin/architecture.md) for a full architectural overview.

---

## License

MIT
