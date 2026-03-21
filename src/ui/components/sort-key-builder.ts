import type { SortKey, SortField, SortDirection } from "@/types";

/** Maximum number of sort keys allowed in the builder. */
const MAX_SORT_KEYS = 3;

/** Display names for each sort field. */
const SORT_FIELD_LABELS: Record<SortField, string> = {
  dueDate: "Due Date",
  priority: "Priority",
  alphabetical: "Alphabetical",
  context: "Context",
  createdDate: "Created Date",
};

/** All available sort fields in display order. */
const ALL_SORT_FIELDS: SortField[] = ["dueDate", "priority", "alphabetical", "context", "createdDate"];

export interface SortKeyBuilderConfig {
  keys: SortKey[];
  onChange: (keys: SortKey[]) => void;
}

/**
 * Reusable multi-key sort builder component.
 *
 * Renders up to 3 sort key rows. Each row has a drag handle (decorative),
 * field label, direction toggle, up/down reorder buttons, and remove button.
 * Below the rows, an "+ Add sort key" affordance shows available field pills.
 *
 * DOM layout:
 *   .pm-tasks-sort-builder
 *     .pm-tasks-sort-key  ×N
 *       span.pm-tasks-sort-key__handle
 *       span.pm-tasks-sort-key__field
 *       button.pm-tasks-sort-key__dir (+ --asc or --desc)
 *       button.pm-tasks-sort-key__up
 *       button.pm-tasks-sort-key__down
 *       button.pm-tasks-sort-key__remove
 *     .pm-tasks-sort-add  (hidden when 3 keys present)
 *       .pm-tasks-pill-group
 *         button.pm-tasks-pill  ×M
 */
export class SortKeyBuilder {
  private keys: SortKey[];

  constructor(
    private readonly container: HTMLElement,
    private readonly config: SortKeyBuilderConfig
  ) {
    this.keys = [...config.keys];
    this.render();
  }

  /** Releases DOM (clears the container). */
  destroy(): void {
    this.container.empty();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.empty();

    const builder = this.container.createDiv({ cls: "pm-tasks-sort-builder" });

    // Render each sort key row
    this.keys.forEach((key, index) => {
      const row = builder.createDiv({ cls: "pm-tasks-sort-key" });

      // Drag handle (visual only)
      row.createSpan({ cls: "pm-tasks-sort-key__handle", text: "⠿" });

      // Field label
      row.createSpan({
        cls: "pm-tasks-sort-key__field",
        text: SORT_FIELD_LABELS[key.field],
      });

      // Direction toggle
      const dirBtn = row.createEl("button", {
        cls: `pm-tasks-sort-key__dir pm-tasks-sort-key__dir--${key.direction}`,
        text: key.direction === "asc" ? "↑ Asc" : "↓ Desc",
      });
      dirBtn.addEventListener("click", () => {
        const newDir: SortDirection = key.direction === "asc" ? "desc" : "asc";
        this.keys = this.keys.map((k, i) => (i === index ? { ...k, direction: newDir } : k));
        this.config.onChange([...this.keys]);
        this.render();
      });

      // Up button (disabled for first row)
      const upBtn = row.createEl("button", {
        cls: "pm-tasks-sort-key__up",
        text: "▲",
        attr: { "aria-label": "Move sort key up" },
      });
      if (index === 0) upBtn.disabled = true;
      upBtn.addEventListener("click", () => {
        if (index === 0) return;
        this.keys = swapItems(this.keys, index - 1, index);
        this.config.onChange([...this.keys]);
        this.render();
      });

      // Down button (disabled for last row)
      const downBtn = row.createEl("button", {
        cls: "pm-tasks-sort-key__down",
        text: "▼",
        attr: { "aria-label": "Move sort key down" },
      });
      if (index === this.keys.length - 1) downBtn.disabled = true;
      downBtn.addEventListener("click", () => {
        if (index === this.keys.length - 1) return;
        this.keys = swapItems(this.keys, index, index + 1);
        this.config.onChange([...this.keys]);
        this.render();
      });

      // Remove button
      const removeBtn = row.createEl("button", {
        cls: "pm-tasks-sort-key__remove",
        text: "×",
        attr: { "aria-label": `Remove ${SORT_FIELD_LABELS[key.field]} sort key` },
      });
      removeBtn.addEventListener("click", () => {
        this.keys = this.keys.filter((_, i) => i !== index);
        this.config.onChange([...this.keys]);
        this.render();
      });
    });

    // "+ Add sort key" affordance — hidden when max keys reached
    if (this.keys.length < MAX_SORT_KEYS) {
      const addRow = builder.createDiv({ cls: "pm-tasks-sort-add" });
      addRow.createSpan({ text: "+ Add sort key: " });

      const usedFields = new Set(this.keys.map((k) => k.field));
      const availableFields = ALL_SORT_FIELDS.filter((f) => !usedFields.has(f));

      const pillGroup = addRow.createDiv({ cls: "pm-tasks-pill-group" });
      for (const field of availableFields) {
        const pill = pillGroup.createEl("button", {
          cls: "pm-tasks-pill",
          text: SORT_FIELD_LABELS[field],
        });
        pill.addEventListener("click", () => {
          this.keys = [...this.keys, { field, direction: "asc" }];
          this.config.onChange([...this.keys]);
          this.render();
        });
      }
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────

function swapItems<T>(arr: T[], i: number, j: number): T[] {
  const result = [...arr];
  [result[i], result[j]] = [result[j], result[i]];
  return result;
}
