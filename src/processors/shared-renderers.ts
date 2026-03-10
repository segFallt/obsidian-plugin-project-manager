import type { TFile } from "obsidian";
import type { ActionProcessorServices, PropertyProcessorServices } from "../plugin-context";
import type { PmActionConfig, PmTableConfig, DataviewPage } from "../types";
import { PLUGIN_ID, ENTITY_TAGS, STATUS, PROJECT_STATUS_ORDER, PRIORITY_FALLBACK, CSS_CLS, CSS_VAR } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { formatDate } from "../utils/date-utils";

// ─── Action command map ──────────────────────────────────────────────────────

/** Maps action type strings to plugin command IDs. */
export const ACTION_COMMAND_MAP: Record<string, string> = {
  "create-client": `${PLUGIN_ID}:create-client`,
  "create-engagement": `${PLUGIN_ID}:create-engagement`,
  "create-project": `${PLUGIN_ID}:create-project`,
  "create-person": `${PLUGIN_ID}:create-person`,
  "create-inbox": `${PLUGIN_ID}:create-inbox`,
  "create-single-meeting": `${PLUGIN_ID}:create-single-meeting`,
  "create-recurring-meeting": `${PLUGIN_ID}:create-recurring-meeting`,
  "create-recurring-meeting-event": `${PLUGIN_ID}:create-recurring-meeting-event`,
  "create-project-note": `${PLUGIN_ID}:create-project-note`,
  "convert-inbox": `${PLUGIN_ID}:convert-inbox`,
  "convert-single-to-recurring": `${PLUGIN_ID}:convert-single-to-recurring`,
  "scaffold-vault": `${PLUGIN_ID}:scaffold-vault`,
};

// ─── Action buttons ──────────────────────────────────────────────────────────

/**
 * Renders a row of action buttons that execute plugin commands.
 * When an action has a `context` field, sets the action context on services
 * so the target command can auto-populate its parent entity field.
 *
 * @param container   - Parent element to append the button row to
 * @param actions     - Action descriptors from the config
 * @param services    - Action processor services (commandExecutor, actionContext)
 * @param sourcePath  - Path of the note containing this block (for context value)
 */
export function renderActionButtons(
  container: HTMLElement,
  actions: PmActionConfig[],
  services: ActionProcessorServices,
  sourcePath?: string
): void {
  if (!Array.isArray(actions) || actions.length === 0) return;

  const buttonRow = container.createDiv({ cls: "pm-actions" });
  for (const action of actions) {
    renderButton(buttonRow, action, services, sourcePath);
  }
}

function renderButton(
  container: HTMLElement,
  action: PmActionConfig,
  services: ActionProcessorServices,
  sourcePath?: string
): void {
  const commandId = action.commandId ?? ACTION_COMMAND_MAP[action.type];

  const cls = ["pm-actions__button"];
  if (action.style === "primary") cls.push("mod-cta");
  if (action.style === "destructive") cls.push("mod-destructive");

  const btn = container.createEl("button", {
    text: action.label,
    cls: cls.join(" "),
  });

  if (!commandId) {
    btn.disabled = true;
    btn.title = `Unknown action type: ${action.type}`;
    btn.style.opacity = "0.5";
    return;
  }

  btn.addEventListener("click", () => {
    if (action.context && sourcePath) {
      const currentFile = services.app.vault.getAbstractFileByPath(sourcePath);
      if (currentFile && "basename" in currentFile) {
        services.actionContext.set({
          field: action.context.field,
          value: (currentFile as TFile).basename,
        });
      }
    }
    services.commandExecutor.executeCommandById(commandId);
  });
}

// ─── Entity tables ───────────────────────────────────────────────────────────

/**
 * Renders an entity relationship table in the given container.
 * Mirrors the individual renderXxxTable methods from PmTableRenderChild.
 */
export function renderEntityTable(
  container: HTMLElement,
  tableType: PmTableConfig["type"],
  sourcePath: string,
  services: PropertyProcessorServices
): void {
  const qs = services.queryService;
  const currentFile = services.app.vault.getAbstractFileByPath(sourcePath);
  if (!currentFile || !("basename" in currentFile)) {
    renderTableError(container, "Could not determine current file.");
    return;
  }
  const file = currentFile as TFile;

  switch (tableType) {
    case "client-engagements":
      renderEngagementsTable(container, qs.getLinkedEntities(services.settings.folders.engagements, ENTITY_TAGS.engagement, "client", file));
      break;
    case "client-people":
      renderPeopleTable(container, qs.getLinkedEntities(services.settings.folders.people, ENTITY_TAGS.person, "client", file));
      break;
    case "engagement-projects":
      renderProjectsTable(container, qs.getLinkedEntities(services.settings.folders.projects, ENTITY_TAGS.project, "engagement", file));
      break;
    case "related-project-notes": {
      const notes = qs.getProjectNotes(file);
      const mentions = qs.getMentions(file).filter(
        (p) => normalizeToName(p.relatedProject) !== file.basename
      );
      renderProjectNotesTable(container, notes, mentions);
      break;
    }
    case "mentions":
      renderMentionsTable(container, qs.getMentions(file));
      break;
    default:
      renderTableError(container, `Unknown table type: ${String(tableType)}`);
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
  const cls = `pm-status-badge pm-status-badge--${status.toLowerCase().replace(/\s+/g, "-")}`;
  return `<span class="${cls}">${status}</span>`;
}

function renderTableError(container: HTMLElement, message: string): void {
  const div = container.createDiv({ cls: CSS_CLS.PM_ERROR });
  div.style.color = CSS_VAR.TEXT_ERROR;
  div.style.padding = "8px";
  div.textContent = message;
}

function renderTableEmpty(container: HTMLElement, message: string): void {
  const em = container.createEl("em", { text: message });
  em.style.color = CSS_VAR.TEXT_MUTED;
}
