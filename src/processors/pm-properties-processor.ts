import { MarkdownRenderChild, TFile, TAbstractFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PropertyProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmPropertiesConfig } from "../types";
import { DEBOUNCE_MS, CODEBLOCK, CSS_CLS, CSS_VAR } from "../constants";

import { ENTITY_FIELDS } from "./entity-field-config";
import { renderField } from "./property-field-renderers";

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
  services: PropertyProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_PROPERTIES, (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmPropertiesRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

// ─── Render child ──────────────────────────────────────────────────────────

const MAX_CACHE_RETRIES = 3;

class PmPropertiesRenderChild extends MarkdownRenderChild {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdating = false;
  private autocompletes: Array<{ destroy(): void }> = [];
  private cacheRetryCount = 0;
  private hasRenderedOnce = false;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: PropertyProcessorServices
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
      const msg = "Invalid pm-properties config.";
      this.services.loggerService.warn(msg, "pm-properties");
      this.renderError(msg);
      return;
    }

    if (!config?.entity) {
      const msg = "pm-properties requires an `entity` field.";
      this.services.loggerService.warn(msg, "pm-properties");
      this.renderError(msg);
      return;
    }

    const fields = ENTITY_FIELDS[config.entity];
    if (!fields) {
      const msg = `Unknown entity type: ${config.entity}`;
      this.services.loggerService.warn(msg, "pm-properties");
      this.renderError(msg);
      return;
    }

    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) {
      const msg = "Could not resolve current file.";
      this.services.loggerService.warn(msg, "pm-properties");
      this.renderError(msg);
      return;
    }

    // Read frontmatter from cache. A null/undefined value means the cache hasn't
    // indexed the file yet (stale cache after entity creation). An empty object {}
    // is a legitimate state (file with no frontmatter properties set yet).
    const cachedFrontmatter = this.services.app.metadataCache.getFileCache(file)?.frontmatter;
    const fm: Record<string, unknown> = cachedFrontmatter ?? {};

    // If the cache has no frontmatter entry at all for the file, it may still be
    // indexing after a freshly created entity. Register a one-shot "resolved"
    // listener to re-render once the cache catches up.
    if (cachedFrontmatter == null && this.cacheRetryCount < MAX_CACHE_RETRIES) {
      this.cacheRetryCount++;
      const cache = this.services.app.metadataCache as unknown as {
        on(event: "resolved", cb: () => void): unknown;
        offref(ref: unknown): void;
      };
      const ref = cache.on("resolved", () => {
        cache.offref(ref);
        this.render();
      });
      return;
    }
    // Reset retry counter once we have a real cache entry (even if frontmatter is empty).
    this.cacheRetryCount = 0;

    this.services.loggerService.debug(`pm-properties rendering, entity: "${config.entity}", source: "${this.sourcePath}"`, 'pm-properties');
    const form = this.containerEl.createDiv({ cls: "pm-properties" });

    for (const field of fields) {
      renderField(form, field, fm, file, {
        services: this.services,
        sourcePath: this.sourcePath,
        onAutocomplete: (ac) => this.autocompletes.push(ac),
        updateFm: (f, key, value) => { void this.updateFm(f, key, value); },
      });
    }

    // On first render, schedule a one-off deferred re-render to pick up any
    // relationship fields that entity creation writes in a second processFrontMatter
    // call (after the metadata cache has the template values but not yet the links).
    if (!this.hasRenderedOnce) {
      this.hasRenderedOnce = true;
      setTimeout(() => {
        if (this.containerEl.isConnected) {
          this.render();
        }
      }, DEBOUNCE_MS.PROPERTIES_INITIAL);
    }
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
    const div = this.containerEl.createDiv({ cls: CSS_CLS.PM_ERROR });
    div.style.color = CSS_VAR.TEXT_ERROR;
    div.textContent = message;
  }
}
