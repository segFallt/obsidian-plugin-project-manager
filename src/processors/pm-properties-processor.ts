import { MarkdownRenderChild, TFile, parseYaml } from "obsidian";
import type ProjectManagerPlugin from "../main";
import type { PmPropertiesConfig, EntityType } from "../types";
import { ENTITY_TAGS } from "../constants";
import { normalizeToName } from "../utils/link-utils";

/**
 * Renders interactive frontmatter property editors.
 *
 * Replaces Meta Bind embed components (meta-bind-embed code blocks).
 * Changes are persisted immediately via processFrontMatter.
 *
 * Usage:
 * ```pm-properties
 * entity: project
 * ```
 */
export function registerPmPropertiesProcessor(plugin: ProjectManagerPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("pm-properties", (source, el, ctx) => {
    const child = new PmPropertiesRenderChild(el, source, ctx.sourcePath, plugin);
    ctx.addChild(child);
    child.render();
  });
}

// ─── Field descriptors ────────────────────────────────────────────────────

type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "select"
  | "multi-select"
  | "suggester"
  | "list-suggester";

interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** For suggester fields: the Dataview tag to query */
  entityTag?: string;
}

const ENTITY_FIELDS: Record<EntityType, FieldDescriptor[]> = {
  client: [
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    { key: "contact-name", label: "Contact Name", type: "text" },
    { key: "contact-email", label: "Contact Email", type: "text" },
    { key: "contact-phone", label: "Contact Phone", type: "text" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  engagement: [
    { key: "client", label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    { key: "start-date", label: "Start Date", type: "date" },
    { key: "end-date", label: "End Date", type: "date" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  project: [
    { key: "engagement", label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: "start-date", label: "Start Date", type: "date" },
    { key: "end-date", label: "End Date", type: "date" },
    { key: "priority", label: "Priority", type: "select", options: ["1", "2", "3", "4", "5"] },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["New", "Active", "On Hold", "Complete"],
    },
  ],
  person: [
    { key: "client", label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    { key: "title", label: "Title", type: "text" },
    { key: "reports-to", label: "Reports To", type: "suggester", entityTag: ENTITY_TAGS.person },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  inbox: [
    { key: "engagement", label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: "status", label: "Status", type: "select", options: ["Active", "Complete"] },
  ],
  "single-meeting": [
    { key: "engagement", label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: "date", label: "Date", type: "datetime" },
    { key: "attendees", label: "Attendees", type: "list-suggester", entityTag: ENTITY_TAGS.person },
  ],
  "recurring-meeting": [
    { key: "engagement", label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
    { key: "start-date", label: "Start Date", type: "date" },
    { key: "end-date", label: "End Date", type: "date" },
  ],
  "project-note": [
    { key: "relatedProject", label: "Related Project", type: "text" },
    { key: "engagement", label: "Engagement", type: "suggester", entityTag: ENTITY_TAGS.engagement },
  ],
};

// ─── Render child ──────────────────────────────────────────────────────────

class PmPropertiesRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly plugin: ProjectManagerPlugin
  ) {
    super(containerEl);
  }

  render(): void {
    this.containerEl.empty();

    let config: PmPropertiesConfig;
    try {
      config = parseYaml(this.source) as PmPropertiesConfig;
    } catch {
      this.renderError("Invalid pm-properties config.");
      return;
    }

    if (!config?.entity) {
      this.renderError("pm-properties requires an `entity` field.");
      return;
    }

    const fields = ENTITY_FIELDS[config.entity];
    if (!fields) {
      this.renderError(`Unknown entity type: ${config.entity}`);
      return;
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) {
      this.renderError("Could not resolve current file.");
      return;
    }

    const fm = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {};

    const form = this.containerEl.createDiv({ cls: "pm-properties" });

    for (const field of fields) {
      this.renderField(form, field, fm, file);
    }
  }

  private renderField(
    container: HTMLElement,
    field: FieldDescriptor,
    fm: Record<string, unknown>,
    file: TFile
  ): void {
    const row = container.createDiv({ cls: "pm-properties__row" });
    // Unique ID ties the <label> to its control for screen-reader accessibility.
    const fieldId = `pm-prop-${this.sourcePath.replace(/[^a-z0-9]/gi, "-")}-${field.key}`;
    const label = row.createEl("label", { text: field.label, cls: "pm-properties__label" });
    label.setAttribute("for", fieldId);

    const rawValue = fm[field.key];

    switch (field.type) {
      case "text":
        this.renderTextInput(row, field, String(rawValue ?? ""), file, fieldId);
        break;
      case "textarea":
        this.renderTextarea(row, field, String(rawValue ?? ""), file, fieldId);
        break;
      case "date":
      case "datetime":
        this.renderDateInput(row, field, String(rawValue ?? ""), file, fieldId);
        break;
      case "select":
        this.renderSelect(row, field, String(rawValue ?? ""), file, fieldId);
        break;
      case "suggester":
        this.renderSuggester(row, field, rawValue, file, fieldId);
        break;
      case "list-suggester":
        this.renderListSuggester(row, field, rawValue, file, fieldId);
        break;
    }
  }

  private renderTextInput(
    row: HTMLElement,
    field: FieldDescriptor,
    value: string,
    file: TFile,
    fieldId: string
  ): void {
    const input = row.createEl("input", {
      type: "text",
      value,
      cls: "pm-properties__input",
    });
    input.id = fieldId;
    input.addEventListener("change", () => {
      void this.updateFm(file, field.key, input.value.trim() || null);
    });
  }

  private renderTextarea(
    row: HTMLElement,
    field: FieldDescriptor,
    value: string,
    file: TFile,
    fieldId: string
  ): void {
    const textarea = row.createEl("textarea", {
      cls: "pm-properties__textarea",
    });
    textarea.id = fieldId;
    textarea.value = value;
    textarea.rows = 3;
    textarea.style.width = "100%";
    textarea.addEventListener("change", () => {
      void this.updateFm(file, field.key, textarea.value.trim() || null);
    });
  }

  private renderDateInput(
    row: HTMLElement,
    field: FieldDescriptor,
    value: string,
    file: TFile,
    fieldId: string
  ): void {
    const input = row.createEl("input", {
      type: field.type === "datetime" ? "datetime-local" : "date",
      value: value.substring(0, field.type === "datetime" ? 16 : 10),
      cls: "pm-properties__input",
    });
    input.id = fieldId;
    input.addEventListener("change", () => {
      void this.updateFm(file, field.key, input.value || null);
    });
  }

  private renderSelect(
    row: HTMLElement,
    field: FieldDescriptor,
    currentValue: string,
    file: TFile,
    fieldId: string
  ): void {
    const select = row.createEl("select", { cls: "pm-properties__select dropdown" });
    select.id = fieldId;

    for (const opt of field.options ?? []) {
      const option = select.createEl("option", { text: opt, value: opt });
      if (opt === currentValue) option.selected = true;
    }

    select.addEventListener("change", () => {
      void this.updateFm(file, field.key, select.value);
    });
  }

  private renderSuggester(
    row: HTMLElement,
    field: FieldDescriptor,
    rawValue: unknown,
    file: TFile,
    fieldId: string
  ): void {
    if (!field.entityTag) return;

    const pages = this.plugin.queryService.getActiveEntitiesByTag(field.entityTag);
    const currentName = normalizeToName(rawValue);

    const select = row.createEl("select", { cls: "pm-properties__select dropdown" });
    select.id = fieldId;

    // Empty/none option
    select.createEl("option", { text: "(None)", value: "" });

    for (const page of pages.sort((a, b) => a.file.name.localeCompare(b.file.name))) {
      const option = select.createEl("option", {
        text: page.file.name,
        value: page.file.name,
      });
      if (page.file.name === currentName) option.selected = true;
    }

    select.addEventListener("change", () => {
      const val = select.value ? `[[${select.value}]]` : null;
      void this.updateFm(file, field.key, val);
    });
  }

  private renderListSuggester(
    row: HTMLElement,
    field: FieldDescriptor,
    rawValue: unknown,
    file: TFile,
    _fieldId: string
  ): void {
    if (!field.entityTag) return;

    const pages = this.plugin.queryService.getActiveEntitiesByTag(field.entityTag);
    const currentItems = this.parseListValue(rawValue);

    const wrapper = row.createDiv({ cls: "pm-properties__list-suggester" });

    // Chips for current selections
    const chipsEl = wrapper.createDiv({ cls: "pm-properties__chips" });

    const renderChips = (items: string[]) => {
      chipsEl.empty();
      for (const item of items) {
        const chip = chipsEl.createSpan({ cls: "pm-properties__chip" });
        chip.createSpan({ text: item });
        const remove = chip.createSpan({ text: "×", cls: "pm-properties__chip-remove" });
        remove.addEventListener("click", () => {
          const newItems = items.filter((i) => i !== item);
          void this.updateFm(
            file,
            field.key,
            newItems.map((i) => `[[${i}]]`)
          );
          renderChips(newItems);
        });
      }
    };

    renderChips(currentItems);

    // Add dropdown
    const addSelect = wrapper.createEl("select", {
      cls: "pm-properties__select dropdown",
    });
    addSelect.createEl("option", { text: "+ Add...", value: "" });

    for (const page of pages.sort((a, b) => a.file.name.localeCompare(b.file.name))) {
      addSelect.createEl("option", { text: page.file.name, value: page.file.name });
    }

    addSelect.addEventListener("change", () => {
      const name = addSelect.value;
      if (!name) return;
      const existing = this.parseListValue(
        this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.[field.key]
      );
      if (!existing.includes(name)) {
        const newItems = [...existing, name];
        void this.updateFm(
          file,
          field.key,
          newItems.map((i) => `[[${i}]]`)
        );
        renderChips(newItems);
      }
      addSelect.value = "";
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseListValue(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((i) => normalizeToName(i) ?? String(i)).filter(Boolean);
    const name = normalizeToName(raw);
    return name ? [name] : [];
  }

  private async updateFm(
    file: TFile,
    key: string,
    value: unknown
  ): Promise<void> {
    await this.plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      if (value === null) {
        delete fm[key];
      } else {
        fm[key] = value;
      }
    });
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: "pm-error" });
    div.style.color = "var(--text-error)";
    div.textContent = message;
  }
}
