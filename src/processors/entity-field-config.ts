import type { EntityType } from "../types";
import { FM_KEY, ENTITY_TAGS, CLIENT_STATUSES, ENGAGEMENT_STATUSES, PROJECT_STATUSES, INBOX_STATUSES } from "../constants";

// ─── Field descriptor types ───────────────────────────────────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "select"
  | "multi-select"
  | "suggester"
  | "suggester-by-folder"
  | "list-suggester";

export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** For suggester fields: the Dataview tag to query */
  entityTag?: string;
  enriched?: boolean;
  /** When set to 'number', the select change handler coerces the value before persisting */
  valueType?: 'string' | 'number';
}

// ─── Entity field configuration ───────────────────────────────────────────

export const ENTITY_FIELDS: Record<EntityType, FieldDescriptor[]> = {
  client: [
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...CLIENT_STATUSES] },
    { key: FM_KEY.CONTACT_NAME, label: "Contact Name", type: "text" },
    { key: FM_KEY.CONTACT_EMAIL, label: "Contact Email", type: "text" },
    { key: FM_KEY.CONTACT_PHONE, label: "Contact Phone", type: "text" },
    { key: FM_KEY.NOTES, label: "Notes", type: "textarea" },
  ],
  engagement: [
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...ENGAGEMENT_STATUSES] },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.DESCRIPTION, label: "Description", type: "textarea" },
  ],
  project: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.PRIORITY, label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"], valueType: 'number' },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...PROJECT_STATUSES] },
  ],
  person: [
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...CLIENT_STATUSES] },
    { key: FM_KEY.TITLE, label: "Title", type: "text" },
    { key: FM_KEY.REPORTS_TO, label: "Reports To", type: "suggester", entityTag: ENTITY_TAGS.person },
    { key: FM_KEY.NOTES, label: "Notes", type: "textarea" },
  ],
  inbox: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...INBOX_STATUSES] },
  ],
  "single-meeting": [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.DATE, label: "Date", type: "datetime" },
    { key: FM_KEY.ATTENDEES, label: "Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  "recurring-meeting": [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.DEFAULT_ATTENDEES, label: "Default Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  "recurring-meeting-event": [
    { key: FM_KEY.RECURRING_MEETING, label: "Recurring Meeting", type: "suggester-by-folder" },
    { key: FM_KEY.DATE, label: "Date", type: "datetime" },
    { key: FM_KEY.ATTENDEES, label: "Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  "project-note": [
    { key: FM_KEY.RELATED_PROJECT, label: "Related Project", type: "text" },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
  ],
  "raid-item": [
    { key: "raid-type", label: "RAID Type", type: "select", options: ["Risk", "Assumption", "Issue", "Decision"] },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Closed"] },
    { key: "likelihood", label: "Likelihood", type: "select", options: ["High", "Medium", "Low"] },
    { key: "impact", label: "Impact", type: "select", options: ["High", "Medium", "Low"] },
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: "owner", label: "Owner", type: "suggester", entityTag: ENTITY_TAGS.person },
    { key: "raised-date", label: "Raised Date", type: "date" },
    { key: "closed-date", label: "Closed Date", type: "date" },
    { key: FM_KEY.DESCRIPTION, label: "Description", type: "textarea" },
  ],
  "reference-topic": [],
  "reference": [
    { key: FM_KEY.TOPICS,     label: "Topics",     type: "list-suggester", entityTag: ENTITY_TAGS.referenceTopic },
    { key: FM_KEY.CLIENT,     label: "Client",     type: "suggester",      entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester",      entityTag: ENTITY_TAGS.engagement, enriched: true },
  ],
};
