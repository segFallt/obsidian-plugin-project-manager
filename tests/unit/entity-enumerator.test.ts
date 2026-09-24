import { describe, it, expect } from "vitest";
import { EntityEnumerator, type IEntityEnumerationQuery } from "@/services/entity-enumerator";
import { QueryService } from "@/services/query-service";
import { createMockDataviewApi, type MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS, ENTITY_TAGS, ENTITY_TYPE } from "@/constants";
import type { FolderSettings } from "@/settings";

const folders = DEFAULT_FOLDERS as unknown as FolderSettings;

function enumeratorFor(pages: MockPageData[]): EntityEnumerator {
  const query = new QueryService(() => createMockDataviewApi(pages), folders);
  return new EntityEnumerator(query);
}

describe("EntityEnumerator", () => {
  it("enumerates a tagged type through its tag, pairing each page with the type", () => {
    const enumerator = enumeratorFor([
      { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
      { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
      { path: "projects/Foo.md", folder: "projects", tags: ["#project"] },
    ]);

    const result = enumerator.candidates(ENTITY_TYPE.CLIENT);
    expect(result.map((c) => c.page.file.name).sort()).toEqual(["Acme", "Globex"]);
    expect(result.every((c) => c.type === ENTITY_TYPE.CLIENT)).toBe(true);
  });

  it("includes a tagged entity that lives outside the type's default folder", () => {
    const enumerator = enumeratorFor([
      { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
      { path: "clients/archive/Globex.md", folder: "clients/archive", tags: ["#client"] },
      { path: "elsewhere/Initech.md", folder: "elsewhere", tags: ["#client"] },
    ]);

    const result = enumerator.candidates(ENTITY_TYPE.CLIENT);
    expect(result.map((c) => c.page.file.name).sort()).toEqual(["Acme", "Globex", "Initech"]);
  });

  it("enumerates an untagged type by its folder", () => {
    const enumerator = enumeratorFor([
      { path: "meetings/single/Kickoff.md", folder: "meetings/single" },
      { path: "meetings/single/Review.md", folder: "meetings/single" },
      { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
    ]);

    const result = enumerator.candidates(ENTITY_TYPE.SINGLE_MEETING);
    expect(result.map((c) => c.page.file.name).sort()).toEqual(["Kickoff", "Review"]);
    expect(result.every((c) => c.type === ENTITY_TYPE.SINGLE_MEETING)).toBe(true);
  });

  it("returns an empty list without throwing when Dataview is unavailable", () => {
    const enumerator = new EntityEnumerator(new QueryService(() => null, folders));
    expect(enumerator.candidates(ENTITY_TYPE.CLIENT)).toEqual([]);
    expect(enumerator.candidates(ENTITY_TYPE.SINGLE_MEETING)).toEqual([]);
  });

  it("dispatches by strategy over the narrow query surface (ISP)", () => {
    const calls: string[] = [];
    const stub: IEntityEnumerationQuery = {
      getEntitiesByTag: (tag) => {
        calls.push(`tag:${tag}`);
        return [];
      },
      getEntitiesByFolder: (folder) => {
        calls.push(`folder:${folder}`);
        return [];
      },
    };
    const enumerator = new EntityEnumerator(stub);

    enumerator.candidates(ENTITY_TYPE.CLIENT);
    enumerator.candidates(ENTITY_TYPE.INBOX);

    expect(calls).toEqual([`tag:${ENTITY_TAGS.client}`, `folder:${DEFAULT_FOLDERS.inbox}`]);
  });
});
