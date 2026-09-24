import { describe, it, expect } from "vitest";
import { SearchService } from "@/services/search-service";
import { EntityEnumerator } from "@/services/entity-enumerator";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import { PersonAssociationResolver } from "@/services/person-association-resolver";
import { PreparedFuzzyMatcher } from "@/services/prepared-fuzzy-matcher";
import { QueryService } from "@/services/query-service";
import { rankCandidatesByName, type IFuzzyMatcher } from "@/services/fuzzy-matcher";
import { createMockDataviewApi, type MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS, ENTITY_TYPE } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { DataviewApi, SearchScope } from "@/types";

const folders = DEFAULT_FOLDERS as unknown as FolderSettings;

/** A vault spanning both client hierarchies, with people, a RAID item and a meeting. */
const VAULT: MockPageData[] = [
  { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
  { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
  { path: "engagements/Acme Phase 1.md", folder: "engagements", tags: ["#engagement"], frontmatter: { client: "[[Acme]]" } },
  { path: "engagements/Globex Phase.md", folder: "engagements", tags: ["#engagement"], frontmatter: { client: "[[Globex]]" } },
  { path: "projects/Acme Portal.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Acme Phase 1]]" } },
  { path: "projects/Globex Portal.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Globex Phase]]" } },
  { path: "people/Alice.md", folder: "people", tags: ["#person"], frontmatter: { client: "[[Acme]]" } },
  { path: "people/Bob.md", folder: "people", tags: ["#person"], frontmatter: { client: "[[Acme]]", "reports-to": "[[Alice]]" } },
  { path: "raid/Acme Risk.md", folder: "raid", tags: ["#raid"], frontmatter: { engagement: "[[Acme Phase 1]]", owner: "[[Alice]]" } },
  {
    path: "meetings/single/Acme Kickoff.md",
    folder: "meetings/single",
    frontmatter: { engagement: "[[Acme Phase 1]]", attendees: ["[[Alice]]", "[[Bob]]"] },
  },
];

const EMPTY_SCOPE: SearchScope = {};

function serviceFor(
  pages: MockPageData[],
  matcher: IFuzzyMatcher = new PreparedFuzzyMatcher(),
  getDv: () => DataviewApi | null = () => createMockDataviewApi(pages)
): SearchService {
  const query = new QueryService(getDv, folders);
  return new SearchService({
    getDv,
    enumerator: new EntityEnumerator(query),
    hierarchyService: new EntityHierarchyService(getDv, folders),
    personResolver: new PersonAssociationResolver(getDv, folders),
    matcher,
  });
}

const names = (results: { page: { file: { name: string } } }[]): string[] =>
  results.map((r) => r.page.file.name).sort();

describe("SearchService", () => {
  it("fuzzy-ranks by name (best first) and excludes non-matches", () => {
    const service = serviceFor([
      { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
      { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
      { path: "clients/Apex Acme Ltd.md", folder: "clients", tags: ["#client"] },
    ]);

    const results = service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    // Order is preserved from ranking, so this is asserted unsorted.
    expect(results.map((r) => r.page.file.name)).toEqual(["Acme", "Apex Acme Ltd"]);
  });

  it("ranks through an injected fake matcher without touching Obsidian", () => {
    const scores: Record<string, number> = { "Acme Portal": 5, "Globex Portal": 9 };
    const fake: IFuzzyMatcher = { prepare: () => (text) => scores[text] ?? null };
    const service = serviceFor(VAULT, fake);

    const results = service.search("portal", EMPTY_SCOPE, [ENTITY_TYPE.PROJECT]);

    expect(results.map((r) => r.page.file.name)).toEqual(["Globex Portal", "Acme Portal"]);
  });

  it("attaches the resolved client/engagement breadcrumb to each result", () => {
    const service = serviceFor(VAULT);

    const [result] = service.search("", EMPTY_SCOPE, [ENTITY_TYPE.RAID_ITEM]);

    expect(result.page.file.name).toBe("Acme Risk");
    expect(result.type).toBe(ENTITY_TYPE.RAID_ITEM);
    expect(result.client).toBe("Acme");
    expect(result.engagement).toBe("Acme Phase 1");
  });

  it("constrains by client scope (up the hierarchy)", () => {
    const service = serviceFor(VAULT);

    const results = service.search("", { clients: ["Acme"] }, [ENTITY_TYPE.PROJECT]);

    expect(names(results)).toEqual(["Acme Portal"]);
  });

  it("constrains by engagement scope", () => {
    const service = serviceFor(VAULT);

    const results = service.search("", { engagements: ["Acme Phase 1"] }, [
      ENTITY_TYPE.PROJECT,
      ENTITY_TYPE.RAID_ITEM,
    ]);

    expect(names(results)).toEqual(["Acme Portal", "Acme Risk"]);
  });

  it("constrains by person scope — self, RAID owner and meeting attendee", () => {
    const service = serviceFor(VAULT);

    const results = service.search("", { people: ["Alice"] }, [
      ENTITY_TYPE.PERSON,
      ENTITY_TYPE.RAID_ITEM,
      ENTITY_TYPE.SINGLE_MEETING,
    ]);

    // Alice (self), Bob (reports-to Alice), the RAID item she owns, the meeting she attends.
    expect(names(results)).toEqual(["Acme Kickoff", "Acme Risk", "Alice", "Bob"]);
  });

  it("combines facets with AND across client and person", () => {
    const service = serviceFor(VAULT);

    const results = service.search("", { clients: ["Acme"], people: ["Alice"] }, [
      ENTITY_TYPE.PROJECT,
      ENTITY_TYPE.RAID_ITEM,
    ]);

    // Acme Portal resolves to client Acme but carries no people, so AND drops it.
    expect(names(results)).toEqual(["Acme Risk"]);
  });

  it("applies no hierarchy constraint when the scope is empty", () => {
    const service = serviceFor(VAULT);

    const results = service.search("", EMPTY_SCOPE, [ENTITY_TYPE.PROJECT]);

    expect(names(results)).toEqual(["Acme Portal", "Globex Portal"]);
  });

  it("returns an empty list without throwing when Dataview is absent", () => {
    const service = serviceFor(VAULT, new PreparedFuzzyMatcher(), () => null);

    expect(service.search("acme", { clients: ["Acme"] }, [ENTITY_TYPE.CLIENT])).toEqual([]);
  });
});

// A light re-export sanity check keeps the pure ranker's public surface covered here too.
describe("fuzzy ranking is composable", () => {
  it("re-ranks an already-enumerated candidate list", () => {
    const api = createMockDataviewApi(VAULT);
    const candidates = [
      { page: api.page("projects/Acme Portal.md")!, type: ENTITY_TYPE.PROJECT },
      { page: api.page("projects/Globex Portal.md")!, type: ENTITY_TYPE.PROJECT },
    ];
    const fake: IFuzzyMatcher = { prepare: () => (text) => (text === "Globex Portal" ? 1 : 2) };

    expect(rankCandidatesByName(candidates, "portal", fake).map((c) => c.page.file.name)).toEqual([
      "Acme Portal",
      "Globex Portal",
    ]);
  });
});
