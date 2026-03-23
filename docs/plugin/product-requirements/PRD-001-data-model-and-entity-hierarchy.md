# PRD-001: Data Model & Entity Hierarchy

## 1. Overview

The plugin organises vault data around 11 entity types arranged in a strict parent-child hierarchy. All entity data is stored as standard Obsidian frontmatter (YAML) and read/written via Obsidian's `processFrontMatter` API. Each entity type lives in a dedicated configurable folder and is identified by a required frontmatter tag.

---

## 2. User Stories

- As a consultant, I want each client, engagement, project, and project note to live in its own well-known folder so I can navigate my vault predictably.
- As a user, I want entities linked by wikilinks so Obsidian's graph view and backlink panel reflect my project structure.
- As a user, I want tasks across project notes to surface under their parent client/engagement when I open the task dashboard, so I can filter by account.
- As a user, I want a consistent priority scale (1–5) across all projects and tasks so I can sort and filter by urgency.

---

## 3. Functional Requirements

### 3.1 Entity Types

The plugin defines 11 entity types:

| Entity | Folder (default) | Required tag |
|--------|-----------------|--------------|
| Client | `clients/` | `#client` |
| Engagement | `engagements/` | `#engagement` |
| Project | `projects/` | `#project` |
| Project Note | `<notesDirectory>/` | *(none)* |
| Person | `people/` | `#person` |
| Inbox Note | `inbox/` | *(none)* |
| Single Meeting | `meetings/single/` | *(none)* |
| Recurring Meeting | `meetings/recurring/` | *(none)* |
| Recurring Meeting Event | `meetings/recurring-events/` | *(none)* |
| Reference | `reference/references/` | `#reference` |
| Reference Topic | `reference/reference-topics/` | `#reference-topic` |

### 3.2 Frontmatter Schemas

**Client** (`clients/<Name>.md`, tag `#client`)
```yaml
tags:
  - "#client"
status: Active | Inactive
contact-name:
contact-email:
contact-phone:
notes:
```

**Engagement** (`engagements/<Name>.md`, tag `#engagement`)
```yaml
tags:
  - "#engagement"
client: "[[Client Name]]"
status: Active | Inactive
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
description:
```

**Project** (`projects/<Name>.md`, tag `#project`)
```yaml
tags:
  - "#project"
engagement: "[[Engagement Name]]"
notesDirectory: projects/notes/snake_case_name
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
status: New | Active | On Hold | Complete
priority: 1–5
convertedFrom: "[[inbox/Inbox Note Name]]"
```

**Project Note** (`<notesDirectory>/<Name>.md`)
```yaml
relatedProject: "[[Project Name]]"
engagement: "[[Engagement Name]]"
```

**Person** (`people/<Name>.md`, tag `#person`)
```yaml
tags:
  - "#person"
client: "[[Client Name]]"
status: Active | Inactive
title:
reports-to: "[[Person Name]]"
notes:
```

**Inbox Note** (`inbox/<Name>.md`)
```yaml
engagement: "[[Engagement Name]]"
status: Active | Inactive
convertedTo: "[[projects/Project Name]]"
```

**Single Meeting** (`meetings/single/<Name>.md`)
```yaml
engagement: "[[Engagement Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
```

**Recurring Meeting** (`meetings/recurring/<Name>.md`)
```yaml
engagement: "[[Engagement Name]]"
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
default-attendees:
  - "[[Person Name]]"
```

**Recurring Meeting Event** (`meetings/recurring-events/<MeetingName>/<Date>.md`)
```yaml
recurring-meeting: "[[Recurring Meeting Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
```

**Reference Topic** (`reference/reference-topics/<Name>.md`, tag `#reference-topic`)
```yaml
tags:
  - "#reference-topic"
status: Active
```

No additional frontmatter fields. The topic's identity is its name. The page body is its view — a `pm-references` block pre-filtered to that topic.

**Reference** (`reference/references/<Name>.md`, tag `#reference`)
```yaml
tags:
  - "#reference"
topics:
  - "[[Topic Name]]"
client: "[[Client Name]]"
engagement: "[[Engagement Name]]"
```

- `topics` — required, multi-value list of wikilinks to Reference Topic files
- `client` — optional wikilink to a Client file
- `engagement` — optional wikilink to an Engagement file

### 3.3 Wikilink Convention

Fields that hold wikilinks (`engagement`, `client`, `convertedFrom`, `convertedTo`, `relatedProject`, `reports-to`, `attendees`, `default-attendees`) are **never** baked into template strings. They are always written via `processFrontMatter` after file creation to avoid YAML parsing issues caused by unquoted `[[...]]` sequences in raw template text.

### 3.4 Folder Convention

- The `notesDirectory` for a project is auto-generated at creation time as `projects/notes/<snake_case_project_name>`.
- All folder paths are configurable via Settings → Folder Paths (see PRD-007).

### 3.5 Relationship Traversal

The plugin resolves client/engagement context for tasks by walking these chains:

```
Project Note → relatedProject → Project → engagement → Engagement → client → Client
Single Meeting → engagement → Engagement → client → Client
Recurring Meeting Event → recurring-meeting → Recurring Meeting → engagement → Engagement → client → Client
```

This allows the task dashboard's context filters to group tasks from project notes, single meetings, and recurring meeting events under their ancestor client and engagement.

The `pm-references` dashboard resolves client for reference items via a dual-path:

```
Reference → client                              → Client
Reference → engagement → Engagement → client   → Client
Reference → topics[]   → Reference Topic
```

Client resolution checks `reference.client` first; if absent, falls back to `reference.engagement → engagement.client`. This is consistent with the existing task traversal pattern.

---

## 4. Data Requirements

### 4.1 Priority Scale

| Value | Label | Tasks plugin emoji |
|-------|-------|-------------------|
| 1 | Urgent | ⏫ |
| 2 | High | 🔼 |
| 3 | Medium | *(none)* |
| 4 | Low | 🔽 |
| 5 | Someday | ⏬ |

### 4.2 Status Values

| Entity | Valid statuses |
|--------|---------------|
| Client | Active, Inactive |
| Engagement | Active, Inactive |
| Project | New, Active, On Hold, Complete |
| Person | Active, Inactive |
| Inbox Note | Active, Inactive |

### 4.3 Date Formats

- `date` fields on meetings: ISO 8601 datetime `YYYY-MM-DDTHH:mm:ss`
- `start-date` / `end-date` fields: ISO 8601 date `YYYY-MM-DD`

---

## 5. UI/UX Requirements

No direct UI — the data model is displayed and edited through the `pm-properties` code block processor (PRD-003) and the relationship table processors (PRD-004).

---

## 6. Dependencies & Cross-References

- **PRD-002** — Commands create entities conforming to these schemas.
- **PRD-003** — `pm-properties` reads and writes these frontmatter fields.
- **PRD-004** — `pm-table` queries entities by these wikilink fields.
- **PRD-005** — Task dashboard traverses these relationship chains to resolve context filters.
- **PRD-007** — All folder paths are configurable in Settings.

---

## 7. Acceptance Criteria

- [ ] Each entity type has a dedicated folder (configurable via Settings).
- [ ] Entity files with the required tag are discovered by Dataview queries used in `pm-table` and `pm-properties`.
- [ ] Wikilink fields in frontmatter are always written via `processFrontMatter`, never as raw template strings.
- [ ] Priority values 1–5 are used consistently across projects and task emoji rendering.
- [ ] Relationship traversal correctly resolves `Project Note → ... → Client` for task dashboard context grouping.
- [ ] Relationship traversal correctly resolves `Recurring Meeting Event → ... → Client` for task dashboard context grouping.
- [ ] Reference client resolution uses dual-path: `reference.client` directly OR `reference.engagement → engagement.client`.
- [ ] The `notesDirectory` field on a project is set to `projects/notes/<snake_case_name>` at creation.
- [ ] When an inbox note is converted to a project: `status` → `Inactive`, `convertedTo` is set on the inbox note; `convertedFrom` is set on the new project.

---

## 8. Out of Scope

- Cross-vault or multi-vault linking.
- Custom entity types beyond the 11 defined here.
- Renaming or moving entity files after creation.
