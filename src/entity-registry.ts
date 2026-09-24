import type { DataviewApi, DataviewPage, EntityType, EnumStrategy } from "./types";
import type { EntityFamily } from "./types";
import {
  ENTITY_TAGS,
  DEFAULT_FOLDERS,
  ENTITY_TYPE,
  ENUM_STRATEGY,
  ENTITY_LABEL,
  ENTITY_ICON,
  ENTITY_FAMILY,
  ENTITY_FAMILY_COLOR_TOKEN,
} from "./constants";
import { ENTITY_FIELDS } from "./processors/entity-field-config";
import type { FieldDescriptor } from "./processors/entity-field-config";
import type { IEntityQuery } from "./services/entity-query";
import { RaidQuery } from "./services/raid-query";
import { RefQuery } from "./services/ref-query";

/**
 * ─── Entity identity catalog ─────────────────────────────────────────────────
 *
 * One thin, dumb record per {@link EntityType}: how it is tagged and foldered
 * (both optional — not every kind has a Dataview tag or a fixed home) plus its
 * property-editor field schema. `EntityType`, `ENTITY_TAGS`, and `DEFAULT_FOLDERS`
 * use non-aligned key spellings, so this catalog is the one place that maps a
 * kind to each.
 */
export interface EntityKind {
  /** Dataview tag, when the entity is tagged. */
  tag?: string;
  /** Default vault folder, when the entity has a fixed home. */
  folder?: string;
  /** Frontmatter field schema the property editor renders. */
  fields: FieldDescriptor[];
  /** How the kind is enumerated: by its tag (tagged types) or by its folder (untagged types). */
  strategy: EnumStrategy;
}

export const ENTITY_KINDS: Record<EntityType, EntityKind> = {
  [ENTITY_TYPE.CLIENT]: { tag: ENTITY_TAGS.client, folder: DEFAULT_FOLDERS.clients, fields: ENTITY_FIELDS[ENTITY_TYPE.CLIENT], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.ENGAGEMENT]: { tag: ENTITY_TAGS.engagement, folder: DEFAULT_FOLDERS.engagements, fields: ENTITY_FIELDS[ENTITY_TYPE.ENGAGEMENT], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.PROJECT]: { tag: ENTITY_TAGS.project, folder: DEFAULT_FOLDERS.projects, fields: ENTITY_FIELDS[ENTITY_TYPE.PROJECT], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.PERSON]: { tag: ENTITY_TAGS.person, folder: DEFAULT_FOLDERS.people, fields: ENTITY_FIELDS[ENTITY_TYPE.PERSON], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.INBOX]: { folder: DEFAULT_FOLDERS.inbox, fields: ENTITY_FIELDS[ENTITY_TYPE.INBOX], strategy: ENUM_STRATEGY.FOLDER },
  [ENTITY_TYPE.SINGLE_MEETING]: { folder: DEFAULT_FOLDERS.meetingsSingle, fields: ENTITY_FIELDS[ENTITY_TYPE.SINGLE_MEETING], strategy: ENUM_STRATEGY.FOLDER },
  [ENTITY_TYPE.RECURRING_MEETING]: { folder: DEFAULT_FOLDERS.meetingsRecurring, fields: ENTITY_FIELDS[ENTITY_TYPE.RECURRING_MEETING], strategy: ENUM_STRATEGY.FOLDER },
  [ENTITY_TYPE.RECURRING_MEETING_EVENT]: {
    folder: DEFAULT_FOLDERS.meetingsRecurringEvents,
    fields: ENTITY_FIELDS[ENTITY_TYPE.RECURRING_MEETING_EVENT],
    strategy: ENUM_STRATEGY.FOLDER,
  },
  [ENTITY_TYPE.PROJECT_NOTE]: { folder: DEFAULT_FOLDERS.projectNotes, fields: ENTITY_FIELDS[ENTITY_TYPE.PROJECT_NOTE], strategy: ENUM_STRATEGY.FOLDER },
  [ENTITY_TYPE.RAID_ITEM]: { tag: ENTITY_TAGS.raid, folder: DEFAULT_FOLDERS.raid, fields: ENTITY_FIELDS[ENTITY_TYPE.RAID_ITEM], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.REFERENCE]: { tag: ENTITY_TAGS.reference, folder: DEFAULT_FOLDERS.references, fields: ENTITY_FIELDS[ENTITY_TYPE.REFERENCE], strategy: ENUM_STRATEGY.TAG },
  [ENTITY_TYPE.REFERENCE_TOPIC]: {
    tag: ENTITY_TAGS.referenceTopic,
    folder: DEFAULT_FOLDERS.referenceTopics,
    fields: ENTITY_FIELDS[ENTITY_TYPE.REFERENCE_TOPIC],
    strategy: ENUM_STRATEGY.TAG,
  },
};

/**
 * ─── Entity presentation registry ────────────────────────────────────────────
 *
 * One presentation descriptor per {@link EntityType}: the user-facing label, the
 * Obsidian/Lucide icon id, and the family-colour token *name* (the hex the token
 * resolves to is defined in the styling foundation, not here). This is the single
 * presentation source the search panel, type filter, and chips read; each field
 * is composed from a named constant so no display literal is inlined.
 */
export interface EntityPresentation {
  /** User-facing name for the type. */
  label: string;
  /** Obsidian/Lucide icon id. */
  icon: string;
  /** CSS custom-property token name carrying the type's family colour. */
  familyColorToken: string;
}

export const ENTITY_PRESENTATION: Record<EntityType, EntityPresentation> = {
  [ENTITY_TYPE.CLIENT]: { label: ENTITY_LABEL[ENTITY_TYPE.CLIENT], icon: ENTITY_ICON[ENTITY_TYPE.CLIENT], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.CLIENT] },
  [ENTITY_TYPE.ENGAGEMENT]: { label: ENTITY_LABEL[ENTITY_TYPE.ENGAGEMENT], icon: ENTITY_ICON[ENTITY_TYPE.ENGAGEMENT], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.ENGAGEMENT] },
  [ENTITY_TYPE.PROJECT]: { label: ENTITY_LABEL[ENTITY_TYPE.PROJECT], icon: ENTITY_ICON[ENTITY_TYPE.PROJECT], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.PROJECT] },
  [ENTITY_TYPE.PERSON]: { label: ENTITY_LABEL[ENTITY_TYPE.PERSON], icon: ENTITY_ICON[ENTITY_TYPE.PERSON], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.PERSON] },
  [ENTITY_TYPE.INBOX]: { label: ENTITY_LABEL[ENTITY_TYPE.INBOX], icon: ENTITY_ICON[ENTITY_TYPE.INBOX], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.INBOX] },
  [ENTITY_TYPE.SINGLE_MEETING]: { label: ENTITY_LABEL[ENTITY_TYPE.SINGLE_MEETING], icon: ENTITY_ICON[ENTITY_TYPE.SINGLE_MEETING], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.SINGLE_MEETING] },
  [ENTITY_TYPE.RECURRING_MEETING]: { label: ENTITY_LABEL[ENTITY_TYPE.RECURRING_MEETING], icon: ENTITY_ICON[ENTITY_TYPE.RECURRING_MEETING], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.RECURRING_MEETING] },
  [ENTITY_TYPE.RECURRING_MEETING_EVENT]: { label: ENTITY_LABEL[ENTITY_TYPE.RECURRING_MEETING_EVENT], icon: ENTITY_ICON[ENTITY_TYPE.RECURRING_MEETING_EVENT], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.RECURRING_MEETING_EVENT] },
  [ENTITY_TYPE.PROJECT_NOTE]: { label: ENTITY_LABEL[ENTITY_TYPE.PROJECT_NOTE], icon: ENTITY_ICON[ENTITY_TYPE.PROJECT_NOTE], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.PROJECT_NOTE] },
  [ENTITY_TYPE.RAID_ITEM]: { label: ENTITY_LABEL[ENTITY_TYPE.RAID_ITEM], icon: ENTITY_ICON[ENTITY_TYPE.RAID_ITEM], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.RAID_ITEM] },
  [ENTITY_TYPE.REFERENCE]: { label: ENTITY_LABEL[ENTITY_TYPE.REFERENCE], icon: ENTITY_ICON[ENTITY_TYPE.REFERENCE], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.REFERENCE] },
  [ENTITY_TYPE.REFERENCE_TOPIC]: { label: ENTITY_LABEL[ENTITY_TYPE.REFERENCE_TOPIC], icon: ENTITY_ICON[ENTITY_TYPE.REFERENCE_TOPIC], familyColorToken: ENTITY_FAMILY_COLOR_TOKEN[ENTITY_TYPE.REFERENCE_TOPIC] },
};

/**
 * ─── Entity family grouping ──────────────────────────────────────────────────
 *
 * One ordered group per presentation family: the family key (its heading is read
 * from {@link ENTITY_FAMILY_LABEL}) paired with its member {@link EntityType}s in
 * display order. This is the single source the type filter iterates to lay out
 * its family-grouped toggles, so grouping and ordering live in one place and the
 * view carries no per-type family branch (OCP).
 */
export interface EntityFamilyGroup {
  /** Family key, whose heading label is looked up in `ENTITY_FAMILY_LABEL`. */
  family: EntityFamily;
  /** Member types, in the order their toggles render within the family row. */
  types: EntityType[];
}

export const ENTITY_FAMILY_GROUPS: EntityFamilyGroup[] = [
  { family: ENTITY_FAMILY.ACCOUNTS, types: [ENTITY_TYPE.CLIENT, ENTITY_TYPE.ENGAGEMENT, ENTITY_TYPE.PROJECT] },
  { family: ENTITY_FAMILY.PEOPLE, types: [ENTITY_TYPE.PERSON] },
  {
    family: ENTITY_FAMILY.MEETINGS,
    types: [ENTITY_TYPE.SINGLE_MEETING, ENTITY_TYPE.RECURRING_MEETING, ENTITY_TYPE.RECURRING_MEETING_EVENT],
  },
  { family: ENTITY_FAMILY.CAPTURE, types: [ENTITY_TYPE.INBOX] },
  {
    family: ENTITY_FAMILY.KNOWLEDGE,
    types: [ENTITY_TYPE.REFERENCE, ENTITY_TYPE.REFERENCE_TOPIC, ENTITY_TYPE.PROJECT_NOTE],
  },
  { family: ENTITY_FAMILY.RISK, types: [ENTITY_TYPE.RAID_ITEM] },
];

/**
 * ─── Entity query registry ───────────────────────────────────────────────────
 *
 * The read axis of the entity registry: a runtime-populated factory table
 * mapping a kind to a builder for its {@link IEntityQuery}. Queries cannot be
 * static instances — they close over a live Dataview accessor supplied at
 * resolve time — so the registry stores factories and is Partial-tolerant: a
 * kind with no registered factory resolves to `null`, so a generic by-kind
 * consumer never breaks on a not-yet-registered kind.
 */
export type EntityQueryFactory = (getDv: () => DataviewApi | null) => IEntityQuery<DataviewPage>;

export class EntityQueryRegistry {
  private readonly factories: Partial<Record<EntityType, EntityQueryFactory>> = {};

  /** Registers the factory that builds `type`'s query. Last registration wins. */
  register(type: EntityType, factory: EntityQueryFactory): void {
    this.factories[type] = factory;
  }

  /** Whether a factory is registered for `type`. */
  has(type: EntityType): boolean {
    return this.factories[type] !== undefined;
  }

  /** Builds `type`'s query via its registered factory, or `null` when none is registered. */
  resolve(type: EntityType, getDv: () => DataviewApi | null): IEntityQuery<DataviewPage> | null {
    const factory = this.factories[type];
    return factory ? factory(getDv) : null;
  }
}

/** The shared entity-query registry, populated during plugin init. */
export const ENTITY_QUERIES = new EntityQueryRegistry();

/**
 * Back-fills the queries that shipped before the registry existed — the RAID and
 * Reference reads — into `registry`. Called once during plugin init; accepts an
 * explicit registry so tests can populate an isolated instance.
 */
export function registerBuiltInEntityQueries(registry: EntityQueryRegistry = ENTITY_QUERIES): void {
  registry.register(ENTITY_TYPE.RAID_ITEM, (getDv) => new RaidQuery(getDv));
  registry.register(ENTITY_TYPE.REFERENCE, (getDv) => new RefQuery(getDv));
}
