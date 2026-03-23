import { describe, it, expect, vi } from "vitest";
import { buildEntityOptions } from "@/utils/filter-utils";
import type { IQueryService } from "@/services/interfaces";
import type { DataviewPage } from "@/types";

function makeQueryService(pages: DataviewPage[]): IQueryService {
  return {
    getActiveEntitiesByTag: vi.fn().mockReturnValue(pages),
  } as unknown as IQueryService;
}

function makePage(name: string): DataviewPage {
  return {
    file: {
      name,
      path: `entities/${name}.md`,
      folder: "entities",
      link: { path: `entities/${name}.md` },
      tags: [],
      mtime: { valueOf: () => 0, toISO: () => "" },
      tasks: [] as unknown as DataviewPage["file"]["tasks"],
    },
  } as DataviewPage;
}

describe("buildEntityOptions", () => {
  it("returns [] when getActiveEntitiesByTag returns []", () => {
    const queryService = makeQueryService([]);
    expect(buildEntityOptions("some-tag", queryService)).toEqual([]);
  });

  it("maps pages to { value: file.name, displayText: file.name }", () => {
    const pages = [makePage("Alpha"), makePage("Beta")];
    const queryService = makeQueryService(pages);
    expect(buildEntityOptions("some-tag", queryService)).toEqual([
      { value: "Alpha", displayText: "Alpha" },
      { value: "Beta", displayText: "Beta" },
    ]);
  });

  it("forwards the correct tag to getActiveEntitiesByTag", () => {
    const queryService = makeQueryService([]);
    buildEntityOptions("raid/risk", queryService);
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledOnce();
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith("raid/risk");
  });
});
