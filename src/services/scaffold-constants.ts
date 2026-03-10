/**
 * Default view file content for vault scaffolding.
 *
 * Static .md files are exported as constants.
 * Parameterised .base files are exported as functions accepting the target folder path.
 */

// ─── Task view .md files ──────────────────────────────────────────────────

export const SCAFFOLD_TASK_DASHBOARD = `---
obsidianUIMode: preview
---
# Task Dashboard

\`\`\`pm-tasks
mode: dashboard
\`\`\`
`;

export const SCAFFOLD_TASKS_BY_PROJECT = `---
obsidianUIMode: preview
---
# Tasks By Project

\`\`\`pm-tasks
mode: by-project
\`\`\`
`;

// ─── Entity view .md files ────────────────────────────────────────────────

export const SCAFFOLD_CLIENTS_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-client
    label: New Client
    style: primary
\`\`\`

# Active Clients
![[Clients Base.base#clients_active]]

# Inactive Clients
![[Clients Base.base#clients_inactive]]
`;

export const SCAFFOLD_ENGAGEMENTS_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-engagement
    label: New Engagement
    style: primary
\`\`\`

# Active Engagements
![[Engagements Base.base#engagements_active]]

# Inactive Engagements
![[Engagements Base.base#engagements_inactive]]
`;

export const SCAFFOLD_PROJECTS_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-project
    label: New Project
    style: primary
\`\`\`

# Active Projects
![[Projects Base.base#projects_active]]

# New Projects
![[Projects Base.base#projects_new]]

# On Hold Projects
![[Projects Base.base#projects_onhold]]

# Complete Projects
![[Projects Base.base#projects_complete]]
`;

export const SCAFFOLD_PEOPLE_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-person
    label: New Person
    style: primary
\`\`\`

# Active People
![[People Base.base#people_active]]

# All People
![[People Base.base#people_all]]
`;

export const SCAFFOLD_INBOX_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-inbox
    label: New Inbox Note
    style: primary
\`\`\`

# Active
![[Inbox Base.base#inbox_active]]

# Inactive
![[Inbox Base.base#inbox_inactive]]
`;

export const SCAFFOLD_SINGLE_MEETING_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-single-meeting
    label: New Single Meeting
    style: primary
\`\`\`

![[Single Meetings Base.base#meetings]]
`;

export const SCAFFOLD_RECURRING_MEETING_MD = `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-recurring-meeting
    label: New Recurring Meeting
    style: primary
\`\`\`

# Active
![[Recurring Meetings Base.base#meetings_active]]

# Past
![[Recurring Meetings Base.base#meetings_past]]
`;

// ─── Parameterised .base file content ────────────────────────────────────

export function scaffoldClientsBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: clients_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("client")
        - status == "Active"
    order:
      - file.name
      - contact-name
      - contact-email
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: clients_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("client")
        - status == "Inactive"
    order:
      - file.name
      - contact-name
      - contact-email
    sort:
      - property: file.name
        direction: ASC
`;
}

export function scaffoldEngagementsBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Name
  client:
    displayName: Client
views:
  - type: table
    name: engagements_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("engagement")
        - status == "Active"
    order:
      - file.name
      - client
      - start-date
      - end-date
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: engagements_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("engagement")
        - status == "Inactive"
    order:
      - file.name
      - client
      - start-date
      - end-date
    sort:
      - property: file.name
        direction: ASC
`;
}

export function scaffoldProjectsBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Title
views:
  - type: table
    name: projects_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "Active"
    order:
      - file.name
      - start-date
      - priority
      - engagement
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
      - property: priority
        direction: ASC
      - property: start-date
        direction: DESC
  - type: table
    name: projects_new
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "New"
    order:
      - file.name
      - start-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.mtime
        direction: DESC
      - property: start-date
        direction: DESC
      - property: priority
        direction: ASC
  - type: table
    name: projects_onhold
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "On Hold"
    order:
      - file.name
      - start-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.name
        direction: ASC
      - property: file.mtime
        direction: DESC
      - property: priority
        direction: ASC
  - type: table
    name: projects_complete
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "Complete"
    order:
      - file.name
      - start-date
      - end-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.mtime
        direction: DESC
      - property: file.name
        direction: ASC
      - property: end-date
        direction: DESC
`;
}

export function scaffoldPeopleBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: people_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("person")
        - status == "Active"
    order:
      - file.name
      - title
      - client
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: people_all
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("person")
    order:
      - file.name
      - title
      - status
      - client
    sort:
      - property: file.name
        direction: ASC
`;
}

export function scaffoldInboxBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Item
views:
  - type: table
    name: inbox_active
    filters:
      and:
        - file.inFolder("${folder}")
        - status == "Active"
    order:
      - file.name
      - engagement
      - file.ctime
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
  - type: table
    name: inbox_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - status != "Active"
    order:
      - file.name
      - engagement
      - file.ctime
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
      - property: engagement
        direction: ASC
`;
}

export function scaffoldSingleMeetingsBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Meeting
views:
  - type: table
    name: meetings
    filters:
      and:
        - file.inFolder("${folder}")
    order:
      - file.name
      - engagement
      - date
    sort:
      - property: date
        direction: DESC
`;
}

export function scaffoldRecurringMeetingsBase(folder: string): string {
  return `properties:
  file.name:
    displayName: Meeting
views:
  - type: table
    name: meetings_active
    filters:
      and:
        - file.inFolder("${folder}")
        - and:
            - note["end-date"].isEmpty()
    order:
      - file.name
      - engagement
      - start-date
      - last-event-date
    sort:
      - property: last-event-date
        direction: DESC
  - type: table
    name: meetings_past
    filters:
      and:
        - and:
            - file.inFolder("${folder}")
            - '!note["end-date"].isEmpty()'
    order:
      - file.name
      - start-date
      - end-date
    sort:
      - property: end-date
        direction: DESC
`;
}
