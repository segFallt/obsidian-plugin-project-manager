import { TFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { TaskProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTasksConfig, SavedDashboardFilters, SavedByProjectFilters } from "../types";
import { TaskListRenderer } from "./task-list-renderer";
import { DashboardView } from "./pm-tasks-dashboard";
import { ByProjectView } from "./pm-tasks-by-project";
import { TaskQuery } from "../services/entity-query";
import { DashboardRenderChild } from "./dashboard-render-child";
import type { DashboardViewFactory } from "./dashboard-render-child";
import { FrontmatterViewStore, KEY_PATH_SEPARATOR } from "./view-state-store";
import type { ViewState, ViewStateStore } from "./view-state-store";
import { ObsidianFrontmatterIO } from "./frontmatter-io";
import { renderError } from "./dom-helpers";
import { hashString } from "../utils/hash-utils";
import { CODEBLOCK, FM_KEY, LOG_CONTEXT, PM_TASKS_MODE, PM_TASKS_MSG, VAULT_EVENT } from "../constants";

/**
 * Renders the task dashboard and tasks-by-project views.
 *
 * Replaces the vault's tasks-dashboard.js (~567 lines) and tasks-by-project.js (~199 lines),
 * along with their Meta Bind filter controls.
 *
 * Usage:
 * ```pm-tasks
 * mode: dashboard
 * ```
 * ```pm-tasks
 * mode: by-project
 * ```
 *
 * Both modes are hosted by the generic {@link DashboardRenderChild}, which owns
 * the vault-modify lifecycle and routes filter-state persistence through a
 * {@link FrontmatterViewStore} under a per-block `pm-view-state.<blockKey>` key
 * (migrated forward from the legacy flat `pm-tasks-filters` key on first load).
 */
export function registerPmTasksProcessor(
  services: TaskProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_TASKS, (source, el, ctx: MarkdownPostProcessorContext) => {
    el.empty();

    const config = parseConfig(source, el, services);
    if (!config) return;

    const store = new FrontmatterViewStore(
      new ObsidianFrontmatterIO(services.app),
      () => fileAtPath(services, ctx.sourcePath)
    );
    const stateKey = blockStateKey(config, source);

    const createView = buildViewFactory(config, services, store, stateKey);
    if (!createView) {
      const msg = PM_TASKS_MSG.UNKNOWN_MODE(String(config.mode));
      services.loggerService.warn(msg, LOG_CONTEXT.TASKS_PROCESSOR);
      renderError(el, msg);
      return;
    }

    services.loggerService.debug(
      `pm-tasks rendering, mode: "${config.mode}", source: "${ctx.sourcePath}"`,
      LOG_CONTEXT.TASKS_PROCESSOR
    );

    const child = new DashboardRenderChild(el, {
      createView,
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
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parses and validates the code-block config; renders an error into `el` and returns null on failure. */
function parseConfig(
  source: string,
  el: HTMLElement,
  services: TaskProcessorServices
): PmTasksConfig | null {
  let config: PmTasksConfig;
  try {
    config = parseYaml(source) as PmTasksConfig;
  } catch {
    services.loggerService.warn(PM_TASKS_MSG.INVALID_CONFIG, LOG_CONTEXT.TASKS_PROCESSOR);
    renderError(el, PM_TASKS_MSG.INVALID_CONFIG);
    return null;
  }

  if (!config?.mode) {
    services.loggerService.warn(PM_TASKS_MSG.REQUIRES_MODE, LOG_CONTEXT.TASKS_PROCESSOR);
    renderError(el, PM_TASKS_MSG.REQUIRES_MODE);
    return null;
  }

  return config;
}

/** The view-component factory a {@link DashboardRenderChild} calls when it mounts. */
type ViewFactory = DashboardViewFactory;

/**
 * Builds the view-component factory for the config's mode, or null for an
 * unknown mode. The factory defers construction until the host mounts and
 * receives the live render child as the markdown-render `component`.
 */
function buildViewFactory(
  config: PmTasksConfig,
  services: TaskProcessorServices,
  store: ViewStateStore,
  stateKey: string
): ViewFactory | null {
  const onMigrationError = (err: unknown): void =>
    services.loggerService.warn(PM_TASKS_MSG.MIGRATION_FAILED(String(err)), LOG_CONTEXT.TASKS_PROCESSOR);

  if (config.mode === PM_TASKS_MODE.DASHBOARD) {
    const entityQuery = new TaskQuery(
      () => services.queryService.dv(),
      () => services.settings.folders.utility
    );
    const savedFilters = loadWithMigration(store, stateKey, onMigrationError) as SavedDashboardFilters | null;
    return (persist, container, component) =>
      new DashboardView(
        container,
        config,
        services,
        services.sortService,
        new TaskListRenderer(services, component),
        entityQuery,
        savedFilters,
        (filters) => persist(filters as ViewState | null)
      );
  }

  if (config.mode === PM_TASKS_MODE.BY_PROJECT) {
    const savedFilters = loadWithMigration(store, stateKey, onMigrationError) as SavedByProjectFilters | null;
    return (persist, container, component) =>
      new ByProjectView(
        container,
        config,
        services,
        services.sortService,
        new TaskListRenderer(services, component),
        savedFilters,
        (filters) => persist(filters as ViewState | null)
      );
  }

  return null;
}

/**
 * The per-block dot-path key this block persists its state under:
 * `pm-view-state.<blockKey>`, where `blockKey` is the explicit `id:` or a hash
 * of the block source. Structurally-different blocks hash apart automatically;
 * byte-identical blocks share a key unless given distinct `id:`s.
 */
export function blockStateKey(config: PmTasksConfig, source: string): string {
  const explicitId = config.id?.trim();
  const blockKey = explicitId ? explicitId : hashString(source);
  return `${FM_KEY.VIEW_STATE}${KEY_PATH_SEPARATOR}${blockKey}`;
}

/**
 * Loads this block's persisted state, migrating a legacy flat `pm-tasks-filters`
 * value forward on first load: if the per-block entry is absent but the legacy
 * key holds a value, it is **copied** into the per-block entry (leaving the
 * legacy key in place as a read-only fallback so sibling blocks never reset) and
 * returned.
 */
export function loadWithMigration(
  store: ViewStateStore,
  stateKey: string,
  onMigrationError?: (err: unknown) => void
): ViewState | null {
  const perBlock = store.load(stateKey);
  if (perBlock !== null) return perBlock;

  const legacy = store.load(FM_KEY.TASKS_FILTERS);
  if (legacy !== null) {
    // Fire-and-forget copy: the legacy key is retained, so a failed write simply
    // retries on the next load — but surface the failure rather than swallow it.
    void store.save(stateKey, legacy).catch((err) => onMigrationError?.(err));
    return legacy;
  }
  return null;
}

/** Resolves the code block's host note as a `TFile`, or null when absent. */
function fileAtPath(services: TaskProcessorServices, sourcePath: string): TFile | null {
  const file = services.app.vault.getAbstractFileByPath(sourcePath);
  return file instanceof TFile ? file : null;
}
