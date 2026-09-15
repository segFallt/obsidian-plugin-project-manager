import type { DataviewApi, DataviewPage } from "../types";
import { ENTITY_TAGS, FM_KEY, SORT_ORDER } from "../constants";
import type { IEntityQuery } from "./entity-query";

/**
 * Reads every `#raid` item for the pm-raid-dashboard, sorted by raised-date
 * descending — the base read the dashboard filters and groups. Wraps the
 * Dataview page scan behind {@link IEntityQuery} so the shell injects it
 * uniformly; returns an empty result when Dataview is unavailable.
 *
 * This is a pure base read: narrowing by status, client, or engagement is the
 * RAID `FilterSpec`'s job (its captured predicates), not the query's.
 */
export class RaidQuery implements IEntityQuery<DataviewPage> {
  constructor(private readonly getDv: () => DataviewApi | null) {}

  resolve(): DataviewPage[] {
    const dv = this.getDv();
    if (!dv) return [];
    return [
      ...dv
        .pages(ENTITY_TAGS.raid)
        .sort((p: DataviewPage) => p[FM_KEY.RAISED_DATE], SORT_ORDER.DESC),
    ];
  }
}
