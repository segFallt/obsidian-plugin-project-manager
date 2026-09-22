import { TFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import type { RaidProcessorServices } from "../services/interfaces";
import type { SavedRaidDashboardFilters } from "../types";
import { CODEBLOCK, FM_KEY, LOG_CONTEXT, RAID_DASHBOARD_MSG, VAULT_EVENT } from "../constants";
import { RaidQuery } from "../services/raid-query";
import { RaidDashboardView } from "./raid-views/raid-dashboard-view";
import type { PmRaidDashboardConfig } from "./raid-views/raid-dashboard-view";
import { DashboardRenderChild } from "./dashboard-render-child";
import { FrontmatterViewStore } from "./view-state-store";
import type { ViewState } from "./view-state-store";
import { ObsidianFrontmatterIO } from "./frontmatter-io";
import { renderError } from "./dom-helpers";

/**
 * Registers the `pm-raid-dashboard` code block on the generic capability spine.
 * It is hosted by {@link DashboardRenderChild} (owning the vault-modify
 * lifecycle and echo-suppressed refresh) and persists its filter state through a
 * {@link FrontmatterViewStore} under the `pm-raid-dashboard-filters` frontmatter
 * key. The RAID specifics — the query, the filter spec, and the matrix/group
 * renderers — live behind the shell's narrow interfaces (see
 * {@link RaidDashboardView}).
 */
export function registerPmRaidDashboardProcessor(
  plugin: Plugin,
  services: RaidProcessorServices
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODEBLOCK.PM_RAID_DASHBOARD,
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      el.empty();

      const config = parseConfig(source, el, services);
      if (!config) return;

      const store = new FrontmatterViewStore(
        new ObsidianFrontmatterIO(services.app),
        () => fileAtPath(services, ctx.sourcePath)
      );
      const stateKey = FM_KEY.RAID_DASHBOARD_FILTERS;
      const entityQuery = new RaidQuery(() => services.queryService.dv());
      const savedFilters = store.load(stateKey) as SavedRaidDashboardFilters | null;

      const child = new DashboardRenderChild(el, {
        createView: (persist, container) =>
          new RaidDashboardView(
            container,
            config,
            services,
            entityQuery,
            savedFilters,
            (filters) => persist(filters as ViewState | null)
          ),
        store,
        stateKey,
        readModifiedState: () => store.load(stateKey),
        registerModify: (handler) =>
          services.app.vault.on(VAULT_EVENT.MODIFY, (file) => {
            if (file instanceof TFile) handler(file);
          }),
      });

      ctx.addChild(child);
      child.render();
    }
  );
}

/** Parses the code-block YAML; renders an error into `el` and returns null on failure. */
function parseConfig(
  source: string,
  el: HTMLElement,
  services: RaidProcessorServices
): PmRaidDashboardConfig | null {
  try {
    const parsed = source.trim() ? (parseYaml(source) as PmRaidDashboardConfig) : {};
    return parsed ?? {};
  } catch {
    services.loggerService.warn(RAID_DASHBOARD_MSG.INVALID_CONFIG, LOG_CONTEXT.RAID_DASHBOARD_PROCESSOR);
    renderError(el, RAID_DASHBOARD_MSG.INVALID_CONFIG);
    return null;
  }
}

/** Resolves the code block's host note as a `TFile`, or null when absent. */
function fileAtPath(services: RaidProcessorServices, sourcePath: string): TFile | null {
  const file = services.app.vault.getAbstractFileByPath(sourcePath);
  return file instanceof TFile ? file : null;
}
