import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PluginServices, RegisterProcessorFn } from "../plugin-context";
import { ENTITY_VIEW_SECTIONS } from "./entity-view-registry";
import { renderActionButtons, renderEntityTable } from "./shared-renderers";
import { CODEBLOCK, CSS_CLS, CSS_VAR } from "../constants";

interface PmEntityViewConfig {
  entity: string;
  section: string;
}

/**
 * Renders a combined heading + action buttons + table section for an entity type.
 *
 * Replaces inline pm-actions + pm-table pairs in entity templates with a single
 * maintainable block. The entity+section combination is looked up in the
 * entity-view-registry, so adding a new view only requires updating the registry.
 *
 * Usage:
 * ```pm-entity-view
 * entity: client
 * section: engagements
 * ```
 */
export function registerPmEntityViewProcessor(
  services: PluginServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_ENTITY_VIEW, (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmEntityViewRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

class PmEntityViewRenderChild extends MarkdownRenderChild {
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

    let config: PmEntityViewConfig;
    try {
      config = parseYaml(this.source) as PmEntityViewConfig;
    } catch {
      const msg = "Invalid pm-entity-view config: could not parse YAML.";
      this.services.loggerService.warn(msg, "pm-entity-view");
      this.renderError(msg);
      return;
    }

    if (!config?.entity) {
      const msg = "pm-entity-view requires an `entity` field.";
      this.services.loggerService.warn(msg, "pm-entity-view");
      this.renderError(msg);
      return;
    }
    if (!config?.section) {
      const msg = "pm-entity-view requires a `section` field.";
      this.services.loggerService.warn(msg, "pm-entity-view");
      this.renderError(msg);
      return;
    }

    const entityDef = ENTITY_VIEW_SECTIONS[config.entity];
    if (!entityDef) {
      const msg = `Unknown entity type: "${config.entity}". Valid types: ${Object.keys(ENTITY_VIEW_SECTIONS).join(", ")}`;
      this.services.loggerService.warn(msg, "pm-entity-view");
      this.renderError(msg);
      return;
    }

    const sectionDef = entityDef[config.section];
    if (!sectionDef) {
      const msg = `Unknown section "${config.section}" for entity "${config.entity}". Valid sections: ${Object.keys(entityDef).join(", ")}`;
      this.services.loggerService.warn(msg, "pm-entity-view");
      this.renderError(msg);
      return;
    }

    if (sectionDef.heading) {
      this.containerEl.createEl("h2", { text: sectionDef.heading });
    }

    if (sectionDef.actions?.length) {
      renderActionButtons(this.containerEl, sectionDef.actions, this.services, this.sourcePath);
    }

    for (const table of sectionDef.tables ?? []) {
      renderEntityTable(
        this.containerEl,
        table.type,
        this.sourcePath,
        this.services
      );
    }
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: CSS_CLS.PM_ERROR });
    div.style.color = CSS_VAR.TEXT_ERROR;
    div.style.padding = "8px";
    div.textContent = message;
  }
}
