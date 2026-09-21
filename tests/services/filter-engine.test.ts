import { describe, it, expect } from "vitest";
import {
  FilterEngine,
  createFilterSpec,
  buildTaskFilterSpec,
  buildTaskFilterState,
  type FilterState,
  type TaskFacetDeps,
} from "@/services/filter-engine";
import { createMockTask, createMockDataviewApi } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { IEntityHierarchyService } from "@/services/interfaces";
import { makeFilters } from "../helpers/dashboard-filters";

const folders = DEFAULT_FOLDERS as unknown as FolderSettings;

function makeDeps(): TaskFacetDeps {
  return {
    folders,
    dv: createMockDataviewApi([]),
    hierarchyService: {
      resolveClientName: () => null,
      resolveEngagementName: () => null,
    } as unknown as IEntityHierarchyService,
  };
}


describe("FilterEngine — generic primitives", () => {
  it("skips facets with no selection and skips facets whose appliesWhen is false", () => {
    const spec = createFilterSpec<{ n: number }>([
      { key: "even", predicate: (i) => i.n % 2 === 0 },
      { key: "ctxOnly", appliesWhen: (vm) => vm === "context", predicate: (i) => i.n > 1 },
    ]);
    const items = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];

    // No selection at all → everything passes.
    expect(FilterEngine.apply(items, spec, { selections: {}, viewMode: "date" })).toHaveLength(4);

    // "even" selected, "ctxOnly" selected but view is "date" → ctxOnly gated off.
    const gated = FilterEngine.apply(items, spec, { selections: { even: true, ctxOnly: true }, viewMode: "date" });
    expect(gated.map((i) => i.n)).toEqual([2, 4]);

    // Same selections in "context" view → ctxOnly now applies (n>1 AND even).
    const applied = FilterEngine.apply(items, spec, { selections: { even: true, ctxOnly: true }, viewMode: "context" });
    expect(applied.map((i) => i.n)).toEqual([2, 4]); // 2 and 4 are even and >1
  });

  it("default matcher uses accessor + array-includes when no predicate is given", () => {
    const spec = createFilterSpec<{ tag: string }>([{ key: "tag", accessor: (i) => i.tag }]);
    const items = [{ tag: "a" }, { tag: "b" }, { tag: "c" }];
    const out = FilterEngine.apply(items, spec, { selections: { tag: ["a", "c"] }, viewMode: "context" });
    expect(out.map((i) => i.tag)).toEqual(["a", "c"]);
  });
});

describe("FilterSpec.specWithout — reproduces the all-other-facet result", () => {
  const deps = makeDeps();
  const spec = buildTaskFilterSpec(deps);

  // Two facets active: priority [1] AND tag #work.
  const state: FilterState = buildTaskFilterState(
    makeFilters({ priorityFilter: [1], tagFilter: ["#work"] })
  );

  const taskA = createMockTask({ path: "inbox/a.md", text: "Urgent ⏫", tags: ["#work"] });     // pri 1, #work
  const taskB = createMockTask({ path: "inbox/b.md", text: "Low 🔽", tags: ["#work"] });        // pri 4, #work
  const taskC = createMockTask({ path: "inbox/c.md", text: "Urgent ⏫", tags: ["#personal"] });  // pri 1, #personal
  const tasks = [taskA, taskB, taskC];

  it("full spec applies BOTH active facets (priority AND tag)", () => {
    const out = FilterEngine.apply(tasks, spec, state);
    expect(out.map((t) => t.path)).toEqual(["inbox/a.md"]); // only A satisfies both
  });

  it("specWithout('priority') === applying every facet EXCEPT priority (tag only)", () => {
    const withoutPriority = FilterEngine.apply(tasks, spec.specWithout("priority"), state);

    // Ground truth: a spec containing every facet whose key !== "priority".
    const manualOthers = createFilterSpec(spec.facets.filter((f) => f.key !== "priority"));
    const manualOut = FilterEngine.apply(tasks, manualOthers, state);

    expect(withoutPriority.map((t) => t.path)).toEqual(["inbox/a.md", "inbox/b.md"]); // both #work
    expect(withoutPriority.map((t) => t.path)).toEqual(manualOut.map((t) => t.path));
  });

  it("specWithout('tag') drops the tag constraint (priority only)", () => {
    const withoutTag = FilterEngine.apply(tasks, spec.specWithout("tag"), state);
    expect(withoutTag.map((t) => t.path)).toEqual(["inbox/a.md", "inbox/c.md"]); // both pri 1
  });

  it("specWithout does not mutate the original spec", () => {
    const before = spec.facets.length;
    spec.specWithout("tag");
    expect(spec.facets.length).toBe(before);
    expect(spec.facets.some((f) => f.key === "tag")).toBe(true);
  });
});
