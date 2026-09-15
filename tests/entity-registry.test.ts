import { describe, it, expect } from "vitest";
import {
  ENTITY_KINDS,
  EntityQueryRegistry,
  registerBuiltInEntityQueries,
} from "@/entity-registry";
import { ENTITY_FIELDS } from "@/processors/entity-field-config";
import { RaidQuery } from "@/services/raid-query";
import { RefQuery } from "@/services/ref-query";
import { ENTITY_TAGS, DEFAULT_FOLDERS } from "@/constants";
import type { EntityType } from "@/types";

const ALL_TYPES: EntityType[] = [
  "client", "engagement", "project", "person", "inbox", "single-meeting",
  "recurring-meeting", "recurring-meeting-event", "project-note", "raid-item",
  "reference", "reference-topic",
];

describe("ENTITY_KINDS identity catalog", () => {
  it("has one entry per EntityType, each carrying its field schema", () => {
    for (const type of ALL_TYPES) {
      expect(ENTITY_KINDS[type]).toBeDefined();
      expect(ENTITY_KINDS[type].fields).toBe(ENTITY_FIELDS[type]);
    }
  });

  it("maps tag and folder where they apply, and omits the tag for untagged kinds", () => {
    expect(ENTITY_KINDS["raid-item"].tag).toBe(ENTITY_TAGS.raid);
    expect(ENTITY_KINDS["raid-item"].folder).toBe(DEFAULT_FOLDERS.raid);
    // Inbox has a folder but no Dataview tag.
    expect(ENTITY_KINDS.inbox.tag).toBeUndefined();
    expect(ENTITY_KINDS.inbox.folder).toBe(DEFAULT_FOLDERS.inbox);
  });
});

describe("EntityQueryRegistry", () => {
  it("resolves a registered factory to its query, threading the dv accessor", () => {
    const registry = new EntityQueryRegistry();
    const getDv = () => null;
    registry.register("raid-item", (dv) => new RaidQuery(dv));

    expect(registry.has("raid-item")).toBe(true);
    const query = registry.resolve("raid-item", getDv);
    expect(query).toBeInstanceOf(RaidQuery);
    // The built query is usable and honours the dv accessor (null → empty).
    expect(query?.resolve()).toEqual([]);
  });

  it("resolves an unregistered kind to null (Partial-tolerant)", () => {
    const registry = new EntityQueryRegistry();
    expect(registry.has("project")).toBe(false);
    expect(registry.resolve("project", () => null)).toBeNull();
  });

  it("back-fills the RAID and Reference queries that shipped before it", () => {
    const registry = new EntityQueryRegistry();
    registerBuiltInEntityQueries(registry);

    expect(registry.resolve("raid-item", () => null)).toBeInstanceOf(RaidQuery);
    expect(registry.resolve("reference", () => null)).toBeInstanceOf(RefQuery);
    // A kind whose query lands in a later phase stays unregistered for now.
    expect(registry.resolve("project", () => null)).toBeNull();
  });
});
