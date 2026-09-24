import { describe, it, expect } from "vitest";
import { PersonAssociationResolver } from "@/services/person-association-resolver";
import { createMockDataviewApi, type MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { DataviewApi } from "@/types";

const folders = DEFAULT_FOLDERS as unknown as FolderSettings;

/** The reporting line Bob → Alice → Carol plus the non-person entities under test. */
const PAGES: MockPageData[] = [
  { path: "people/Carol.md", folder: "people", tags: ["#person"], frontmatter: { client: "[[Acme]]" } },
  { path: "people/Alice.md", folder: "people", tags: ["#person"], frontmatter: { "reports-to": "[[Carol]]" } },
  { path: "people/Bob.md", folder: "people", tags: ["#person"], frontmatter: { "reports-to": "[[Alice]]" } },
  { path: "raid/Acme Risk.md", folder: "raid", tags: ["#raid"], frontmatter: { owner: "[[Alice]]" } },
  {
    path: "meetings/single/Kickoff.md",
    folder: "meetings/single",
    frontmatter: { attendees: ["[[Alice]]", "[[Bob]]"] },
  },
  {
    path: "meetings/recurring/Standup.md",
    folder: "meetings/recurring",
    frontmatter: { "default-attendees": ["[[Carol]]"] },
  },
  { path: "projects/Portal.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Acme Phase 1]]" } },
];

function resolverFor(pages: MockPageData[], getDv: () => DataviewApi | null = () => createMockDataviewApi(pages)) {
  const api = getDv();
  const resolve = (path: string) => new PersonAssociationResolver(getDv, folders).peopleOf(api!.page(path)!);
  return resolve;
}

describe("PersonAssociationResolver", () => {
  it("associates a #person note with itself", () => {
    expect(resolverFor(PAGES)("people/Carol.md")).toContain("Carol");
  });

  it("associates a RAID item with its owner", () => {
    expect(resolverFor(PAGES)("raid/Acme Risk.md")).toEqual(["Alice"]);
  });

  it("associates a meeting with its attendees", () => {
    expect(resolverFor(PAGES)("meetings/single/Kickoff.md").sort()).toEqual(["Alice", "Bob"]);
  });

  it("associates a recurring meeting with its default-attendees", () => {
    expect(resolverFor(PAGES)("meetings/recurring/Standup.md")).toEqual(["Carol"]);
  });

  it("walks the full reports-to chain for a person", () => {
    // Bob → Alice → Carol: Bob is associated with himself and every manager up the line.
    expect(resolverFor(PAGES)("people/Bob.md").sort()).toEqual(["Alice", "Bob", "Carol"]);
  });

  it("returns no people for an entity that carries none", () => {
    expect(resolverFor(PAGES)("projects/Portal.md")).toEqual([]);
  });

  it("degrades to a single reports-to level when Dataview is unavailable", () => {
    const api = createMockDataviewApi(PAGES);
    const people = new PersonAssociationResolver(() => null, folders).peopleOf(api.page("people/Bob.md")!);
    // Only the directly-linked manager is reachable without Dataview to load the chain.
    expect(people.sort()).toEqual(["Alice", "Bob"]);
  });
});
