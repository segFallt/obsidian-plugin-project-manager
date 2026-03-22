import { describe, it, expect } from "vitest";
import { QueryService } from "@/services/query-service";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import { createMockApp } from "../mocks/app-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { MockPageData } from "../mocks/dataview-mock";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

function createQueryService(pages: MockPageData[]) {
  const app = createMockApp();
  const dv = createMockDataviewApi(pages);
  const qs = new QueryService(app as unknown as import("obsidian").App, () => dv, defaultFolders);
  return { qs, dv };
}

describe("QueryService — getReferencesByTopic", () => {
  it("returns references where topics[] contains the given topic name (wikilink [[TopicName]])", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Auth RFC.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]", "[[Security]]"] },
      },
      {
        path: "reference/references/Deploy Runbook.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Security]]"] },
      },
      {
        path: "reference/references/UX Guide.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Design]]"] },
      },
    ]);

    const result = qs.getReferencesByTopic("Security");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.file.name)).toEqual(
      expect.arrayContaining(["Auth RFC", "Deploy Runbook"])
    );
  });

  it("returns empty array when no references match", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Auth RFC.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]"] },
      },
    ]);
    expect(qs.getReferencesByTopic("NonExistentTopic")).toHaveLength(0);
  });

  it("returns empty array when dv is null", () => {
    const app = createMockApp();
    const qs = new QueryService(app as unknown as import("obsidian").App, () => null, defaultFolders);
    expect(qs.getReferencesByTopic("Architecture")).toEqual([]);
  });

  it("does NOT return references where topics is not an array", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Bad Ref.md",
        tags: ["#reference"],
        frontmatter: { topics: "[[Architecture]]" }, // string, not array
      },
    ]);
    expect(qs.getReferencesByTopic("Architecture")).toHaveLength(0);
  });
});

describe("QueryService — getReferences", () => {
  it("returns all references when no filters given", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]"] },
      },
      {
        path: "reference/references/Ref2.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Security]]"] },
      },
    ]);
    const result = qs.getReferences();
    expect(result).toHaveLength(2);
  });

  it("topic filter: OR within dimension (reference matching ANY of the filter topics is included)", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]"] },
      },
      {
        path: "reference/references/Ref2.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Security]]"] },
      },
      {
        path: "reference/references/Ref3.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Design]]"] },
      },
    ]);

    const result = qs.getReferences({ topics: ["Architecture", "Security"] });
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.file.name)).toEqual(
      expect.arrayContaining(["Ref1", "Ref2"])
    );
  });

  it("client filter: direct reference.client wikilink", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: [], client: "[[AcmeCo]]" },
      },
      {
        path: "reference/references/Ref2.md",
        tags: ["#reference"],
        frontmatter: { topics: [], client: "[[OtherCo]]" },
      },
    ]);

    const result = qs.getReferences({ clients: ["AcmeCo"] });
    expect(result).toHaveLength(1);
    expect(result[0].file.name).toBe("Ref1");
  });

  it("client filter: via engagement → engagement.client (dual-path)", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: [], engagement: "[[AcmeCo Retainer]]" },
      },
      {
        // engagement page that getClientFromEngagementLink looks up
        path: "engagements/AcmeCo Retainer.md",
        frontmatter: { client: "[[AcmeCo]]" },
      },
    ]);

    const result = qs.getReferences({ clients: ["AcmeCo"] });
    expect(result).toHaveLength(1);
    expect(result[0].file.name).toBe("Ref1");
  });

  it("engagement filter: plain name match", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: [], engagement: "[[AcmeCo Retainer]]" },
      },
      {
        path: "reference/references/Ref2.md",
        tags: ["#reference"],
        frontmatter: { topics: [], engagement: "[[Other Engagement]]" },
      },
    ]);

    const result = qs.getReferences({ engagements: ["AcmeCo Retainer"] });
    expect(result).toHaveLength(1);
    expect(result[0].file.name).toBe("Ref1");
  });

  it("AND across dimensions (topic AND client filters both must match)", () => {
    const { qs } = createQueryService([
      {
        // Matches topic but not client
        path: "reference/references/Ref1.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]"], client: "[[OtherCo]]" },
      },
      {
        // Matches client but not topic
        path: "reference/references/Ref2.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Design]]"], client: "[[AcmeCo]]" },
      },
      {
        // Matches both topic AND client
        path: "reference/references/Ref3.md",
        tags: ["#reference"],
        frontmatter: { topics: ["[[Architecture]]"], client: "[[AcmeCo]]" },
      },
    ]);

    const result = qs.getReferences({ topics: ["Architecture"], clients: ["AcmeCo"] });
    expect(result).toHaveLength(1);
    expect(result[0].file.name).toBe("Ref3");
  });

  it("text search is NOT handled by getReferences (returns unfiltered for text)", () => {
    const { qs } = createQueryService([
      {
        path: "reference/references/Auth Flow RFC.md",
        tags: ["#reference"],
        frontmatter: { topics: [] },
      },
      {
        path: "reference/references/Rate Limiting.md",
        tags: ["#reference"],
        frontmatter: { topics: [] },
      },
    ]);

    // getReferences has no searchText param — returns all matching the structural filters
    const result = qs.getReferences({});
    expect(result).toHaveLength(2);
  });

  it("returns empty array when dv is null", () => {
    const app = createMockApp();
    const qs = new QueryService(app as unknown as import("obsidian").App, () => null, defaultFolders);
    expect(qs.getReferences()).toEqual([]);
    expect(qs.getReferences({ topics: ["Architecture"] })).toEqual([]);
  });
});
