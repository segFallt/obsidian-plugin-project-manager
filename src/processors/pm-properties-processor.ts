import { MarkdownRenderChild, TFile, TAbstractFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PluginServices, RegisterProcessorFn } from "../plugin-context";
import type { PmPropertiesConfig, EntityType, DataviewPage } from "../types";
import { ENTITY_TAGS, CLIENT_STATUSES, ENGAGEMENT_STATUSES, PROJECT_STATUSES, TEXTAREA_ROWS, DEBOUNCE_MS } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { InlineAutocomplete } from "../ui/components/inline-autocomplete";
import type { AutocompleteOption } from "../ui/components/inline-autocomplete";

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
export function registerPmPropertiesProcessor(
  services: PluginServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor("pm-properties", (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmPropertiesRenderChild(el, source, ctx.sourcePath, services);
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
    { key: "status", label: "Status", type: "select", options: [...CLIENT_STATUSES] },
    { key: "contact-name", label: "Contact Name", type: "text" },
    { key: "contact-email", label: "Contact Email", type: "text" },
    { key: "contact-phone", label: "Contact Phone", type: "text" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  engagement: [
    { key: "client", label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: "status", label: "Status", type: "select", options: [...ENGAGEMENT_STATUSES] },
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
      options: [...PROJECT_STATUSES],
    },
  ],
  person: [
    { key: "client", label: "Client", type: "suggester", entityTag: ENTITY_TAGS.client },
    { key: "status", label: "Status", type: "select", options: [...CLIENT_STATUSES] },
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
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdating = false;
  private autocompletes: InlineAutocomplete[] = [];

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: PluginServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh when the current file's frontmatter is updated externally.
    // Uses a 500ms debounce; skips re-render during our own processFrontMatter writes.
    this.registerEvent(
      this.services.app.vault.on("modify", (file: TAbstractFile) => {
        if (this.isUpdating) return;
        if (!(file instanceof TFile)) return;
        if (file.path !== this.sourcePath) return;
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

  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.render();
    }, DEBOUNCE_MS.PROPERTIES);
  }

  render(): void {
    for (const ac of this.autocompletes) ac.destroy();
    this.autocompletes = [];
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

    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) {
      this.renderError("Could not resolve current file.");
      return;
    }

    const fm = this.services.app.metadataCache.getFileCache(file)?.frontmatter ?? {};

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
    textarea.rows = TEXTAREA_ROWS;
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

  // ─── Enriched display helpers ─────────────────────────────────────────────

  /**
   * Returns "EntityName (ClientName)" for engagement/person entities that have a
   * client link, otherwise returns the plain file name.
   */
  private getEnrichedDisplayText(page: DataviewPage, entityTag: string): string {
    if (entityTag === ENTITY_TAGS.engagement || entityTag === ENTITY_TAGS.person) {
      const clientName = normalizeToName(page.client);
      if (clientName) return `${page.file.name} (${clientName})`;
    }
    return page.file.name;
  }

  /**
   * Looks up a page by name and returns its enriched display text.
   * Falls back to the plain name if no matching page is found.
   */
  private getEnrichedDisplayForName(name: string, entityTag: string): string {
    if (entityTag === ENTITY_TAGS.engagement || entityTag === ENTITY_TAGS.person) {
      const pages = this.services.queryService.getActiveEntitiesByTag(entityTag);
      const page = pages.find((p) => p.file.name === name);
      if (page) return this.getEnrichedDisplayText(page, entityTag);
    }
    return name;
  }

  private renderSuggester(
    row: HTMLElement,
    field: FieldDescriptor,
    rawValue: unknown,
    file: TFile,
    fieldId: string
  ): void {
    if (!field.entityTag) return;
    const { entityTag } = field;

    const pages = this.services.queryService.getActiveEntitiesByTag(entityTag);
    const currentName = normalizeToName(rawValue);

    const options: AutocompleteOption[] = pages
      .sort((a, b) => a.file.name.localeCompare(b.file.name))
      .map((page) => ({
        value: page.file.name,
        displayText: this.getEnrichedDisplayText(page, entityTag),
      }));

    const ac = new InlineAutocomplete(row, options, currentName, {
      placeholder: `Select ${field.label}...`,
      ariaLabel: field.label,
      onSelect: (option) => {
        void this.updateFm(file, field.key, `[[${option.value}]]`);
      },
      onClear: () => {
        void this.updateFm(file, field.key, null);
      },
    });
    ac.inputEl.id = fieldId;
    this.autocompletes.push(ac);
  }

  private renderListSuggester(
    row: HTMLElement,
    field: FieldDescriptor,
    rawValue: unknown,
    file: TFile,
    _fieldId: string
  ): void {
    if (!field.entityTag) return;
    const { entityTag } = field;

    const pages = this.services.queryService.getActiveEntitiesByTag(entityTag);
    const currentItems = this.parseListValue(rawValue);

    const wrapper = row.createDiv({ cls: "pm-properties__list-suggester" });
    const chipsEl = wrapper.createDiv({ cls: "pm-properties__chips" });

    const renderChips = (items: string[]) => {
      chipsEl.empty();
      for (const item of items) {
        const chip = chipsEl.createSpan({ cls: "pm-properties__chip" });
        chip.createSpan({ text: this.getEnrichedDisplayForName(item, entityTag) });
        const remove = chip.createSpan({ text: "×", cls: "pm-properties__chip-remove" });
        remove.addEventListener("click", () => {
          const newItems = items.filter((i) => i !== item);
          void this.updateFm(file, field.key, newItems.map((i) => `[[${i}]]`));
          renderChips(newItems);
        });
      }
    };

    renderChips(currentItems);

    const options: AutocompleteOption[] = pages
      .sort((a, b) => a.file.name.localeCompare(b.file.name))
      .map((page) => ({
        value: page.file.name,
        displayText: this.getEnrichedDisplayText(page, entityTag),
      }));

    const ac = new InlineAutocomplete(wrapper, options, null, {
      placeholder: `+ Add ${field.label}...`,
      ariaLabel: `Add ${field.label}`,
      includeNone: false,
      onSelect: (option) => {
        const existing = this.parseListValue(
          this.services.app.metadataCache.getFileCache(file)?.frontmatter?.[field.key]
        );
        if (!existing.includes(option.value)) {
          const newItems = [...existing, option.value];
          void this.updateFm(file, field.key, newItems.map((i) => `[[${i}]]`));
          renderChips(newItems);
        }
        ac.clear();
      },
    });
    this.autocompletes.push(ac);
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
    this.isUpdating = true;
    try {
      await this.services.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          if (value === null) {
            delete fm[key];
          } else {
            fm[key] = value;
          }
        }
      );
    } finally {
      this.isUpdating = false;
    }
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: "pm-error" });
    div.style.color = "var(--text-error)";
    div.textContent = message;
  }
}
