import type { DataviewApi, DataviewTask } from "../types";

/**
 * The entity read axis of the dashboard Bridge: one read per entity type,
 * returning the entity's items with no entity-specific surface. The dashboard
 * shell resolves each dashboard's data through this contract, so every entity
 * (Task, RAID, Reference, …) is read uniformly behind the same interface.
 */
export interface IEntityQuery<TItem> {
  /** Resolves the entity's items. */
  resolve(): TItem[];
}

/**
 * Reads every vault task for the pm-tasks dashboard, excluding the utility
 * folder — the base read the dashboard filters and groups. Wraps the Dataview
 * page scan behind `IEntityQuery` so the shell can inject it uniformly; returns
 * an empty result when Dataview is unavailable.
 */
export class TaskQuery implements IEntityQuery<DataviewTask> {
  constructor(
    private readonly getDv: () => DataviewApi | null,
    private readonly getUtilityFolder: () => string
  ) {}

  resolve(): DataviewTask[] {
    const dv = this.getDv();
    if (!dv) return [];
    const utilityPrefix = this.getUtilityFolder() + "/";
    const pages = [...dv.pages().where((p) => !p.file.path.startsWith(utilityPrefix))];
    return pages.flatMap((p) => [...p.file.tasks]);
  }
}
