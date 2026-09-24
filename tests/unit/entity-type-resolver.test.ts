import { describe, it, expect } from "vitest";
import { EntityTypeResolver } from "@/services/entity-type-resolver";
import { createMockPage } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS, ENTITY_TAGS, ENTITY_TYPE } from "@/constants";

describe("EntityTypeResolver", () => {
  const resolver = new EntityTypeResolver();

  it("resolves a tagged page by its tag", () => {
    const page = createMockPage({ path: "clients/Acme.md", folder: "clients", tags: [ENTITY_TAGS.client] });
    expect(resolver.resolve(page)).toBe(ENTITY_TYPE.CLIENT);
  });

  it("prefers the tag over the folder", () => {
    const page = createMockPage({
      path: "inbox/Risky.md",
      folder: DEFAULT_FOLDERS.inbox,
      tags: [ENTITY_TAGS.raid],
    });
    expect(resolver.resolve(page)).toBe(ENTITY_TYPE.RAID_ITEM);
  });

  it("resolves an untagged page by its folder", () => {
    const page = createMockPage({ path: "meetings/single/Kickoff.md", folder: DEFAULT_FOLDERS.meetingsSingle });
    expect(resolver.resolve(page)).toBe(ENTITY_TYPE.SINGLE_MEETING);
  });

  it("resolves a nested untagged page to its most specific folder", () => {
    const page = createMockPage({ path: "projects/notes/foo/Note.md", folder: "projects/notes/foo" });
    expect(resolver.resolve(page)).toBe(ENTITY_TYPE.PROJECT_NOTE);
  });

  it("returns null when neither tag nor folder matches", () => {
    const page = createMockPage({ path: "daily notes/2024-01-01.md", folder: "daily notes" });
    expect(resolver.resolve(page)).toBeNull();
  });
});
