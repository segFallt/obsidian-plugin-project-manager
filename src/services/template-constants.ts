/**
 * Static template strings for all entity types.
 * Templates use {{variable}} syntax — processed by TemplateService.processTemplate().
 *
 * Available variables: {{date}}, {{datetime}}, {{name}}, {{notesDir}},
 *                      {{engagement}}, {{relatedProject}}
 */

export const TEMPLATE_CLIENT = `---
obsidianUIMode: preview
tags:
  - "#client"
status: Active
contact-name:
contact-email:
contact-phone:
notes:
---
# Properties
\`\`\`pm-properties
entity: client
\`\`\`

---
\`\`\`pm-entity-view
entity: client
section: engagements
\`\`\`

---
\`\`\`pm-entity-view
entity: client
section: people
\`\`\`

---

# Notes

`;

export const TEMPLATE_ENGAGEMENT = `---
obsidianUIMode: preview
tags:
  - "#engagement"
client:
status: Active
start-date: {{date}}
end-date:
description:
---
# Properties
\`\`\`pm-properties
entity: engagement
\`\`\`

---
\`\`\`pm-entity-view
entity: engagement
section: projects
\`\`\`

---

# Notes

`;

export const TEMPLATE_PROJECT = `---
notesDirectory: {{notesDir}}
engagement:
start-date: {{date}}
end-date:
status: New
tags:
  - "#project"
priority:
convertedFrom:
---
# Properties
\`\`\`pm-properties
entity: project
\`\`\`

---
\`\`\`pm-entity-view
entity: project
section: linked
\`\`\`

---
# Notes


`;

export const TEMPLATE_PERSON = `---
obsidianUIMode: preview
tags:
  - "#person"
client:
status: Active
title:
reports-to:
notes:
---
# Profile
\`\`\`pm-properties
entity: person
\`\`\`

---
\`\`\`pm-entity-view
entity: person
section: mentions
\`\`\`

---
`;

export const TEMPLATE_INBOX = `---
engagement:
status: Active
convertedTo:
---

# Properties
\`\`\`pm-properties
entity: inbox
\`\`\`

---
\`\`\`pm-actions
actions:
  - type: convert-inbox
    label: Convert to Project
    style: primary
\`\`\`

# Notes

`;

export const TEMPLATE_SINGLE_MEETING = `---
engagement:
date: {{datetime}}
attendees: []
---

# Properties
\`\`\`pm-properties
entity: single-meeting
\`\`\`

# Invitation Message


\`\`\`pm-actions
actions:
  - type: convert-single-to-recurring
    label: Convert to Recurring Meeting
    style: default
\`\`\`

# Notes
-


`;

export const TEMPLATE_RECURRING_MEETING = `---
engagement:
start-date: {{date}}
end-date:
last-event-date:
default-attendees: []
---

# Properties
\`\`\`pm-properties
entity: recurring-meeting
\`\`\`

# Events
\`\`\`pm-actions
actions:
  - type: create-recurring-meeting-event
    label: New Event
    style: primary
    context:
      field: recurring-meeting
\`\`\`

\`\`\`pm-recurring-events
\`\`\`
`;

export const TEMPLATE_RECURRING_MEETING_EVENT = `---
recurring-meeting:
date: {{datetime}}
attendees: []
---

# Properties
\`\`\`pm-properties
entity: recurring-meeting-event
\`\`\`

# Notes
-
`;

export const TEMPLATE_PROJECT_NOTE = `---
engagement:
relatedProject: "[[{{relatedProject}}]]"
---
`;

export const RAID_ITEM_TEMPLATE = `---
tags:
  - "#raid"
raid-type:
client:
engagement:
status: Open
likelihood: Medium
impact: Medium
owner:
raised-date:
closed-date:
description:
---

# {{name}}

\`\`\`pm-properties
entity: raid-item
\`\`\`

\`\`\`pm-raid-references
\`\`\`
`;
