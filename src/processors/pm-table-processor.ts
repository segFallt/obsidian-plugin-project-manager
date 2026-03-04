import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PluginServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTableConfig, DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { formatDate } from "../utils/date-utils";

/**
 * Renders entity relationship tables in note context.
 *
 * Replaces dv.view() calls to vault dataview table scripts:
 * - client-engagements  → client-engagements-table.js
 * - client-people       → client-people-table.js
 * - engagement-projects → engagement-projects-table.js
 * - related-project-notes → related-project-note-table.js
 * - mentions            → mentions-table.js
 *
 * Usage:
 * ```pm-table
 * type: client-engagements
 * ```
 */
export function registerPmTableProcessor(
  services: PluginServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor("pm-table", (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmTableRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

class PmTableRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: PluginServices
  ) {
    super(containerEl);
  }

  render(): void {
    this.containerEl.empty();

    let config: PmTableConfig;
    try {
      config = parseYaml(this.source) as PmTableConfig;
    } catch {
      this.renderError("Invalid pm-table config: could not parse YAML.");
      return;
    }

    if (!config?.type) {
      this.renderError("pm-table requires a `type` field.");
      return;
    }

    try {
      this.renderTable(config);
    } catch (err) {
      this.renderError(`pm-table error: ${String(err)}`);
    }
  }

  private renderTable(config: PmTableConfig): void {
    const qs = this.services.queryService;
    const currentFile = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!currentFile || !("basename" in currentFile)) {
      this.renderError("Could not determine current file.");
      return;
    }

    const file = currentFile as import("obsidian").TFile;

    switch (config.type) {
      case "client-engagements":
        this.renderEngagementsTable(qs.getLinkedEntities("engagements", "#engagement", "client", file));
        break;
      case "client-people":
        this.renderPeopleTable(qs.getLinkedEntities("people", "#person", "client", file));
        break;
      case "engagement-projects":
        this.renderProjectsTable(qs.getLinkedEntities("projects", "#project", "engagement", file));
        break;
      case "related-project-notes": {
        const notes = qs.getProjectNotes(file);
        const mentions = qs.getMentions(file).filter(
          (p) => normalizeToName(p.relatedProject) !== file.basename
        );
        this.renderProjectNotesTable(notes, mentions);
        break;
      }
      case "mentions":
        this.renderMentionsTable(qs.getMentions(file));
        break;
      default:
        this.renderError(`Unknown pm-table type: ${String(config.type)}`);
    }
  }

  // ─── Table renderers ────────────────────────────────────────────────────

  private renderEngagementsTable(pages: DataviewPage[]): void {
    if (pages.length === 0) {
      this.renderEmpty("No engagements found.");
      return;
    }

    const sorted = [...pages].sort((a, b) => {
      const aStatus = a.status === "Active" ? 0 : 1;
      const bStatus = b.status === "Active" ? 0 : 1;
      if (aStatus !== bStatus) return aStatus - bStatus;
      const aDate = String(a["start-date"] ?? "");
      const bDate = String(b["start-date"] ?? "");
      return bDate.localeCompare(aDate); // desc
    });

    this.buildTable(
      ["Engagement", "Status", "Start Date", "End Date"],
      sorted.map((p) => [
        this.fileLink(p),
        this.statusBadge(String(p.status ?? "")),
        formatDate(String(p["start-date"] ?? "")),
        formatDate(String(p["end-date"] ?? "")),
      ])
    );
  }

  private renderPeopleTable(pages: DataviewPage[]): void {
    if (pages.length === 0) {
      this.renderEmpty("No people found.");
      return;
    }

    const sorted = [...pages].sort((a, b) => {
      const aStatus = a.status === "Active" ? 0 : 1;
      const bStatus = b.status === "Active" ? 0 : 1;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return a.file.name.localeCompare(b.file.name);
    });

    this.buildTable(
      ["Person", "Status", "Title"],
      sorted.map((p) => [
        this.fileLink(p),
        this.statusBadge(String(p.status ?? "")),
        String(p.title ?? ""),
      ])
    );
  }

  private renderProjectsTable(pages: DataviewPage[]): void {
    if (pages.length === 0) {
      this.renderEmpty("No projects found.");
      return;
    }

    const STATUS_ORDER: Record<string, number> = {
      New: 1,
      Active: 2,
      "On Hold": 3,
      Complete: 4,
    };

    const sorted = [...pages].sort((a, b) => {
      const aOrder = STATUS_ORDER[String(a.status ?? "")] ?? 5;
      const bOrder = STATUS_ORDER[String(b.status ?? "")] ?? 5;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (Number(a.priority) || 99) - (Number(b.priority) || 99);
    });

    this.buildTable(
      ["Project", "Status", "Priority", "Start Date"],
      sorted.map((p) => [
        this.fileLink(p),
        this.statusBadge(String(p.status ?? "")),
        String(p.priority ?? ""),
        formatDate(String(p["start-date"] ?? "")),
      ])
    );
  }

  private renderProjectNotesTable(notes: DataviewPage[], mentions: DataviewPage[]): void {
    if (notes.length > 0) {
      this.containerEl.createEl("h5", { text: "Related Notes" });
      this.buildTable(
        ["Note", "Modified"],
        [...notes]
          .sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf())
          .map((p) => [this.fileLink(p), formatDate(p.file.mtime.toISO())])
      );
    }

    if (mentions.length > 0) {
      this.containerEl.createEl("hr");
      this.containerEl.createEl("h5", { text: "Mentions" });
      this.buildTable(
        ["Note", "Location"],
        [...mentions]
          .sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf())
          .map((p) => [this.fileLink(p), p.file.folder.replace(/\//g, " ‣ ")])
      );
    }

    if (notes.length === 0 && mentions.length === 0) {
      this.renderEmpty("No related notes or mentions.");
    }
  }

  private renderMentionsTable(pages: DataviewPage[]): void {
    if (pages.length === 0) {
      this.renderEmpty("No mentions found.");
      return;
    }

    const sorted = [...pages].sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf());

    this.buildTable(
      ["Note", "Location"],
      sorted.map((p) => [this.fileLink(p), p.file.folder.replace(/\//g, " ‣ ")])
    );
  }

  // ─── DOM helpers ────────────────────────────────────────────────────────

  private buildTable(headers: string[], rows: string[][]): void {
    const table = this.containerEl.createEl("table", { cls: "pm-table" });

    // Header row
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    for (const h of headers) {
      headerRow.createEl("th", { text: h });
    }

    // Body rows
    const tbody = table.createEl("tbody");
    for (const row of rows) {
      const tr = tbody.createEl("tr");
      for (const cell of row) {
        const td = tr.createEl("td");
        td.innerHTML = cell; // cells may contain HTML (links, badges)
      }
    }
  }

  private fileLink(page: DataviewPage): string {
    return `<a class="internal-link" data-href="${page.file.path}" href="${page.file.path}">${page.file.name}</a>`;
  }

  private statusBadge(status: string): string {
    const cls = `pm-status-badge pm-status-badge--${status.toLowerCase().replace(/\s+/g, "-")}`;
    return `<span class="${cls}">${status}</span>`;
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: "pm-error" });
    div.style.color = "var(--text-error)";
    div.style.padding = "8px";
    div.textContent = message;
  }

  private renderEmpty(message: string): void {
    const em = this.containerEl.createEl("em", { text: message });
    em.style.color = "var(--text-muted)";
  }
}
