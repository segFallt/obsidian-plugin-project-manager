# Getting Started

## What the Plugin Does

Project Manager adds a structured project management layer to your Obsidian vault. Instead of loose notes, you work with a hierarchy of typed entities — each stored as a standard Markdown note with YAML frontmatter — and view them through interactive code block renderers.

**Who it is for:** Consultants, freelancers, and anyone who manages client work and wants their notes and tasks in one place, without leaving Obsidian.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Obsidian | Version 1.4.0 or later |
| [Dataview plugin](https://github.com/blacksmithgu/obsidian-dataview) | Required for relationship tables, recurring events, RAID references, and the references dashboard. Install and enable it separately. |

---

## Installation

### From the Community Plugin Browser (recommended)

1. Open **Settings → Community Plugins** and turn off **Restricted Mode** if it is on
2. Click **Browse** and search for **Project Manager**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from the plugin repository
2. Extract `main.js`, `manifest.json`, and `styles.css` into a folder called `project-manager` inside your vault's `.obsidian/plugins/` directory
3. Open **Settings → Community Plugins**, find **Project Manager**, and enable it

---

## Setting Up Your Vault

After enabling the plugin, run the vault scaffolding command to create all required folders and default view files.

1. Open the command palette (`Ctrl/Cmd + P`)
2. Run **PM: Set Up Vault Structure**

This creates the following folder structure (using default paths — all paths are configurable in settings):

```
your-vault/
  clients/              ← Client notes
  engagements/          ← Engagement notes
  projects/             ← Project notes
    notes/              ← Project sub-notes
  people/               ← Person notes
  inbox/                ← Inbox notes (ideas and captures)
  meetings/
    single/             ← One-off meeting notes
    recurring/          ← Recurring meeting series notes
    recurring-events/   ← Individual recurring meeting event notes
  raid/                 ← RAID items (Risks, Assumptions, Issues, Decisions)
  references/           ← Reference documents
  reference-topics/     ← Reference topic tags
  utility/              ← View files and logs
    Task Dashboard.md
    Tasks By Project.md
```

The two files created in `utility/` are ready-to-use task dashboards — open either one to see all your vault tasks.

---

## Entity Types

The plugin introduces 11 entity types, organised in a hierarchy. Each entity is a standard Markdown note with YAML frontmatter managed by the plugin.

### The Client Hierarchy

```
Client
  └── Engagement        (a scoped body of work for a Client)
        └── Project     (a workstream within an Engagement)
              └── Project Note  (a document linked to a Project)
```

### Supporting Entities

| Entity | Description |
|--------|-------------|
| **Person** | A contact associated with a Client |
| **Inbox Note** | A lightweight idea or capture that can later be promoted to a Project |
| **Single Meeting** | A one-off meeting linked to an Engagement |
| **Recurring Meeting** | A recurring meeting series linked to an Engagement |
| **Recurring Meeting Event** | An individual instance of a Recurring Meeting |
| **RAID Item** | A Risk, Assumption, Issue, or Decision |
| **Reference Topic** | A tag for categorising Reference documents |
| **Reference** | A reference document or knowledge base article |

### How Entities Relate

All cross-references between entities use Obsidian wikilinks (`[[Entity Name]]`). For example, a Project stores its parent engagement as `engagement: "[[My Engagement]]"`. This means you can navigate between entities by clicking links, and Obsidian's backlink panel shows you the full relationship graph.

---

## Your First Workflow

Here's the recommended sequence for onboarding a new client:

1. **PM: Create Client** — enter the client name, status, and contact details
2. **PM: Create Engagement** — enter the engagement name and select the client
3. **PM: Create Project** — enter the project name and select the engagement
4. Open the project note → add tasks in Markdown (`- [ ] Task description`)
5. Open **utility/Task Dashboard** to see all tasks across the vault

See [Workflows](06-workflows.md) for detailed step-by-step walkthroughs.
