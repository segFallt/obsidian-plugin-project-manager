import { TFile } from "obsidian";
import type { PropertyProcessorServices } from "../plugin-context";
import type { DataviewPage } from "../types";
import { ENTITY_TAGS, TEXTAREA_ROWS, ISO_DATETIME_INPUT_LENGTH, ISO_DATE_LENGTH, CSS_CLS } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { PropertySuggest } from "../ui/components/property-suggest";
import type { AutocompleteOption } from "../ui/components/property-suggest";
import type { FieldDescriptor, FieldType } from "./entity-field-config";

// ─── Render context ───────────────────────────────────────────────────────

/**
 * Dependencies passed from `PmPropertiesRenderChild` to individual field renderers.
 * Keeps field renderers stateless while allowing them to register autocompletes
 * and persist frontmatter changes.
 */
export interface FieldRenderContext {
  services: PropertyProcessorServices;
  sourcePath: string;
  onAutocomplete: (ac: PropertySuggest) => void;
  updateFm: (file: TFile, key: string, value: unknown) => void;
}

// ─── Field renderer registry ──────────────────────────────────────────────

type FieldRenderer = (
  row: HTMLElement,
  field: FieldDescriptor,
  rawValue: unknown,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
) => void;

const FIELD_RENDERERS: Partial<Record<FieldType, FieldRenderer>> = {
  "text": (row, field, rawValue, file, fieldId, ctx) =>
    renderTextInput(row, field, String(rawValue ?? ""), file, fieldId, ctx),
  "textarea": (row, field, rawValue, file, fieldId, ctx) =>
    renderTextarea(row, field, String(rawValue ?? ""), file, fieldId, ctx),
  "date": (row, field, rawValue, file, fieldId, ctx) =>
    renderDateInput(row, field, String(rawValue ?? ""), file, fieldId, ctx),
  "datetime": (row, field, rawValue, file, fieldId, ctx) =>
    renderDateInput(row, field, String(rawValue ?? ""), file, fieldId, ctx),
  "select": (row, field, rawValue, file, fieldId, ctx) =>
    renderSelect(row, field, String(rawValue ?? ""), file, fieldId, ctx),
  "suggester": (row, field, rawValue, file, fieldId, ctx) =>
    renderSuggester(row, field, rawValue, file, fieldId, ctx),
  "suggester-by-folder": (row, field, rawValue, file, fieldId, ctx) =>
    renderSuggesterByFolder(row, field, rawValue, file, fieldId, ctx),
  "list-suggester": (row, field, rawValue, file, fieldId, ctx) =>
    renderListSuggester(row, field, rawValue, file, fieldId, ctx),
};

// ─── Public entry point ───────────────────────────────────────────────────

/**
 * Renders a single frontmatter property field inside `container`.
 * Dispatches to the appropriate renderer via a registry map.
 */
export function renderField(
  container: HTMLElement,
  field: FieldDescriptor,
  fm: Record<string, unknown>,
  file: TFile,
  ctx: FieldRenderContext
): void {
  const row = container.createDiv({ cls: CSS_CLS.PROPERTIES_ROW });
  const fieldId = `pm-prop-${ctx.sourcePath.replace(/[^a-z0-9]/gi, "-")}-${field.key}`;
  const label = row.createEl("label", { text: field.label, cls: CSS_CLS.PROPERTIES_LABEL });
  label.setAttribute("for", fieldId);

  const rawValue = fm[field.key];
  FIELD_RENDERERS[field.type]?.(row, field, rawValue, file, fieldId, ctx);
}

// ─── Field type renderers ─────────────────────────────────────────────────

function renderTextInput(
  row: HTMLElement,
  field: FieldDescriptor,
  value: string,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  const input = row.createEl("input", { type: "text", value, cls: CSS_CLS.PROPERTIES_INPUT });
  input.id = fieldId;
  input.addEventListener("change", () => {
    void ctx.updateFm(file, field.key, input.value.trim() || null);
  });
}

function renderTextarea(
  row: HTMLElement,
  field: FieldDescriptor,
  value: string,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  const textarea = row.createEl("textarea", { cls: CSS_CLS.PROPERTIES_TEXTAREA });
  textarea.id = fieldId;
  textarea.value = value;
  textarea.rows = TEXTAREA_ROWS;
  textarea.style.width = "100%";
  textarea.addEventListener("change", () => {
    void ctx.updateFm(file, field.key, textarea.value.trim() || null);
  });
}

function renderDateInput(
  row: HTMLElement,
  field: FieldDescriptor,
  value: string,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  const input = row.createEl("input", {
    type: field.type === "datetime" ? "datetime-local" : "date",
    value: value.substring(0, field.type === "datetime" ? ISO_DATETIME_INPUT_LENGTH : ISO_DATE_LENGTH),
    cls: CSS_CLS.PROPERTIES_INPUT,
  });
  input.id = fieldId;
  input.addEventListener("change", () => {
    void ctx.updateFm(file, field.key, input.value || null);
  });
}

function renderSelect(
  row: HTMLElement,
  field: FieldDescriptor,
  currentValue: string,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  const select = row.createEl("select", { cls: `${CSS_CLS.PROPERTIES_SELECT} dropdown` });
  select.id = fieldId;
  for (const opt of field.options ?? []) {
    const option = select.createEl("option", { text: opt, value: opt });
    if (opt === currentValue) option.selected = true;
  }
  select.addEventListener("change", () => {
    const raw = select.value;
    if (field.valueType === 'number') {
      const num = Number(raw);
      void ctx.updateFm(file, field.key, raw === '' || Number.isNaN(num) ? null : num);
    } else {
      void ctx.updateFm(file, field.key, raw);
    }
  });
}

function renderSuggester(
  row: HTMLElement,
  field: FieldDescriptor,
  rawValue: unknown,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  if (!field.entityTag) return;
  const { entityTag } = field;

  const pages = ctx.services.queryService.getActiveEntitiesByTag(entityTag);
  const currentName = normalizeToName(rawValue);

  const options: AutocompleteOption[] = pages
    .sort((a, b) => a.file.name.localeCompare(b.file.name))
    .map((page) => ({
      value: page.file.name,
      displayText: getEnrichedDisplayText(page, entityTag, ctx),
    }));

  const ac = new PropertySuggest(row, ctx.services.app, options, currentName, {
    placeholder: `Select ${field.label}...`,
    ariaLabel: field.label,
    onSelect: (option) => {
      void ctx.updateFm(file, field.key, `[[${option.value}]]`);
    },
    onClear: () => {
      void ctx.updateFm(file, field.key, null);
    },
  });
  ac.inputEl.id = fieldId;
  ctx.onAutocomplete(ac);
}

function renderSuggesterByFolder(
  row: HTMLElement,
  field: FieldDescriptor,
  rawValue: unknown,
  file: TFile,
  fieldId: string,
  ctx: FieldRenderContext
): void {
  const pages = ctx.services.queryService.getActiveRecurringMeetings();
  const currentName = normalizeToName(rawValue);

  const options: AutocompleteOption[] = pages
    .sort((a, b) => a.file.name.localeCompare(b.file.name))
    .map((page) => ({ value: page.file.name, displayText: page.file.name }));

  const ac = new PropertySuggest(row, ctx.services.app, options, currentName, {
    placeholder: `Select ${field.label}...`,
    ariaLabel: field.label,
    onSelect: (option) => {
      void ctx.updateFm(file, field.key, `[[${option.value}]]`);
    },
    onClear: () => {
      void ctx.updateFm(file, field.key, null);
    },
  });
  ac.inputEl.id = fieldId;
  ctx.onAutocomplete(ac);
}

function renderListSuggester(
  row: HTMLElement,
  field: FieldDescriptor,
  rawValue: unknown,
  file: TFile,
  _fieldId: string,
  ctx: FieldRenderContext
): void {
  if (!field.entityTag) return;
  const { entityTag } = field;

  const pages = ctx.services.queryService.getActiveEntitiesByTag(entityTag);
  const currentItems = parseListValue(rawValue);

  const wrapper = row.createDiv({ cls: CSS_CLS.PROPERTIES_LIST_SUGGESTER });
  const chipsEl = wrapper.createDiv({ cls: CSS_CLS.PROPERTIES_CHIPS });

  const renderChips = (items: string[]) => {
    chipsEl.empty();
    for (const item of items) {
      const chip = chipsEl.createSpan({ cls: CSS_CLS.PROPERTIES_CHIP });
      chip.createSpan({ text: getEnrichedDisplayForName(item, entityTag, ctx) });
      const remove = chip.createSpan({ text: "×", cls: CSS_CLS.PROPERTIES_CHIP_REMOVE });
      remove.addEventListener("click", () => {
        const newItems = items.filter((i) => i !== item);
        void ctx.updateFm(file, field.key, newItems.map((i) => `[[${i}]]`));
        renderChips(newItems);
      });
    }
  };

  renderChips(currentItems);

  const options: AutocompleteOption[] = pages
    .sort((a, b) => a.file.name.localeCompare(b.file.name))
    .map((page) => ({
      value: page.file.name,
      displayText: getEnrichedDisplayText(page, entityTag, ctx),
    }));

  const ac = new PropertySuggest(wrapper, ctx.services.app, options, null, {
    placeholder: `+ Add ${field.label}...`,
    ariaLabel: `Add ${field.label}`,
    includeNone: false,
    onSelect: (option) => {
      const existing = parseListValue(
        ctx.services.app.metadataCache.getFileCache(file)?.frontmatter?.[field.key]
      );
      if (!existing.includes(option.value)) {
        const newItems = [...existing, option.value];
        void ctx.updateFm(file, field.key, newItems.map((i) => `[[${i}]]`));
        renderChips(newItems);
      }
      ac.clear();
      ac.reopen();
    },
  });
  ctx.onAutocomplete(ac);
}

// ─── Private helpers ──────────────────────────────────────────────────────

function getEnrichedDisplayText(
  page: DataviewPage,
  entityTag: string,
  ctx: FieldRenderContext
): string {
  if (entityTag === ENTITY_TAGS.engagement || entityTag === ENTITY_TAGS.person) {
    const clientName = normalizeToName(page.client);
    if (clientName) return `${page.file.name} (${clientName})`;
  }
  return page.file.name;
}

function getEnrichedDisplayForName(
  name: string,
  entityTag: string,
  ctx: FieldRenderContext
): string {
  if (entityTag === ENTITY_TAGS.engagement || entityTag === ENTITY_TAGS.person) {
    const pages = ctx.services.queryService.getActiveEntitiesByTag(entityTag);
    const page = pages.find((p) => p.file.name === name);
    if (page) return getEnrichedDisplayText(page, entityTag, ctx);
  }
  return name;
}

function parseListValue(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((i) => normalizeToName(i) ?? String(i)).filter(Boolean);
  const name = normalizeToName(raw);
  return name ? [name] : [];
}
