import type { EntityType, RaidStatus } from "../types";
import { FM_KEY, ENTITY_TAGS, ENTITY_TYPE, CLIENT_STATUSES, ENGAGEMENT_STATUSES, PROJECT_STATUSES, INBOX_STATUSES, PRIORITY_OPTIONS } from "../constants";
import {
  RAID_TYPES,
  RAID_STATUSES,
  LIKELIHOODS,
  IMPACTS_SEVERITY_FIRST,
  RAID_CLOSED_STATUSES,
  RAID_OPEN_STATUSES,
} from "../raid-constants";
import { todayUTCISO } from "../utils/date-utils";

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
  /** When true, a select field prepends a neutral `(none)` option for an unset value */
  nullable?: boolean;
}

// ─── Entity field configuration ───────────────────────────────────────────

export const ENTITY_FIELDS: Record<EntityType, FieldDescriptor[]> = {
  [ENTITY_TYPE.CLIENT]: [
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...CLIENT_STATUSES] },
    { key: FM_KEY.CONTACT_NAME, label: "Contact Name", type: "text" },
    { key: FM_KEY.CONTACT_EMAIL, label: "Contact Email", type: "text" },
    { key: FM_KEY.CONTACT_PHONE, label: "Contact Phone", type: "text" },
    { key: FM_KEY.NOTES, label: "Notes", type: "textarea" },
  ],
  [ENTITY_TYPE.ENGAGEMENT]: [
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...ENGAGEMENT_STATUSES] },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.DESCRIPTION, label: "Description", type: "textarea" },
  ],
  [ENTITY_TYPE.PROJECT]: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.PRIORITY, label: "Priority", type: "select", options: PRIORITY_OPTIONS, valueType: 'number', nullable: true },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...PROJECT_STATUSES] },
  ],
  [ENTITY_TYPE.PERSON]: [
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...CLIENT_STATUSES] },
    { key: FM_KEY.TITLE, label: "Title", type: "text" },
    { key: FM_KEY.REPORTS_TO, label: "Reports To", type: "suggester", entityTag: ENTITY_TAGS.person },
    { key: FM_KEY.NOTES, label: "Notes", type: "textarea" },
  ],
  [ENTITY_TYPE.INBOX]: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: [...INBOX_STATUSES] },
  ],
  [ENTITY_TYPE.SINGLE_MEETING]: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.DATE, label: "Date", type: "datetime" },
    { key: FM_KEY.ATTENDEES, label: "Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  [ENTITY_TYPE.RECURRING_MEETING]: [
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.START_DATE, label: "Start Date", type: "date" },
    { key: FM_KEY.END_DATE, label: "End Date", type: "date" },
    { key: FM_KEY.DEFAULT_ATTENDEES, label: "Default Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  [ENTITY_TYPE.RECURRING_MEETING_EVENT]: [
    { key: FM_KEY.RECURRING_MEETING, label: "Recurring Meeting", type: "suggester-by-folder" },
    { key: FM_KEY.DATE, label: "Date", type: "datetime" },
    { key: FM_KEY.ATTENDEES, label: "Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  [ENTITY_TYPE.PROJECT_NOTE]: [
    { key: FM_KEY.RELATED_PROJECT, label: "Related Project", type: "text" },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
  ],
  [ENTITY_TYPE.RAID_ITEM]: [
    { key: FM_KEY.RAID_TYPE, label: "RAID Type", type: "select", options: RAID_TYPES },
    { key: FM_KEY.STATUS, label: "Status", type: "select", options: RAID_STATUSES },
    { key: FM_KEY.LIKELIHOOD, label: "Likelihood", type: "select", options: LIKELIHOODS },
    { key: FM_KEY.IMPACT, label: "Impact", type: "select", options: IMPACTS_SEVERITY_FIRST },
    { key: FM_KEY.CLIENT, label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: FM_KEY.OWNER, label: "Owner", type: "suggester", entityTag: ENTITY_TAGS.person },
    { key: FM_KEY.RAISED_DATE, label: "Raised Date", type: "date" },
    { key: FM_KEY.CLOSED_DATE, label: "Closed Date", type: "date" },
    { key: FM_KEY.DESCRIPTION, label: "Description", type: "textarea" },
  ],
  [ENTITY_TYPE.REFERENCE_TOPIC]: [],
  [ENTITY_TYPE.REFERENCE]: [
    { key: FM_KEY.TOPICS,     label: "Topics",     type: "list-suggester", entityTag: ENTITY_TAGS.referenceTopic },
    { key: FM_KEY.CLIENT,     label: "Client",     type: "suggester",      entityTag: ENTITY_TAGS.client },
    { key: FM_KEY.ENGAGEMENT, label: "Engagement", type: "suggester",      entityTag: ENTITY_TAGS.engagement, enriched: true },
  ],
};

// ─── Entity field-change side-effects ───────────────────────────────────────

/** A co-located rule the generic property editor runs after applying a field change. */
export type FieldChangeHook = (fm: Record<string, unknown>, key: string, value: unknown) => void;

/**
 * Per-entity field side-effects, co-located with each entity's field schema. The
 * generic property editor dispatches these instead of hard-coding entity-specific
 * rules: it never branches on entity type itself.
 */
export const ENTITY_FIELD_HOOKS: Partial<Record<EntityType, FieldChangeHook>> = {
  // Auto-set the closed-date when a RAID item moves to a closed status; clear it
  // when it returns to an active one.
  [ENTITY_TYPE.RAID_ITEM]: (fm, key, value) => {
    if (key !== FM_KEY.STATUS) return;
    const status = String(value ?? "") as RaidStatus;
    if (RAID_CLOSED_STATUSES.has(status) && !fm[FM_KEY.CLOSED_DATE]) {
      fm[FM_KEY.CLOSED_DATE] = todayUTCISO();
    } else if (RAID_OPEN_STATUSES.has(status)) {
      delete fm[FM_KEY.CLOSED_DATE];
    }
  },
};
