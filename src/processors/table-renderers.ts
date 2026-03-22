import type { TFile } from "obsidian";
import type { PropertyProcessorServices } from "../plugin-context";
import type { PmTableConfig, DataviewPage } from "../types";
import {
  ENTITY_TAGS,
  STATUS,
  PROJECT_STATUS_ORDER,
  PRIORITY_FALLBACK,
  CSS_CLS,
  CSS_VAR,
  TABLE_TYPE,
  ERROR_PADDING,
} from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { formatDate } from "../utils/date-utils";
import { renderError } from "./dom-helpers";

// ─── Table renderer registry ─────────────────────────────────────────────────

type TableRenderer = (container: HTMLElement, file: TFile, services: PropertyProcessorServices) => void;

const TABLE_RENDERERS: Record<string, TableRenderer> = {
  [TABLE_TYPE.CLIENT_ENGAGEMENTS]: (container, file, services) =>
    renderEngagementsTable(
      container,
      services.queryService.getLinkedEntities(services.settings.folders.engagements, ENTITY_TAGS.engagement, "client", file)
    ),
  [TABLE_TYPE.CLIENT_PEOPLE]: (container, file, services) =>
    renderPeopleTable(
      container,
      services.queryService.getLinkedEntities(services.settings.folders.people, ENTITY_TAGS.person, "client", file)
    ),
  [TABLE_TYPE.ENGAGEMENT_PROJECTS]: (container, file, services) =>
    renderProjectsTable(
      container,
      services.queryService.getLinkedEntities(services.settings.folders.projects, ENTITY_TAGS.project, "engagement", file)
    ),
  [TABLE_TYPE.RELATED_PROJECT_NOTES]: (container, file, services) => {
    const notes = services.queryService.getProjectNotes(file);
    const mentions = services.queryService.getMentions(file).filter(
      (p) => normalizeToName(p.relatedProject) !== file.basename
    );
    renderProjectNotesTable(container, notes, mentions);
  },
  [TABLE_TYPE.MENTIONS]: (container, file, services) =>
    renderMentionsTable(container, services.queryService.getMentions(file)),
};

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Renders an entity relationship table in the given container.
 * Dispatches to the appropriate renderer via a registry map.
 */
export function renderEntityTable(
  container: HTMLElement,
  tableType: PmTableConfig["type"],
  sourcePath: string,
  services: PropertyProcessorServices
): void {
  const currentFile = services.app.vault.getAbstractFileByPath(sourcePath);
  if (!currentFile || !("basename" in currentFile)) {
    renderError(container, "Could not determine current file.", ERROR_PADDING);
    return;
  }
  const file = currentFile as TFile;

  const renderer = TABLE_RENDERERS[tableType];
  if (renderer) {
    renderer(container, file, services);
  } else {
    renderError(container, `Unknown table type: ${String(tableType)}`, ERROR_PADDING);
  }
}

// ─── Table renderers (free functions) ────────────────────────────────────────

function renderEngagementsTable(container: HTMLElement, pages: DataviewPage[]): void {
  if (pages.length === 0) {
    renderTableEmpty(container, "No engagements found.");
    return;
  }
  const sorted = [...pages].sort((a, b) => {
    const aStatus = a.status === STATUS.ACTIVE ? 0 : 1;
    const bStatus = b.status === STATUS.ACTIVE ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return String(b["start-date"] ?? "").localeCompare(String(a["start-date"] ?? ""));
  });
  buildTable(container, ["Engagement", "Status", "Start Date", "End Date"],
    sorted.map((p) => [
      fileLink(p),
      statusBadge(String(p.status ?? "")),
      formatDate(String(p["start-date"] ?? "")),
      formatDate(String(p["end-date"] ?? "")),
    ])
  );
}

function renderPeopleTable(container: HTMLElement, pages: DataviewPage[]): void {
  if (pages.length === 0) {
    renderTableEmpty(container, "No people found.");
    return;
  }
  const sorted = [...pages].sort((a, b) => {
    const aStatus = a.status === STATUS.ACTIVE ? 0 : 1;
    const bStatus = b.status === STATUS.ACTIVE ? 0 : 1;
    if (aStatus !== bStatus) return aStatus - bStatus;
    return a.file.name.localeCompare(b.file.name);
  });
  buildTable(container, ["Person", "Status", "Title"],
    sorted.map((p) => [fileLink(p), statusBadge(String(p.status ?? "")), String(p.title ?? "")])
  );
}

function renderProjectsTable(container: HTMLElement, pages: DataviewPage[]): void {
  if (pages.length === 0) {
    renderTableEmpty(container, "No projects found.");
    return;
  }
  const sorted = [...pages].sort((a, b) => {
    const aOrder = PROJECT_STATUS_ORDER[String(a.status ?? "")] ?? 5;
    const bOrder = PROJECT_STATUS_ORDER[String(b.status ?? "")] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (Number(a.priority) || PRIORITY_FALLBACK) - (Number(b.priority) || PRIORITY_FALLBACK);
  });
  buildTable(container, ["Project", "Status", "Priority", "Start Date"],
    sorted.map((p) => [
      fileLink(p),
      statusBadge(String(p.status ?? "")),
      String(p.priority ?? ""),
      formatDate(String(p["start-date"] ?? "")),
    ])
  );
}

function renderProjectNotesTable(container: HTMLElement, notes: DataviewPage[], mentions: DataviewPage[]): void {
  if (notes.length > 0) {
    container.createEl("h5", { text: "Related Notes" });
    buildTable(container, ["Note", "Modified"],
      [...notes]
        .sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf())
        .map((p) => [fileLink(p), formatDate(p.file.mtime.toISO())])
    );
  }
  if (mentions.length > 0) {
    container.createEl("hr");
    container.createEl("h5", { text: "Mentions" });
    buildTable(container, ["Note", "Location"],
      [...mentions]
        .sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf())
        .map((p) => [fileLink(p), p.file.folder.replace(/\//g, " ‣ ")])
    );
  }
  if (notes.length === 0 && mentions.length === 0) {
    renderTableEmpty(container, "No related notes or mentions.");
  }
}

function renderMentionsTable(container: HTMLElement, pages: DataviewPage[]): void {
  if (pages.length === 0) {
    renderTableEmpty(container, "No mentions found.");
    return;
  }
  const sorted = [...pages].sort((a, b) => b.file.mtime.valueOf() - a.file.mtime.valueOf());
  buildTable(container, ["Note", "Location"],
    sorted.map((p) => [fileLink(p), p.file.folder.replace(/\//g, " ‣ ")])
  );
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

export function buildTable(container: HTMLElement, headers: string[], rows: string[][]): void {
  const table = container.createEl("table", { cls: "pm-table" });
  const thead = table.createEl("thead");
  const headerRow = thead.createEl("tr");
  for (const h of headers) headerRow.createEl("th", { text: h });
  const tbody = table.createEl("tbody");
  for (const row of rows) {
    const tr = tbody.createEl("tr");
    for (const cell of row) {
      const td = tr.createEl("td");
      td.innerHTML = cell;
    }
  }
}

export function fileLink(page: DataviewPage): string {
  return `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${page.file.path}" href="${page.file.path}">${page.file.name}</a>`;
}

export function statusBadge(status: string): string {
  const cls = `${CSS_CLS.STATUS_BADGE} ${CSS_CLS.STATUS_BADGE_PREFIX}${status.toLowerCase().replace(/\s+/g, "-")}`;
  return `<span class="${cls}">${status}</span>`;
}

function renderTableEmpty(container: HTMLElement, message: string): void {
  const em = container.createEl("em", { text: message });
  em.style.color = CSS_VAR.TEXT_MUTED;
}
