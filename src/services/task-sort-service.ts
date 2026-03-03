import type { DataviewTask, SortBy } from "../types";
import { getTaskPriority } from "../utils/task-utils";
import type { ITaskSortService } from "./interfaces";

/**
 * Pure sorting logic for task lists.
 *
 * All methods are free of DOM side-effects — they accept arrays and return
 * new sorted arrays without mutating the originals.
 */
export class TaskSortService implements ITaskSortService {
  /**
   * Sorts an array of tasks by the given sort key.
   * Returns the original array reference if sortBy is "none".
   */
  sortTasks(tasks: DataviewTask[], sortBy: SortBy): DataviewTask[] {
    if (sortBy === "none") return tasks;
    const isDesc = sortBy.endsWith("-desc");

    if (sortBy.startsWith("dueDate")) {
      return [...tasks].sort((a, b) => {
        const aDate = a.due
          ? String(a.due).substring(0, 10)
          : isDesc ? "0000-00-00" : "9999-99-99";
        const bDate = b.due
          ? String(b.due).substring(0, 10)
          : isDesc ? "0000-00-00" : "9999-99-99";
        return isDesc ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
      });
    }

    if (sortBy.startsWith("priority")) {
      return [...tasks].sort((a, b) => {
        const ap = getTaskPriority(a);
        const bp = getTaskPriority(b);
        return isDesc ? bp - ap : ap - bp;
      });
    }

    return tasks;
  }

  /**
   * Compares two groups of tasks for use when sorting file groups.
   * Returns a negative/zero/positive value suitable for Array.sort().
   */
  compareGroups(aTasks: DataviewTask[], bTasks: DataviewTask[], sortBy: SortBy): number {
    if (sortBy === "none") return 0;
    const isDesc = sortBy.endsWith("-desc");

    if (sortBy.startsWith("dueDate")) {
      const pick = isDesc ? "pop" : "shift";
      const aDates = aTasks.filter((t) => t.due).map((t) => String(t.due).substring(0, 10)).sort();
      const bDates = bTasks.filter((t) => t.due).map((t) => String(t.due).substring(0, 10)).sort();
      const aBest = aDates[pick]?.();
      const bBest = bDates[pick]?.();
      const aKey = aBest ?? (isDesc ? "0000-00-00" : "9999-99-99");
      const bKey = bBest ?? (isDesc ? "0000-00-00" : "9999-99-99");
      return isDesc ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
    }

    if (sortBy.startsWith("priority")) {
      const aMin = Math.min(...aTasks.map((t) => getTaskPriority(t)));
      const bMin = Math.min(...bTasks.map((t) => getTaskPriority(t)));
      return isDesc ? bMin - aMin : aMin - bMin;
    }

    return 0;
  }
}
