import type { DataviewApi, DataviewPage, EntityType } from "./types";
import { ENTITY_TAGS, DEFAULT_FOLDERS, ENTITY_TYPE } from "./constants";
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
}

export const ENTITY_KINDS: Record<EntityType, EntityKind> = {
  [ENTITY_TYPE.CLIENT]: { tag: ENTITY_TAGS.client, folder: DEFAULT_FOLDERS.clients, fields: ENTITY_FIELDS[ENTITY_TYPE.CLIENT] },
  [ENTITY_TYPE.ENGAGEMENT]: { tag: ENTITY_TAGS.engagement, folder: DEFAULT_FOLDERS.engagements, fields: ENTITY_FIELDS[ENTITY_TYPE.ENGAGEMENT] },
  [ENTITY_TYPE.PROJECT]: { tag: ENTITY_TAGS.project, folder: DEFAULT_FOLDERS.projects, fields: ENTITY_FIELDS[ENTITY_TYPE.PROJECT] },
  [ENTITY_TYPE.PERSON]: { tag: ENTITY_TAGS.person, folder: DEFAULT_FOLDERS.people, fields: ENTITY_FIELDS[ENTITY_TYPE.PERSON] },
  [ENTITY_TYPE.INBOX]: { folder: DEFAULT_FOLDERS.inbox, fields: ENTITY_FIELDS[ENTITY_TYPE.INBOX] },
  [ENTITY_TYPE.SINGLE_MEETING]: { folder: DEFAULT_FOLDERS.meetingsSingle, fields: ENTITY_FIELDS[ENTITY_TYPE.SINGLE_MEETING] },
  [ENTITY_TYPE.RECURRING_MEETING]: { folder: DEFAULT_FOLDERS.meetingsRecurring, fields: ENTITY_FIELDS[ENTITY_TYPE.RECURRING_MEETING] },
  [ENTITY_TYPE.RECURRING_MEETING_EVENT]: {
    folder: DEFAULT_FOLDERS.meetingsRecurringEvents,
    fields: ENTITY_FIELDS[ENTITY_TYPE.RECURRING_MEETING_EVENT],
  },
  [ENTITY_TYPE.PROJECT_NOTE]: { folder: DEFAULT_FOLDERS.projectNotes, fields: ENTITY_FIELDS[ENTITY_TYPE.PROJECT_NOTE] },
  [ENTITY_TYPE.RAID_ITEM]: { tag: ENTITY_TAGS.raid, folder: DEFAULT_FOLDERS.raid, fields: ENTITY_FIELDS[ENTITY_TYPE.RAID_ITEM] },
  [ENTITY_TYPE.REFERENCE]: { tag: ENTITY_TAGS.reference, folder: DEFAULT_FOLDERS.references, fields: ENTITY_FIELDS[ENTITY_TYPE.REFERENCE] },
  [ENTITY_TYPE.REFERENCE_TOPIC]: {
    tag: ENTITY_TAGS.referenceTopic,
    folder: DEFAULT_FOLDERS.referenceTopics,
    fields: ENTITY_FIELDS[ENTITY_TYPE.REFERENCE_TOPIC],
  },
};

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
