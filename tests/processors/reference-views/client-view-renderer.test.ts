import { describe, it, expect, vi } from "vitest";
import { renderClientView } from "@/processors/reference-views/client-view-renderer";
import type { ReferenceProcessorServices } from "@/plugin-context";
import type { DataviewPage } from "@/types";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeRef(name: string, clientName: string | null): DataviewPage {
  return {
    file: {
      name,
      path: `reference/references/${name}.md`,
      folder: "reference/references",
      link: { path: `reference/references/${name}.md` },
      tags: ["#reference"],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: {
        length: 0,
        values: [],
        where: vi.fn(),
        sort: vi.fn(),
        map: vi.fn(),
        filter: vi.fn(),
        // stub iterator — tasks are never iterated in these tests
        [Symbol.iterator]: (function* () {})(),
      },
    },
    topics: [],
    client: clientName ? `[[${clientName}]]` : undefined,
    engagement: undefined,
  } as unknown as DataviewPage;
}

function makeServices(
  allRefs: DataviewPage[],
  resolveClient: (ref: DataviewPage) => string | null
): ReferenceProcessorServices {
  return {
    queryService: {
      getReferences: vi.fn(() => allRefs),
    },
    hierarchyService: {
      resolveClientName: vi.fn((ref: DataviewPage) => resolveClient(ref)),
      resolveEngagementName: vi.fn(() => null),
    },
  } as unknown as ReferenceProcessorServices;
}

function renderView(
  allRefs: DataviewPage[],
  displayedRefs: DataviewPage[],
  resolveClient: (ref: DataviewPage) => string | null,
  selectedNode?: string
): { sidebar: HTMLElement; panel: HTMLElement } {
  const sidebar = document.createElement("div");
  const panel = document.createElement("div");
  const services = makeServices(allRefs, resolveClient);
  renderClientView(sidebar, panel, displayedRefs, services, selectedNode, vi.fn());
  return { sidebar, panel };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderClientView — sidebar alphabetical list", () => {
  it("renders clients in alphabetical order in the sidebar", () => {
    const refs = [
      makeRef("Doc1", "Zebra Corp"),
      makeRef("Doc2", "Acme Inc"),
      makeRef("Doc3", "Midway Ltd"),
    ];
    const resolveClient = (ref: DataviewPage) => {
      const map: Record<string, string> = {
        Doc1: "Zebra Corp",
        Doc2: "Acme Inc",
        Doc3: "Midway Ltd",
      };
      return map[ref.file.name] ?? null;
    };
    const { sidebar } = renderView(refs, refs, resolveClient);

    const items = [...sidebar.querySelectorAll(".pm-ref-sidebar__item")].map(
      (el) => el.textContent
    );
    expect(items).toEqual(["Acme Inc", "Midway Ltd", "Zebra Corp"]);
  });

  it("marks the selected client with the selected CSS class", () => {
    const refs = [makeRef("Doc1", "Acme Inc"), makeRef("Doc2", "Zebra Corp")];
    const resolveClient = (ref: DataviewPage) =>
      ref.file.name === "Doc1" ? "Acme Inc" : "Zebra Corp";
    const { sidebar } = renderView(refs, refs, resolveClient, "Acme Inc");

    const selected = sidebar.querySelectorAll(".pm-ref-sidebar__item--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Acme Inc");
  });
});

describe("renderClientView — content panel grouped by client", () => {
  it("renders references grouped by client in the content panel", () => {
    const refs = [
      makeRef("Doc1", "Acme Inc"),
      makeRef("Doc2", "Acme Inc"),
      makeRef("Doc3", "Zebra Corp"),
    ];
    const resolveClient = (ref: DataviewPage) => {
      const map: Record<string, string> = {
        Doc1: "Acme Inc",
        Doc2: "Acme Inc",
        Doc3: "Zebra Corp",
      };
      return map[ref.file.name] ?? null;
    };
    const { panel } = renderView(refs, refs, resolveClient);

    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    expect(groupTitles).toContain("Acme Inc");
    expect(groupTitles).toContain("Zebra Corp");
    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).toContain("Doc2");
    expect(panel.textContent).toContain("Doc3");
  });

  it("shows empty state when no references match", () => {
    const { panel } = renderView([], [], () => null);
    expect(panel.querySelector(".pm-ref-empty")).not.toBeNull();
  });

  it("groups references without a client under Unassigned", () => {
    const refs = [makeRef("Doc1", null), makeRef("Doc2", "Acme Inc")];
    const resolveClient = (ref: DataviewPage) =>
      ref.file.name === "Doc2" ? "Acme Inc" : null;
    const { panel } = renderView(refs, refs, resolveClient);

    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    expect(groupTitles).toContain("Unassigned");
    expect(panel.textContent).toContain("Doc1");
  });

  it("filters content panel to selected client when a node is selected", () => {
    const refs = [makeRef("Doc1", "Acme Inc"), makeRef("Doc2", "Zebra Corp")];
    const resolveClient = (ref: DataviewPage) =>
      ref.file.name === "Doc1" ? "Acme Inc" : "Zebra Corp";
    const filtered = refs.filter((r) => resolveClient(r) === "Acme Inc");
    const { panel } = renderView(refs, filtered, resolveClient, "Acme Inc");

    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).not.toContain("Doc2");
  });
});
