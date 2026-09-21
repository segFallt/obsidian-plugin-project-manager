import { describe, it, expect } from "vitest";
import {
  FilterEngine,
  createFilterSpec,
  buildTaskFilterSpec,
  buildTaskFilterState,
  startDateMatches,
  scheduledDateMatches,
  isStartDateFilterActive,
  isScheduledDateFilterActive,
  type FilterState,
  type TaskFacetDeps,
} from "@/services/filter-engine";
import { createMockTask, createMockDataviewApi } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS, START_DATE_PRESET, SCHEDULED_DATE_PRESET } from "@/constants";
import type { StartDateFilter, ScheduledDateFilter } from "@/types";
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

// ─── Start-date matcher ──────────────────────────────────────────────────────

const NO_START = START_DATE_PRESET.NO_DATE;
const NO_SCHEDULED = SCHEDULED_DATE_PRESET.NO_DATE;

describe("startDateMatches / isStartDateFilterActive", () => {
  const inactive: StartDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };

  it("inactive filter matches every task (dated and undated)", () => {
    expect(isStartDateFilterActive(inactive)).toBe(false);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-01" }), inactive)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md" }), inactive)).toBe(true);
  });

  it("custom range shows only in-range tasks (inclusive boundaries)", () => {
    const filter: StartDateFilter = { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-31" };
    expect(isStartDateFilterActive(filter)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-01" }), filter)).toBe(true); // from boundary
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-15" }), filter)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-31" }), filter)).toBe(true); // to boundary
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2029-12-31" }), filter)).toBe(false);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-02-01" }), filter)).toBe(false);
  });

  it("no-date preset shows only undated tasks", () => {
    const filter: StartDateFilter = { selectedPresets: [NO_START], rangeFrom: null, rangeTo: null };
    expect(startDateMatches(createMockTask({ path: "t.md" }), filter)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-01" }), filter)).toBe(false);
  });

  it("undated task is excluded from a range when no no-date preset is set", () => {
    const filter: StartDateFilter = { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-31" };
    expect(startDateMatches(createMockTask({ path: "t.md" }), filter)).toBe(false);
  });

  it("open-ended ranges (from-only / to-only) match on the set bound", () => {
    const fromOnly: StartDateFilter = { selectedPresets: [], rangeFrom: "2030-06-01", rangeTo: null };
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-06-01" }), fromOnly)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-05-31" }), fromOnly)).toBe(false);

    const toOnly: StartDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: "2030-06-30" };
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-06-30" }), toOnly)).toBe(true);
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-07-01" }), toOnly)).toBe(false);
  });

  it("reads the ISO date prefix from a datetime start value", () => {
    const filter: StartDateFilter = { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-01" };
    expect(startDateMatches(createMockTask({ path: "t.md", start: "2030-01-01T09:30:00" }), filter)).toBe(true);
  });
});

// ─── Scheduled-date matcher ──────────────────────────────────────────────────

describe("scheduledDateMatches / isScheduledDateFilterActive", () => {
  it("no-date preset shows only undated tasks; range shows only in-range", () => {
    const noDate: ScheduledDateFilter = { selectedPresets: [NO_SCHEDULED], rangeFrom: null, rangeTo: null };
    expect(isScheduledDateFilterActive(noDate)).toBe(true);
    expect(scheduledDateMatches(createMockTask({ path: "t.md" }), noDate)).toBe(true);
    expect(scheduledDateMatches(createMockTask({ path: "t.md", scheduled: "2030-01-01" }), noDate)).toBe(false);

    const range: ScheduledDateFilter = { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-31" };
    expect(scheduledDateMatches(createMockTask({ path: "t.md", scheduled: "2030-01-10" }), range)).toBe(true);
    expect(scheduledDateMatches(createMockTask({ path: "t.md", scheduled: "2030-02-10" }), range)).toBe(false);
    expect(scheduledDateMatches(createMockTask({ path: "t.md" }), range)).toBe(false);
  });

  it("inactive scheduled filter matches everything", () => {
    const inactive: ScheduledDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };
    expect(isScheduledDateFilterActive(inactive)).toBe(false);
    expect(scheduledDateMatches(createMockTask({ path: "t.md" }), inactive)).toBe(true);
    expect(scheduledDateMatches(createMockTask({ path: "t.md", scheduled: "2030-01-01" }), inactive)).toBe(true);
  });
});

// ─── Engine integration: new date facets ─────────────────────────────────────

describe("buildTaskFilterState / FilterEngine — start & scheduled facets", () => {
  const deps = makeDeps();
  const spec = buildTaskFilterSpec(deps);

  it("empty start/scheduled selections exclude no tasks", () => {
    const state = buildTaskFilterState(makeFilters());
    const tasks = [
      createMockTask({ path: "inbox/a.md", start: "2030-01-01" }),
      createMockTask({ path: "inbox/b.md" }),
    ];
    expect(FilterEngine.apply(tasks, spec, state).map((t) => t.path)).toEqual(["inbox/a.md", "inbox/b.md"]);
  });

  it("start-date range filters to in-range tasks only", () => {
    const state = buildTaskFilterState(
      makeFilters({ startDateFilter: { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-31" } })
    );
    const tasks = [
      createMockTask({ path: "inbox/in.md", start: "2030-01-15" }),
      createMockTask({ path: "inbox/out.md", start: "2030-03-01" }),
      createMockTask({ path: "inbox/none.md" }),
    ];
    expect(FilterEngine.apply(tasks, spec, state).map((t) => t.path)).toEqual(["inbox/in.md"]);
  });

  it("AND across panels: start-date range AND priority", () => {
    const state = buildTaskFilterState(
      makeFilters({
        startDateFilter: { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-01-31" },
        priorityFilter: [1],
      })
    );
    const tasks = [
      createMockTask({ path: "inbox/a.md", text: "Urgent ⏫", start: "2030-01-10" }), // in-range + pri 1
      createMockTask({ path: "inbox/b.md", text: "Low 🔽", start: "2030-01-10" }),     // in-range + pri 4
      createMockTask({ path: "inbox/c.md", text: "Urgent ⏫", start: "2030-05-10" }),  // pri 1 but out of range
    ];
    expect(FilterEngine.apply(tasks, spec, state).map((t) => t.path)).toEqual(["inbox/a.md"]);
  });

  it("scheduled no-date preset AND start range combine conjunctively", () => {
    const state = buildTaskFilterState(
      makeFilters({
        startDateFilter: { selectedPresets: [], rangeFrom: "2030-01-01", rangeTo: "2030-12-31" },
        scheduledDateFilter: { selectedPresets: [NO_SCHEDULED], rangeFrom: null, rangeTo: null },
      })
    );
    const tasks = [
      createMockTask({ path: "inbox/a.md", start: "2030-06-01" }),                        // in start range, no scheduled ✓
      createMockTask({ path: "inbox/b.md", start: "2030-06-01", scheduled: "2030-06-02" }), // has scheduled ✗
      createMockTask({ path: "inbox/c.md", scheduled: undefined }),                        // no start ✗
    ];
    expect(FilterEngine.apply(tasks, spec, state).map((t) => t.path)).toEqual(["inbox/a.md"]);
  });
});
