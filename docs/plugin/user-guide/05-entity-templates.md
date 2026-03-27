# Entity Templates

Each entity type has a standard note structure. The templates below show the frontmatter and code blocks that the plugin writes when you create an entity using a creation command. You can add body content (headings, tasks, prose) freely below the code blocks.

---

## Client

**File location:** `clients/<Name>.md`

```markdown
---
tags:
  - "#client"
status: Active
contact-name:
contact-email:
contact-phone:
notes:
---

```pm-properties
entity: client
```

```pm-entity-view
entity: client
section: engagements
```

```pm-entity-view
entity: client
section: people
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `status` | Active, Inactive | Current status |
| `contact-name` | Text | Primary contact name |
| `contact-email` | Text | Contact email address |
| `contact-phone` | Text | Contact phone number |
| `notes` | Text | Free-text notes about the client |

---

## Engagement

**File location:** `engagements/<Name>.md`

```markdown
---
tags:
  - "#engagement"
client: "[[Client Name]]"
status: Active
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
description:
---

```pm-properties
entity: engagement
```

```pm-entity-view
entity: engagement
section: projects
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `client` | Wikilink | Parent client |
| `status` | Active, Inactive | Current status |
| `start-date` | YYYY-MM-DD | Engagement start date |
| `end-date` | YYYY-MM-DD | Engagement end date |
| `description` | Text | Brief description of the engagement scope |

---

## Project

**File location:** `projects/<Name>.md`

```markdown
---
tags:
  - "#project"
engagement: "[[Engagement Name]]"
notesDirectory: projects/notes/project_name
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
status: New
priority: 3
convertedFrom:
---

```pm-properties
entity: project
```

```pm-entity-view
entity: project
section: linked
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `engagement` | Wikilink | Parent engagement |
| `notesDirectory` | Path | Auto-generated folder for this project's notes (`projects/notes/<snake_case_name>`) |
| `status` | New, Active, On Hold, Complete | Current project status |
| `priority` | 1–4 | 1 = Urgent, 2 = High, 3 = Medium, 4 = Low |
| `convertedFrom` | Wikilink | Set when the project was created from an Inbox Note |

---

## Project Note

**File location:** `projects/notes/<project_name>/<Name>.md`

```markdown
---
relatedProject: "[[Project Name]]"
engagement: "[[Engagement Name]]"
---

# Note Title

Add tasks, content, and decisions here.

- [ ] Example task 📅 2026-04-15
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `relatedProject` | Wikilink | Parent project |
| `engagement` | Wikilink | Inherited from the parent project at creation time |

Add tasks using standard Obsidian Markdown task syntax: `- [ ] Task description`. Use `📅 YYYY-MM-DD` for due dates and priority emojis (⏫ Urgent, 🔼 High, 🔽 Low) for the task dashboard filters to pick them up.

---

## Person

**File location:** `people/<Name>.md`

```markdown
---
tags:
  - "#person"
client: "[[Client Name]]"
status: Active
title:
reports-to:
notes:
---

```pm-properties
entity: person
```

```pm-entity-view
entity: person
section: mentions
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `client` | Wikilink | Associated client |
| `status` | Active, Inactive | Current status |
| `title` | Text | Job title |
| `reports-to` | Wikilink | Manager (another Person) |
| `notes` | Text | Free-text notes |

---

## Inbox Note

**File location:** `inbox/<Name>.md`

```markdown
---
engagement: "[[Engagement Name]]"
status: Active
convertedTo:
---

# Note Title

Capture ideas and context here. Run **PM: Convert Inbox to Project** when ready to promote this to a project.
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `engagement` | Wikilink | Optional parent engagement |
| `status` | Active, Inactive | Set to Inactive automatically when converted |
| `convertedTo` | Wikilink | Set to the new project when converted |

---

## Single Meeting

**File location:** `meetings/single/<Name>.md`

```markdown
---
engagement: "[[Engagement Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
---

```pm-properties
entity: single-meeting
```

# Agenda

# Notes

# Tasks

- [ ] Follow-up action
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `engagement` | Wikilink | Parent engagement |
| `date` | ISO datetime | Meeting date and time |
| `attendees` | Wikilink list | People who attended |

---

## Recurring Meeting

**File location:** `meetings/recurring/<Name>.md`

```markdown
---
engagement: "[[Engagement Name]]"
start-date: YYYY-MM-DD
end-date: YYYY-MM-DD
default-attendees:
  - "[[Person Name]]"
---

```pm-properties
entity: recurring-meeting
```

```pm-recurring-events
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `engagement` | Wikilink | Parent engagement |
| `start-date` | YYYY-MM-DD | Series start date |
| `end-date` | YYYY-MM-DD | Series end date |
| `default-attendees` | Wikilink list | Default attendee list for new events |

---

## Recurring Meeting Event

**File location:** `meetings/recurring-events/<Meeting Name>/<Date>.md`

```markdown
---
recurring-meeting: "[[Recurring Meeting Name]]"
date: YYYY-MM-DDTHH:mm:ss
attendees:
  - "[[Person Name]]"
---

# Notes

Event notes appear in the recurring events tile grid.

- Bullet point notes are shown in the tile
- Tasks are tracked by the task dashboard

# Tasks

- [ ] Action from this meeting 📅 2026-04-10
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `recurring-meeting` | Wikilink | Parent recurring meeting series |
| `date` | ISO datetime | Event date and time |
| `attendees` | Wikilink list | Actual attendees for this instance |

---

## RAID Item

**File location:** `raid/<Name>.md`

```markdown
---
tags:
  - "#raid"
raid-type: Risk
client: "[[Client Name]]"
engagement: "[[Engagement Name]]"
status: Open
likelihood: High
impact: High
owner: "[[Person Name]]"
raised-date: YYYY-MM-DD
closed-date:
description:
---

```pm-properties
entity: raid
```

```pm-raid-references
```
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `raid-type` | Risk, Assumption, Issue, Decision | The type of RAID item |
| `client` | Wikilink | Associated client (optional) |
| `engagement` | Wikilink | Associated engagement (optional) |
| `status` | Open, In Progress, Resolved, Closed | Current status |
| `likelihood` | High, Medium, Low | Likelihood of occurrence (for Risks and Assumptions) |
| `impact` | High, Medium, Low | Impact if it occurs |
| `owner` | Wikilink | Responsible person |
| `raised-date` | YYYY-MM-DD | Auto-set at creation |
| `closed-date` | YYYY-MM-DD | Auto-set when status changes to Resolved or Closed |

---

## Reference Topic

**File location:** `reference-topics/<Name>.md`

```markdown
---
tags:
  - "#reference-topic"
---

# Topic Name

Brief description of what this topic covers.
```

Reference Topics are tags used to categorise Reference documents. A reference can belong to multiple topics.

---

## Reference

**File location:** `references/<Name>.md`

```markdown
---
tags:
  - "#reference"
topics:
  - "[[Topic Name]]"
client: "[[Client Name]]"
engagement: "[[Engagement Name]]"
---

# Reference Title

Reference content — notes, links, code snippets, decisions, or any knowledge worth keeping.
```

**Fields:**

| Field | Values | Description |
|-------|--------|-------------|
| `topics` | Wikilink list | One or more Reference Topics |
| `client` | Wikilink | Associated client (optional) |
| `engagement` | Wikilink | Associated engagement (optional) |
