import { MarkdownRenderChild, TFile } from "obsidian";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import type { Plugin } from "obsidian";
import type { IQueryService, ILoggerService, RaidProcessorServices } from "../services/interfaces";
import type { RaidType, RaidDirection } from "../types";
import { CODEBLOCK, DEBOUNCE_MS, CSS_CLS } from "../constants";
import { renderError } from "./dom-helpers";
import { DIRECTION_LABELS, DIRECTION_ICONS } from "./raid-constants";

// ─── Exported registration function ─────────────────────────────────────────

export function registerPmRaidReferencesProcessor(
  plugin: Plugin,
  services: RaidProcessorServices
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODEBLOCK.PM_RAID_REFERENCES,
    (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const child = new PmRaidReferencesRenderChild(
        el,
        services.app,
        ctx.sourcePath,
        services.queryService,
        services.loggerService
      );
      ctx.addChild(child);
      void child.render();
    }
  );
}

// ─── Render child ───────────────────────────────────────────────────────────

class PmRaidReferencesRenderChild extends MarkdownRenderChild {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly sourcePath: string,
    private readonly queryService: IQueryService,
    private readonly loggerService: ILoggerService
  ) {
    super(containerEl);
  }

  onload(): void {
    this.registerEvent(
      this.app.vault.on("modify", () => {
        this.debouncedRefresh();
      })
    );
  }

  onunload(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  async render(): Promise<void> {
    const fragment = document.createDocumentFragment();
    try {
      await this.buildContent(fragment);
    } catch (err) {
      const errorDiv = document.createElement("div");
      renderError(errorDiv as unknown as HTMLElement, `pm-raid-references: ${String(err)}`);
      fragment.appendChild(errorDiv);
    }
    this.containerEl.replaceChildren(fragment);
  }

  private async buildContent(fragment: DocumentFragment): Promise<void> {
    const raidItemName = this.sourcePath.split("/").pop()?.replace(/\.md$/, "") ?? "";

    // Resolve raid-type from the current file's frontmatter
    const currentFile = this.app.vault.getAbstractFileByPath(this.sourcePath);
    const raidType = (currentFile instanceof TFile
      ? this.app.metadataCache.getFileCache(currentFile)?.frontmatter?.["raid-type"]
      : undefined) as RaidType | undefined;

    // Get all files that link back to this RAID item (requires Dataview)
    const dv = this.queryService.dv();

    if (!dv) {
      const notice = document.createElement("p");
      notice.className = "raid-references-empty";
      notice.textContent =
        "Dataview plugin is required to display references. Please install and enable it.";
      fragment.appendChild(notice);
      return;
    }

    const backlinks: TFile[] = [];
    const pages = dv.pages(`"[[${raidItemName}]]"`);
    for (const page of pages) {
      const abstractFile = this.app.vault.getAbstractFileByPath(page.file.path);
      if (abstractFile instanceof TFile) {
        backlinks.push(abstractFile);
      }
    }

    // Collect references grouped by source file
    interface ReferenceEntry {
      direction: RaidDirection;
      label: string;
      lineText: string;
    }
    const referencesByFile = new Map<TFile, ReferenceEntry[]>();

    const annotationPattern = new RegExp(
      `\\{raid:(positive|negative|neutral)\\}\\[\\[${escapeRegex(raidItemName)}\\]\\]`,
      "g"
    );

    for (const file of backlinks) {
      let content: string;
      try {
        content = await this.app.vault.read(file);
      } catch (err) {
        this.loggerService.warn(
          `Failed to read file ${file.path}: ${String(err)}`,
          "pm-raid-references"
        );
        continue;
      }

      const entries: ReferenceEntry[] = [];
      const lines = content.split("\n");
      for (const line of lines) {
        annotationPattern.lastIndex = 0;
        const match = annotationPattern.exec(line);
        if (match) {
          const direction = match[1] as RaidDirection;
          const resolvedRaidType: RaidType = raidType && raidType in DIRECTION_LABELS.positive
            ? raidType
            : "Decision";
          const label = DIRECTION_LABELS[direction]?.[resolvedRaidType] ?? "Notes";
          // Strip the annotation from the line text for display
          const strippedLine = line.replace(annotationPattern, "").trim();
          entries.push({ direction, label, lineText: strippedLine });
        }
      }

      if (entries.length > 0) {
        referencesByFile.set(file, entries);
      }
    }

    if (referencesByFile.size === 0) {
      const empty = document.createElement("p");
      empty.className = "raid-references-empty";
      empty.textContent = "No references yet. Use PM: Tag Line as RAID Reference to link notes to this item.";
      fragment.appendChild(empty);
      return;
    }

    const container = document.createElement("div");
    container.className = "pm-raid-references";

    for (const [file, entries] of referencesByFile) {
      // Source note heading with internal link
      const heading = document.createElement("h4");
      const link = document.createElement("a");
      link.className = CSS_CLS.INTERNAL_LINK;
      link.textContent = file.basename;
      link.setAttribute("data-href", file.path);
      link.setAttribute("href", file.path);
      heading.appendChild(link);
      container.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "pm-raid-references__list";

      for (const entry of entries) {
        const item = document.createElement("li");
        item.className = "pm-raid-references__item";

        // Direction badge
        const badge = document.createElement("span");
        badge.className = `raid-badge raid-badge--${entry.direction}`;
        badge.textContent = `${DIRECTION_ICONS[entry.direction]} ${entry.label}`;
        item.appendChild(badge);

        // Line text
        if (entry.lineText) {
          item.appendChild(document.createTextNode(` ${entry.lineText} — `));
        } else {
          item.appendChild(document.createTextNode(" — "));
        }

        // Source link
        const sourceLink = document.createElement("a");
        sourceLink.className = CSS_CLS.INTERNAL_LINK;
        sourceLink.textContent = file.basename;
        sourceLink.setAttribute("data-href", file.path);
        sourceLink.setAttribute("href", file.path);
        item.appendChild(sourceLink);

        list.appendChild(item);
      }

      container.appendChild(list);
    }

    fragment.appendChild(container);
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.render();
    }, DEBOUNCE_MS.PROPERTIES);
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
