# Data Model

All entity data is stored as standard Obsidian frontmatter (YAML). The plugin reads and writes frontmatter via Obsidian's `processFrontMatter` API.

## Client

**File location**: `clients/<Name>.md`
**Tag**: `#client`
**Folder**: configured via Settings → Folder Paths → Clients folder

```yaml
tags:
  - "#client"
status: Active | Inactive
contact-name:
contact-email:
contact-phone:
notes:
```

## Engagement

**File location**: `engagements/<Name>.md`
**Tag**: `#engagement`

```yaml
tags:
  - "#engagement"
client: "[[Client Name]]"
status: Active | Inactive
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
description:
```

## Project

**File location**: `projects/<Name>.md`
**Tag**: `#project`

```yaml
tags:
  - "#project"
engagement: "[[Engagement Name]]"
notesDirectory: projects/notes/snake_case_name
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
status: New | Active | On Hold | Complete
priority: 1-5
convertedFrom: "[[inbox/Inbox Note Name]]"
```

The `notesDirectory` is auto-generated at creation time as `projects/notes/<snake_case_project_name>`. The `engagement` wikilink is set via `processFrontMatter` after file creation (not baked into the template).

## Project Note

**File location**: `<notesDirectory>/<Name>.md`

```yaml
relatedProject: "[[Project Name]]"
engagement: "[[Engagement Name]]"
```

Project notes inherit the `engagement` from their parent project at creation time. Both `relatedProject` and `engagement` are set via `processFrontMatter` after file creation; the template itself does not embed wikilink values.

## Person

**File location**: `people/<Name>.md`
**Tag**: `#person`

```yaml
tags:
  - "#person"
client: "[[Client Name]]"
status: Active | Inactive
title:
reports-to: "[[Person Name]]"
notes:
```

## Inbox Note

**File location**: `inbox/<Name>.md`

```yaml
engagement: "[[Engagement Name]]"
status: Active | Inactive
convertedTo: "[[projects/Project Name]]"
```

When converted to a project: `status` → `Inactive`, `convertedTo` is set.

## Single Meeting

**File location**: `meetings/single/<Name>.md`
**Folder**: configured via Settings → Folder Paths → Single meetings folder

```yaml
engagement: "[[Engagement Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
```

## Recurring Meeting

**File location**: `meetings/recurring/<Name>.md`
**Folder**: configured via Settings → Folder Paths → Recurring meetings folder

```yaml
engagement: "[[Engagement Name]]"
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
default-attendees:
  - "[[Person Name]]"
```

## Recurring Meeting Event

**File location**: `meetings/recurring-events/<MeetingName>/<Date>.md`
**Folder**: configured via Settings → Folder Paths → Recurring meeting events folder

```yaml
recurring-meeting: "[[Recurring Meeting Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
```

The `recurring-meeting` wikilink is set via `processFrontMatter` after file creation.

## RAID Item

**File location**: `raid/<Name>.md`
**Tag**: `#raid`
**Folder**: configured via Settings → Folder Paths → RAID folder

```yaml
tags:
  - "#raid"
raid-type: Risk | Assumption | Issue | Decision
client: "[[Client Name]]"           # optional wikilink
engagement: "[[Engagement Name]]"   # optional wikilink
status: Open | In Progress | Resolved | Closed
likelihood: High | Medium | Low
impact: High | Medium | Low
owner: "[[Person Name]]"            # optional wikilink
raised-date: YYYY-MM-DD             # auto-set at creation
closed-date: YYYY-MM-DD             # auto-set when status → Resolved or Closed
description:
```

All wikilink fields (`client`, `engagement`, `owner`) are set via `processFrontMatter` after file creation.

`closed-date` is automatically set (and cleared) by the `pm-properties` status field `onChange` handler in `pm-properties-processor.ts`.

### Line Annotation Format

When a line in any note is tagged to a RAID item via `PM: Tag Line as RAID Reference`, the following pattern is appended to the line:

```
{raid:positive}[[RAID Item Name]]
{raid:negative}[[RAID Item Name]]
{raid:neutral}[[RAID Item Name]]
```

A `MarkdownPostProcessor` renders `{raid:direction}` as a styled badge with a type-specific label (e.g. `{raid:positive}` on a Risk renders as "↑ Mitigates"). The `[[RAID Item Name]]` wikilink is preserved for Obsidian backlink tracking.

### Direction → Label Mapping

| Direction | Risk | Assumption | Issue | Decision |
|-----------|------|------------|-------|----------|
| `positive` | Mitigates | Validates | Resolves | Supports |
| `negative` | Escalates | Invalidates | Compounds | Challenges |
| `neutral` | Notes | Notes | Notes | Notes |

## Priority Scale

| Value | Label | Tasks emoji |
|-------|-------|-------------|
| 1 | Urgent | ⏫ |
| 2 | High | 🔼 |
| 3 | Medium | *(none)* |
| 4 | Low | 🔽 |
| 5 | Someday | ⏬ |

## Relationship Traversal

The plugin walks the following chains to resolve client/engagement context for tasks:

```
Project Note → relatedProject → Project → engagement → Engagement → client → Client
Single Meeting → engagement → Engagement → client → Client
Recurring Meeting Event → recurring-meeting → Recurring Meeting → engagement → Engagement → client → Client
```

This enables the task dashboard's client/engagement filters to correctly group tasks from project notes, single meetings, and recurring meeting events under their ancestor client and engagement.
