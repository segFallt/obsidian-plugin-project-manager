import type { DataviewTask, SortKey, SortField } from "../types";
import { getTaskPriority } from "../utils/task-utils";
import { SORT_SENTINEL, ISO_DATE_LENGTH } from "../constants";
import type { ITaskSortService } from "./interfaces";

/**
 * Pure sorting logic for task lists.
 *
 * All methods are free of DOM side-effects — they accept arrays and return
 * new sorted arrays without mutating the originals.
 */
export class TaskSortService implements ITaskSortService {
  /**
   * Sorts an array of tasks by an ordered list of sort keys (multi-key sort).
   * Returns a shallow copy with no sort applied when keys is empty.
   * JS Array.sort is stable in V8, so key order is honoured correctly.
   */
  sortTasks(
    tasks: DataviewTask[],
    keys: SortKey[],
    contextMap?: Map<string, string>,
    mtimeMap?: Map<string, number>
  ): DataviewTask[] {
    if (keys.length === 0) return [...tasks];

    return [...tasks].sort((a, b) => {
      for (const key of keys) {
        const result = compareByKey(a, b, key, contextMap, mtimeMap);
        if (result !== 0) return result;
      }
      return 0;
    });
  }

  /**
   * Compares two groups of tasks for use when sorting file groups.
   * Sorts each group internally and compares their representative tasks.
   * Returns a negative/zero/positive value suitable for Array.sort().
   */
  compareGroups(
    aTasks: DataviewTask[],
    bTasks: DataviewTask[],
    keys: SortKey[],
    contextMap?: Map<string, string>,
    mtimeMap?: Map<string, number>
  ): number {
    if (keys.length === 0) return 0;

    const aSorted = this.sortTasks(aTasks, keys, contextMap, mtimeMap);
    const bSorted = this.sortTasks(bTasks, keys, contextMap, mtimeMap);

    const aRep = aSorted[0];
    const bRep = bSorted[0];

    if (!aRep && !bRep) return 0;
    if (!aRep) return 1;
    if (!bRep) return -1;

    for (const key of keys) {
      const result = compareByKey(aRep, bRep, key, contextMap, mtimeMap);
      if (result !== 0) return result;
    }
    return 0;
  }
}

// ─── Comparator helpers ───────────────────────────────────────────────────

type ComparatorFn = (
  a: DataviewTask,
  b: DataviewTask,
  key: SortKey,
  contextMap?: Map<string, string>,
  mtimeMap?: Map<string, number>
) => number;

/** Registry of per-field comparators. satisfies ensures all SortField values are covered. */
const SORT_COMPARATORS = {
  dueDate: (a, b, key) => {
    const dir = key.direction === "desc" ? -1 : 1;
    const sentinel = key.direction === "desc" ? SORT_SENTINEL.MIN : SORT_SENTINEL.MAX;
    const aDate = a.due ? String(a.due).substring(0, ISO_DATE_LENGTH) : sentinel;
    const bDate = b.due ? String(b.due).substring(0, ISO_DATE_LENGTH) : sentinel;
    return dir * aDate.localeCompare(bDate);
  },
  priority: (a, b, key) => {
    const dir = key.direction === "desc" ? -1 : 1;
    return dir * (getTaskPriority(a) - getTaskPriority(b));
  },
  alphabetical: (a, b, key) => {
    const dir = key.direction === "desc" ? -1 : 1;
    return dir * a.text.toLowerCase().localeCompare(b.text.toLowerCase());
  },
  context: (a, b, key, contextMap) => {
    const dir = key.direction === "desc" ? -1 : 1;
    const aCtx = contextMap?.get(a.path) ?? "";
    const bCtx = contextMap?.get(b.path) ?? "";
    return dir * aCtx.localeCompare(bCtx);
  },
  createdDate: (a, b, key, _contextMap, mtimeMap) => {
    const dir = key.direction === "desc" ? -1 : 1;
    const aMtime = mtimeMap?.get(a.path) ?? 0;
    const bMtime = mtimeMap?.get(b.path) ?? 0;
    return dir * (aMtime - bMtime);
  },
} satisfies Record<SortField, ComparatorFn>;

/**
 * Compares two tasks by a single SortKey.
 * Returns negative if a < b, positive if a > b, zero if equal.
 */
function compareByKey(
  a: DataviewTask,
  b: DataviewTask,
  key: SortKey,
  contextMap?: Map<string, string>,
  mtimeMap?: Map<string, number>
): number {
  return SORT_COMPARATORS[key.field]?.(a, b, key, contextMap, mtimeMap) ?? 0;
}
