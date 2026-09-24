import type { DataviewPage, EntityType } from "../types";
import { PATH_SEPARATOR } from "../constants";
import { ENTITY_KINDS, type EntityKind } from "../entity-registry";

/** Typed view of the entity registry's entries, keyed by {@link EntityType}. */
const KIND_ENTRIES = Object.entries(ENTITY_KINDS) as Array<[EntityType, EntityKind]>;

/**
 * Labels a vault page with its {@link EntityType} by reading {@link ENTITY_KINDS}.
 *
 * A page is matched by tag first — a tagged kind wins whenever the page carries
 * its tag — and by folder otherwise, taking the most specific (longest) folder
 * so a nested page (e.g. a project note under `projects/notes/…`) resolves to
 * its own kind rather than an ancestor's. Registry-driven with no per-type
 * branches; returns `null` when nothing matches.
 */
export class EntityTypeResolver {
  resolve(page: DataviewPage): EntityType | null {
    return this.matchByTag(page) ?? this.matchByFolder(page);
  }

  private matchByTag(page: DataviewPage): EntityType | null {
    const tags = page.file.tags;
    for (const [type, kind] of KIND_ENTRIES) {
      if (kind.tag && tags.includes(kind.tag)) return type;
    }
    return null;
  }

  private matchByFolder(page: DataviewPage): EntityType | null {
    const folder = page.file.folder;
    let match: EntityType | null = null;
    let matchLength = -1;
    for (const [type, kind] of KIND_ENTRIES) {
      if (!kind.folder) continue;
      const isMatch = folder === kind.folder || folder.startsWith(kind.folder + PATH_SEPARATOR);
      if (isMatch && kind.folder.length > matchLength) {
        match = type;
        matchLength = kind.folder.length;
      }
    }
    return match;
  }
}
