import type { DataviewPage, EntityCandidate, EntityType } from "../types";
import { ENUM_STRATEGY } from "../constants";
import { ENTITY_KINDS, type EntityKind } from "../entity-registry";

/**
 * The narrow read surface {@link EntityEnumerator} needs: a tag read for tagged
 * types and a folder read for untagged ones. Kept minimal (ISP) so the
 * enumerator depends on an abstraction, not the full query service.
 */
export interface IEntityEnumerationQuery {
  getEntitiesByTag(tag: string): DataviewPage[];
  getEntitiesByFolder(folder: string): DataviewPage[];
}

/**
 * Lists the {@link EntityCandidate}s for a given {@link EntityType}.
 *
 * The type's {@link ENTITY_KINDS} descriptor drives the read: a `tag`-strategy
 * kind is listed by its Dataview tag, a `folder`-strategy kind by its folder.
 * A tag is authoritative for its type, so tagged reads are not folder-scoped —
 * a tagged note anywhere in the vault is a candidate, mirroring the tag-first
 * {@link EntityTypeResolver}. Dispatch is by the descriptor's strategy alone —
 * no per-type branching — so a new entity type is enumerated by its
 * registration. Each page is paired with the requested type. Returns an empty
 * list when Dataview is unavailable (the injected reads do), and never throws.
 */
export class EntityEnumerator {
  constructor(private readonly query: IEntityEnumerationQuery) {}

  candidates(type: EntityType): EntityCandidate[] {
    return this.pagesFor(ENTITY_KINDS[type]).map((page) => ({ page, type }));
  }

  private pagesFor(kind: EntityKind): DataviewPage[] {
    if (kind.strategy === ENUM_STRATEGY.TAG) {
      return kind.tag ? this.query.getEntitiesByTag(kind.tag) : [];
    }
    return kind.folder ? this.query.getEntitiesByFolder(kind.folder) : [];
  }
}
