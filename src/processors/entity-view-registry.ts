import type { PmActionConfig, PmTableConfig } from "../types";

// ─── Registry types ───────────────────────────────────────────────────────────

export interface EntityViewSection {
  heading?: string;
  actions?: PmActionConfig[];
  tables?: Array<{ type: PmTableConfig["type"] }>;
}

/** Registry keyed by entity type → section name → section definition. */
export type EntityViewRegistry = Record<string, Record<string, EntityViewSection>>;

// ─── Section definitions ─────────────────────────────────────────────────────

export const ENTITY_VIEW_SECTIONS: EntityViewRegistry = {
  project: {
    linked: {
      heading: "Linked",
      actions: [
        { type: "create-project-note", label: "New Project Note", style: "primary", context: { field: "relatedProject" } },
      ],
      tables: [{ type: "related-project-notes" }],
    },
  },
  client: {
    engagements: {
      heading: "Engagements",
      actions: [
        { type: "create-engagement", label: "New Engagement", style: "primary", context: { field: "client" } },
      ],
      tables: [{ type: "client-engagements" }],
    },
    people: {
      heading: "People",
      actions: [
        { type: "create-person", label: "New Person", style: "primary", context: { field: "client" } },
      ],
      tables: [{ type: "client-people" }],
    },
  },
  engagement: {
    projects: {
      heading: "Projects",
      actions: [
        { type: "create-project", label: "New Project", style: "primary", context: { field: "engagement" } },
      ],
      tables: [{ type: "engagement-projects" }],
    },
  },
  person: {
    mentions: {
      heading: "Mentions",
      tables: [{ type: "mentions" }],
    },
  },
};
