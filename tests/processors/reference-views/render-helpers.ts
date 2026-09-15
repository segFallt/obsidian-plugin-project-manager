import { vi } from "vitest";
import type { DataviewPage, ReferenceFilters, ReferenceViewMode, TopicNode } from "@/types";
import type { ViewRenderContext } from "@/processors/view-renderer";
import type { RefRenderHelpers, CardNavigationServices } from "@/processors/reference-views/reference-card-renderer";

/** Builds a #reference DataviewPage-like fixture. */
export function makeRef(
  name: string,
  fields: { topics?: string[]; client?: string | null; engagement?: string | null } = {}
): DataviewPage {
  const path = `reference/references/${name}.md`;
  return {
    file: {
      name,
      path,
      folder: "reference/references",
      link: { path },
      tags: ["#reference"],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: {
        length: 0,
        values: [],
        where: vi.fn(),
        sort: vi.fn(),
        map: vi.fn(),
        filter: vi.fn(),
        [Symbol.iterator]: [][Symbol.iterator],
      },
    },
    topics: (fields.topics ?? []).map((t) => `[[${t}]]`),
    client: fields.client ? `[[${fields.client}]]` : undefined,
    engagement: fields.engagement ? `[[${fields.engagement}]]` : undefined,
  } as unknown as DataviewPage;
}

/** Builds a topic tree node. */
export function makeNode(name: string, children: TopicNode[] = []): TopicNode {
  return { name, children } as TopicNode;
}

/** A no-op card navigation service stub for render-only assertions. */
export function stubCardServices(): CardNavigationServices {
  return {
    app: { vault: { getAbstractFileByPath: vi.fn(() => null) } } as unknown as CardNavigationServices["app"],
    navigationService: { openFile: vi.fn().mockResolvedValue(undefined) },
  };
}

export interface BuildContextOptions {
  items: DataviewPage[];
  allReferences?: DataviewPage[];
  topicTree?: TopicNode[];
  viewMode?: ReferenceViewMode;
  selectedNode?: string;
  onFilterChange?: (patch: Partial<ReferenceFilters>) => void;
  cardServices?: CardNavigationServices;
}

/** Builds a ViewRenderContext for the reference renderers. */
export function buildContext(opts: BuildContextOptions): {
  ctx: ViewRenderContext<DataviewPage, RefRenderHelpers, ReferenceFilters>;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  const filters: ReferenceFilters = {
    viewMode: opts.viewMode ?? "topic",
    topics: [],
    clients: [],
    engagements: [],
    searchText: "",
    selectedNode: opts.selectedNode,
  };
  const helpers: RefRenderHelpers = {
    topicTree: opts.topicTree ?? [],
    allReferences: opts.allReferences ?? opts.items,
    cardServices: opts.cardServices ?? stubCardServices(),
  };
  const ctx: ViewRenderContext<DataviewPage, RefRenderHelpers, ReferenceFilters> = {
    container,
    items: opts.items,
    filters,
    onFilterChange: opts.onFilterChange ?? vi.fn(),
    helpers,
  };
  return { ctx, container };
}
