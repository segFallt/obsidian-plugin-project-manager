import { describe, it, expect, vi } from "vitest";
import { SearchService } from "@/services/search-service";
import { EntityEnumerator } from "@/services/entity-enumerator";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import { PersonAssociationResolver } from "@/services/person-association-resolver";
import { SubstringMatcher } from "@/services/substring-matcher";
import { QueryService } from "@/services/query-service";
import { rankCandidates, type ITextMatcher, type RankInput, type SearchField } from "@/services/matcher";
import type { IContentProvider } from "@/services/content-provider";
import { createMockDataviewApi, createMockPage, type MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS, EMPTY_QUERY, ENTITY_TYPE, MATCH_FIELD, NO_SEARCH_RESULTS } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { DataviewApi, DataviewPage, SearchScope } from "@/types";

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

/** A content provider backed by a path → body map; unmapped paths read as empty. */
function contentFrom(bodies: Record<string, string>): IContentProvider {
  return { textFor: async (page: DataviewPage) => bodies[page.file.path] ?? "" };
}

const NO_CONTENT: IContentProvider = contentFrom({});

function serviceFor(
  pages: MockPageData[],
  matcher: ITextMatcher = new SubstringMatcher(),
  getDv: () => DataviewApi | null = () => createMockDataviewApi(pages),
  contentProvider: IContentProvider = NO_CONTENT,
  bodyMatcher: ITextMatcher = matcher
): SearchService {
  const query = new QueryService(getDv, folders);
  const fields: readonly SearchField[] = [
    { field: MATCH_FIELD.NAME, matcher, buildsSnippet: false },
    { field: MATCH_FIELD.BODY, matcher: bodyMatcher, buildsSnippet: true },
  ];
  return new SearchService({
    getDv,
    enumerator: new EntityEnumerator(query),
    hierarchyService: new EntityHierarchyService(getDv, folders),
    personResolver: new PersonAssociationResolver(getDv, folders),
    contentProvider,
    fields,
  });
}

const names = (results: readonly { page: { file: { name: string } } }[]): string[] =>
  results.map((r) => r.page.file.name).sort();

/** Result names in the order the service returned them (unsorted). */
const orderedNames = (results: readonly { page: { file: { name: string } } }[]): string[] =>
  results.map((r) => r.page.file.name);

describe("SearchService — name ranking and scope", () => {
  it("ranks name substring matches by first-occurrence position and excludes non-matches", async () => {
    const service = serviceFor([
      { path: "clients/Aardvark Acme.md", folder: "clients", tags: ["#client"] },
      { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
      { path: "clients/Acme Zulu.md", folder: "clients", tags: ["#client"] },
    ]);

    const results = await service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    // Alphabetical order is the reverse of occurrence order, so only first-occurrence
    // scoring (not the alphabetical tiebreak) yields this order; asserted unsorted.
    expect(results.map((r) => r.page.file.name)).toEqual(["Acme Zulu", "Aardvark Acme"]);
  });

  it("ranks through an injected fake matcher without touching Obsidian", async () => {
    const scores: Record<string, number> = { "Acme Portal": 5, "Globex Portal": 9 };
    const fake: ITextMatcher = { prepare: () => (text) => (scores[text] != null ? { score: scores[text], matches: [] } : null) };
    const service = serviceFor(VAULT, fake);

    const results = await service.search("portal", EMPTY_SCOPE, [ENTITY_TYPE.PROJECT]);

    expect(results.map((r) => r.page.file.name)).toEqual(["Globex Portal", "Acme Portal"]);
  });

  it("attaches the resolved client/engagement breadcrumb to each result", async () => {
    const service = serviceFor(VAULT);

    const [result] = await service.search("", EMPTY_SCOPE, [ENTITY_TYPE.RAID_ITEM]);

    expect(result.page.file.name).toBe("Acme Risk");
    expect(result.type).toBe(ENTITY_TYPE.RAID_ITEM);
    expect(result.client).toBe("Acme");
    expect(result.engagement).toBe("Acme Phase 1");
  });

  it("constrains by client scope (up the hierarchy)", async () => {
    const service = serviceFor(VAULT);

    const results = await service.search("", { clients: ["Acme"] }, [ENTITY_TYPE.PROJECT]);

    expect(names(results)).toEqual(["Acme Portal"]);
  });

  it("constrains by engagement scope", async () => {
    const service = serviceFor(VAULT);

    const results = await service.search("", { engagements: ["Acme Phase 1"] }, [
      ENTITY_TYPE.PROJECT,
      ENTITY_TYPE.RAID_ITEM,
    ]);

    expect(names(results)).toEqual(["Acme Portal", "Acme Risk"]);
  });

  it("constrains by person scope — self, RAID owner and meeting attendee", async () => {
    const service = serviceFor(VAULT);

    const results = await service.search("", { people: ["Alice"] }, [
      ENTITY_TYPE.PERSON,
      ENTITY_TYPE.RAID_ITEM,
      ENTITY_TYPE.SINGLE_MEETING,
    ]);

    // Alice (self), Bob (reports-to Alice), the RAID item she owns, the meeting she attends.
    expect(names(results)).toEqual(["Acme Kickoff", "Acme Risk", "Alice", "Bob"]);
  });

  it("combines facets with AND across client and person", async () => {
    const service = serviceFor(VAULT);

    const results = await service.search("", { clients: ["Acme"], people: ["Alice"] }, [
      ENTITY_TYPE.PROJECT,
      ENTITY_TYPE.RAID_ITEM,
    ]);

    // Acme Portal resolves to client Acme but carries no people, so AND drops it.
    expect(names(results)).toEqual(["Acme Risk"]);
  });

  it("applies no hierarchy constraint when the scope is empty", async () => {
    const service = serviceFor(VAULT);

    const results = await service.search("", EMPTY_SCOPE, [ENTITY_TYPE.PROJECT]);

    expect(names(results)).toEqual(["Acme Portal", "Globex Portal"]);
  });

  it("resolves to an empty list without throwing when Dataview is absent", async () => {
    const service = serviceFor(VAULT, new SubstringMatcher(), () => null);

    await expect(service.search("acme", { clients: ["Acme"] }, [ENTITY_TYPE.CLIENT])).resolves.toBe(
      NO_SEARCH_RESULTS
    );
  });
});

describe("SearchService — strict name matching and browse", () => {
  const NAME_VAULT: MockPageData[] = [
    { path: "clients/Northwind Trading.md", folder: "clients", tags: ["#client"] },
    { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
    { path: "clients/Apex Acme Ltd.md", folder: "clients", tags: ["#client"] },
  ];

  it("does not return a name that contains the query only as a gapped subsequence", async () => {
    const service = serviceFor(NAME_VAULT);

    await expect(service.search("nrthwnd", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT])).resolves.toEqual([]);
  });

  it("returns a name that contains the query in the middle", async () => {
    const service = serviceFor(NAME_VAULT);

    const results = await service.search("thwind", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    expect(orderedNames(results)).toEqual(["Northwind Trading"]);
  });

  it("trims the query's surrounding whitespace before matching", async () => {
    const service = serviceFor(NAME_VAULT);

    const results = await service.search("  acme  ", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    expect(orderedNames(results)).toEqual(["Acme", "Apex Acme Ltd"]);
  });

  it("carries the winning name field and its substring run on a name match", async () => {
    const service = serviceFor(NAME_VAULT);

    const results = await service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);
    const apex = results.find((r) => r.page.file.name === "Apex Acme Ltd");

    // "Acme" occupies [5, 9) in "Apex Acme Ltd".
    expect(apex?.match).toEqual({ field: MATCH_FIELD.NAME, matches: [[5, 9]] });
  });

  it("browses every in-scope entity sorted by name on an empty query, with no match", async () => {
    // Input order is Globex Portal, then Acme Portal; browse must reorder by name.
    const pages: MockPageData[] = [
      { path: "projects/Globex Portal.md", folder: "projects", tags: ["#project"] },
      { path: "projects/Acme Portal.md", folder: "projects", tags: ["#project"] },
    ];
    const service = serviceFor(pages);

    const results = await service.search(EMPTY_QUERY, EMPTY_SCOPE, [ENTITY_TYPE.PROJECT]);

    expect(orderedNames(results)).toEqual(["Acme Portal", "Globex Portal"]);
    for (const result of results) {
      expect(result.match).toBeUndefined();
      expect(result.snippet).toBeUndefined();
    }
  });

  it("browses on a whitespace-only query without reading any body", async () => {
    const textFor = vi.fn(async () => "acme in the body");
    const service = serviceFor(NAME_VAULT, new SubstringMatcher(), () => createMockDataviewApi(NAME_VAULT), {
      textFor,
    });

    const results = await service.search("   ", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    expect(orderedNames(results)).toEqual(["Acme", "Apex Acme Ltd", "Northwind Trading"]);
    expect(textFor).not.toHaveBeenCalled();
  });
});

describe("SearchService — content search", () => {
  const CONTENT_VAULT: MockPageData[] = [
    { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
    { path: "clients/Zephyr.md", folder: "clients", tags: ["#client"] },
  ];

  it("returns a note whose body matches the query, with a body snippet", async () => {
    const service = serviceFor(
      CONTENT_VAULT,
      new SubstringMatcher(),
      () => createMockDataviewApi(CONTENT_VAULT),
      contentFrom({ "clients/Zephyr.md": "the northwind team loves pineapple" })
    );

    const results = await service.search("pineapple", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    expect(results.map((r) => r.page.file.name)).toEqual(["Zephyr"]);
    expect(results[0].snippet?.text).toContain("pineapple");
    expect(results[0].snippet?.matches.length).toBeGreaterThan(0);
  });

  it("ranks a name match above a body-only match, and only the body match carries a snippet", async () => {
    const service = serviceFor(
      CONTENT_VAULT,
      new SubstringMatcher(),
      () => createMockDataviewApi(CONTENT_VAULT),
      // Acme also mentions "acme" in its body, but its name match wins the tier (no snippet).
      contentFrom({ "clients/Acme.md": "acme acme", "clients/Zephyr.md": "acme is referenced here" })
    );

    const results = await service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);

    expect(results.map((r) => r.page.file.name)).toEqual(["Acme", "Zephyr"]);
    expect(results[0].snippet).toBeUndefined();
    expect(results[1].snippet?.text).toContain("acme");
  });

  it("does not read bodies on the empty-query browse path, but does for a real query", async () => {
    const textFor = vi.fn(async () => "acme in the body");
    const service = serviceFor(CONTENT_VAULT, new SubstringMatcher(), () => createMockDataviewApi(CONTENT_VAULT), {
      textFor,
    });

    await service.search("", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);
    expect(textFor).not.toHaveBeenCalled();

    await service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);
    expect(textFor).toHaveBeenCalled();
  });

  it("isolates a per-note read failure — that note drops out and the rest still resolve", async () => {
    const failing: IContentProvider = {
      textFor: async (page: DataviewPage) => {
        if (page.file.path === "clients/Zephyr.md") throw new Error("unreadable");
        return "";
      },
    };
    const service = serviceFor(CONTENT_VAULT, new SubstringMatcher(), () => createMockDataviewApi(CONTENT_VAULT), failing);

    // "pineapple" matches neither name; Zephyr's body would be searched but its read throws.
    await expect(service.search("pineapple", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT])).resolves.toEqual([]);
    // And a name query still returns the readable notes.
    const byName = await service.search("acme", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT]);
    expect(byName.map((r) => r.page.file.name)).toEqual(["Acme"]);
  });

  it("does not return a note whose body contains the query only as a gapped subsequence", async () => {
    // The letters e-x-e-c-u-t-e occur in order in the body, but the word never
    // does; the strict body matcher requires the query to appear verbatim.
    const gappedBody =
      "Everyone expected the extra crew to unite around the target early, " +
      "yet the exact cadence remained unclear.";
    const service = serviceFor(
      CONTENT_VAULT,
      new SubstringMatcher(),
      () => createMockDataviewApi(CONTENT_VAULT),
      contentFrom({ "clients/Zephyr.md": gappedBody }),
      new SubstringMatcher()
    );

    await expect(service.search("execute", EMPTY_SCOPE, [ENTITY_TYPE.CLIENT])).resolves.toEqual([]);
  });
});

// A light re-export sanity check keeps the pure ranker's public surface covered here too.
describe("rankCandidates is composable", () => {
  it("re-ranks an already-enumerated candidate list over resolved field texts", () => {
    const mk = (name: string): RankInput => ({
      candidate: { page: createMockPage({ path: `projects/${name}.md` }), type: ENTITY_TYPE.PROJECT },
      text: { [MATCH_FIELD.NAME]: name, [MATCH_FIELD.BODY]: "" },
    });
    const fake: ITextMatcher = {
      prepare: () => (text) => ({ score: text === "Globex Portal" ? 1 : 2, matches: [] }),
    };
    const rankFields: readonly SearchField[] = [
      { field: MATCH_FIELD.NAME, matcher: fake, buildsSnippet: false },
      { field: MATCH_FIELD.BODY, matcher: fake, buildsSnippet: true },
    ];

    expect(rankCandidates([mk("Acme Portal"), mk("Globex Portal")], "portal", rankFields).map((c) => c.page.file.name)).toEqual([
      "Acme Portal",
      "Globex Portal",
    ]);
  });
});
