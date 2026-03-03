import type { EntityType } from "../types";
import { todayISO, nowDatetime } from "../utils/date-utils";
import type { ITemplateService } from "./interfaces";

/**
 * Provides embedded note templates for all entity types.
 *
 * Templates use `{{variable}}` syntax, processed by `processTemplate()`.
 * All Meta Bind / Templater syntax has been replaced with pm-* code blocks.
 *
 * Available variables: {{date}}, {{datetime}}, {{name}}, {{notesDir}},
 *                      {{engagement}}, {{relatedProject}}
 */
export class TemplateService implements ITemplateService {
  /**
   * Returns the raw template string for the given entity type.
   */
  getTemplate(type: EntityType): string {
    const templates: Record<EntityType, string> = {
      client: this.clientTemplate(),
      engagement: this.engagementTemplate(),
      project: this.projectTemplate(),
      person: this.personTemplate(),
      inbox: this.inboxTemplate(),
      "single-meeting": this.singleMeetingTemplate(),
      "recurring-meeting": this.recurringMeetingTemplate(),
      "project-note": this.projectNoteTemplate(),
    };
    return templates[type];
  }

  /**
   * Substitutes `{{variable}}` placeholders in a template string.
   *
   * @param template - Raw template with `{{key}}` placeholders
   * @param vars     - Map of variable names to their values
   */
  processTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
  }

  /**
   * Returns the default variable map with today's date.
   * Callers should merge additional entity-specific variables.
   */
  defaultVars(): Record<string, string> {
    return {
      date: todayISO(),
      datetime: nowDatetime(),
      name: "",
    };
  }

  // ─── Template definitions ────────────────────────────────────────────────

  private clientTemplate(): string {
    return `---
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
# Engagements
\`\`\`pm-table
type: client-engagements
\`\`\`

---
# People
\`\`\`pm-table
type: client-people
\`\`\`

---
# Notes

`;
  }

  private engagementTemplate(): string {
    return `---
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
# Projects
\`\`\`pm-table
type: engagement-projects
\`\`\`

---
# Notes

`;
  }

  private projectTemplate(): string {
    return `---
notesDirectory: {{notesDir}}
engagement: {{engagement}}
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
# Notes


---
# Linked
---
\`\`\`pm-actions
actions:
  - type: create-project-note
    label: New Project Note
    style: primary
\`\`\`
\`\`\`pm-table
type: related-project-notes
\`\`\`


`;
  }

  private personTemplate(): string {
    return `---
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
# Mentions
\`\`\`pm-table
type: mentions
\`\`\`
`;
  }

  private inboxTemplate(): string {
    return `---
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
  }

  private singleMeetingTemplate(): string {
    return `---
engagement:
date: {{datetime}}
attendees: []
---

# Properties
\`\`\`pm-properties
entity: single-meeting
\`\`\`

# Invitation Message


# Notes
-


`;
  }

  private recurringMeetingTemplate(): string {
    return `---
engagement:
start-date: {{date}}
end-date:
---

# Properties
\`\`\`pm-properties
entity: recurring-meeting
\`\`\`

`;
  }

  private projectNoteTemplate(): string {
    return `---
engagement: {{engagement}}
relatedProject: "[[{{relatedProject}}]]"
---
`;
  }
}
