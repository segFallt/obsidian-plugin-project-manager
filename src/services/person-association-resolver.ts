import type { DataviewApi, DataviewPage } from "../types";
import { ENTITY_TAGS, FM_KEY, PATH_SEPARATOR } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import type { FolderSettings } from "../settings";
import type { IPersonAssociationResolver } from "./interfaces";

/**
 * Resolves the people associated with an entity page, reading only the fields the
 * data model carries:
 *   - a Person note (`#person`) contributes itself;
 *   - a RAID item contributes its `owner`;
 *   - a meeting contributes its `attendees`;
 *   - a recurring meeting contributes its `default-attendees`;
 *   - a Person's `reports-to` chain contributes every manager up the line.
 *
 * There is no team/team-members field in the model, so none is read. Names are
 * normalised to plain file names (wikilink/link wrappers stripped via
 * {@link normalizeToName}) and de-duplicated. The Dataview accessor is obtained
 * lazily so the resolver can be built before Dataview initialises; the
 * `reports-to` walk degrades to a single level when Dataview is unavailable.
 */
export class PersonAssociationResolver implements IPersonAssociationResolver {
  constructor(
    private readonly getDv: () => DataviewApi | null,
    private readonly folders: FolderSettings
  ) {}

  peopleOf(page: DataviewPage): string[] {
    const names = new Set<string>();
    this.addSelfIfPerson(page, names);
    this.addName(page[FM_KEY.OWNER], names);
    this.addNames(page[FM_KEY.ATTENDEES], names);
    this.addNames(page[FM_KEY.DEFAULT_ATTENDEES], names);
    this.addReportsToChain(page, names);
    return [...names];
  }

  /** A `#person` page is associated with itself. */
  private addSelfIfPerson(page: DataviewPage, names: Set<string>): void {
    if (page.file.tags.includes(ENTITY_TAGS.person)) names.add(page.file.name);
  }

  /** Walks the `reports-to` chain, adding every manager up the line (cycle-guarded). */
  private addReportsToChain(page: DataviewPage, names: Set<string>): void {
    const dv = this.getDv();
    const visited = new Set<string>();
    let managerName = normalizeToName(page[FM_KEY.REPORTS_TO]);
    while (managerName && !visited.has(managerName)) {
      visited.add(managerName);
      names.add(managerName);
      if (!dv) break;
      const managerPage = dv.page(`${this.folders.people}${PATH_SEPARATOR}${managerName}`);
      managerName = managerPage ? normalizeToName(managerPage[FM_KEY.REPORTS_TO]) : null;
    }
  }

  /** Adds one normalised name from a single link/plain value, if it resolves. */
  private addName(value: unknown, names: Set<string>): void {
    const name = normalizeToName(value);
    if (name) names.add(name);
  }

  /** Adds each normalised name from a list of link/plain values. */
  private addNames(value: unknown, names: Set<string>): void {
    if (!Array.isArray(value)) return;
    for (const entry of value) this.addName(entry, names);
  }
}
