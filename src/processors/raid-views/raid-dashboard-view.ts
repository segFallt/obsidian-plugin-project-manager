import type {
  DataviewPage,
  RaidDashboardFilters,
  SavedRaidDashboardFilters,
  RaidType,
  RaidStatus,
} from "../../types";
import {
  HTML_TAG,
  CSS_CLS,
  DOM_EVENT,
  INPUT_TYPE,
  MSG,
  LOG_CONTEXT,
  ENTITY_TAGS,
  DEBOUNCE_MS,
  RAID_VIEW_MODE,
  RAID_DASHBOARD_MSG,
  RAID_DASHBOARD_TEXT,
} from "../../constants";
import { RAID_TYPES, RAID_STATUSES, RAID_DEFAULT_ACTIVE_STATUSES } from "../../raid-constants";
import { RAID_TYPE_ABBR } from "./raid-view-constants";
import type { RaidRenderHelpers } from "./raid-view-constants";
import { RaidDashboardRenderer } from "./raid-dashboard-renderer";
import { buildRaidFilterSpec, buildRaidFilterState } from "../../services/raid-filter";
import { DashboardShell } from "../dashboard-shell";
import type { DashboardShellDeps } from "../dashboard-shell";
import type { IEntityQuery } from "../../services/entity-query";
import type { RaidProcessorServices } from "../../services/interfaces";
import type { DashboardViewComponent } from "../dashboard-render-child";
import { renderError } from "../dom-helpers";
import { debounced } from "../../utils/debounce";
import { FilterChipSelect } from "../../ui/components/filter-chip-select";
import { buildEntityOptions } from "../../utils/filter-utils";

/** Optional starting filter values a `pm-raid-dashboard` code block may declare. */
export interface PmRaidDashboardConfig {
  raidTypes?: RaidType[];
  statusFilter?: RaidStatus[];
  clientFilter?: string[];
  engagementFilter?: string[];
}

/** No precomputed render helpers are needed; the renderers are self-contained. */
const NO_RENDER_HELPERS: RaidRenderHelpers = {};

/** Returns a copy of `list` with `value` toggled in or out. */
function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * A saved filter value as an array, or `undefined` when it is not one. With an
 * `allowed` list, unrecognised entries are dropped — so a stale or corrupted
 * saved key can never inject invalid enum values into the live filter state.
 */
function savedArray<T>(saved: unknown, allowed?: readonly T[]): T[] | undefined {
  if (!Array.isArray(saved)) return undefined;
  return allowed ? saved.filter((v): v is T => (allowed as readonly unknown[]).includes(v)) : (saved as T[]);
}

/** The chip class, with the active modifier appended when selected. */
function chipClass(active: boolean): string {
  return active ? `${CSS_CLS.RAID_CHIP} ${CSS_CLS.RAID_CHIP_ACTIVE}` : CSS_CLS.RAID_CHIP;
}

/**
 * The RAID dashboard's view component: owns the filter panel UI and filter
 * state, and drives the shared {@link DashboardShell} to repaint the matrix +
 * count strip + grouped tables. The shell owns only the resolve → filter →
 * render data-flow; persistence is delegated to a {@link ViewStateStore} via the
 * host through `onSaveFilters`. The matrix cell and search text stay ephemeral —
 * enforced by the {@link SavedRaidDashboardFilters} type passed to `save`.
 */
export class RaidDashboardView implements DashboardViewComponent {
  private filters!: RaidDashboardFilters;
  private outputEl!: HTMLElement;
  private chipSelects: FilterChipSelect[] = [];
  private readonly dashboardRenderer = new RaidDashboardRenderer();
  private readonly search = debounced(() => this.refreshOutput(), DEBOUNCE_MS.PROPERTIES);

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmRaidDashboardConfig,
    private readonly services: RaidProcessorServices,
    private readonly entityQuery: IEntityQuery<DataviewPage>,
    private readonly savedFilters?: SavedRaidDashboardFilters | null,
    private readonly onSaveFilters?: ((filters: SavedRaidDashboardFilters | null) => void) | null
  ) {}

  render(): void {
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: CSS_CLS.RAID_DASHBOARD });
    this.renderFilterPanel(root);
    this.outputEl = root.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_OUTPUT });
    void this.refreshDashboardOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) void this.refreshDashboardOutput(this.outputEl);
  }

  destroy(): void {
    this.search.cancel();
    this.destroyChipSelects();
  }

  // ─── Filter state ──────────────────────────────────────────────────────────

  private initFilters(): void {
    const saved = this.savedFilters;
    const cfg = this.config;
    this.filters = {
      raidTypes: savedArray(saved?.raidTypes, RAID_TYPES) ?? cfg.raidTypes ?? [...RAID_TYPES],
      statusFilter:
        savedArray(saved?.statusFilter, RAID_STATUSES) ?? cfg.statusFilter ?? [...RAID_DEFAULT_ACTIVE_STATUSES],
      clientFilter: savedArray<string>(saved?.clientFilter) ?? cfg.clientFilter ?? [],
      engagementFilter: savedArray<string>(saved?.engagementFilter) ?? cfg.engagementFilter ?? [],
      searchText: "",
      matrixCell: null,
    };
  }

  /** Persists the durable filter subset, then repaints the output. */
  private onFilterChanged(): void {
    this.persistFilters();
    this.refreshOutput();
  }

  private persistFilters(): void {
    if (!this.onSaveFilters) return;
    const f = this.filters;
    const toSave: SavedRaidDashboardFilters = {
      raidTypes: f.raidTypes,
      statusFilter: f.statusFilter,
      clientFilter: f.clientFilter,
      engagementFilter: f.engagementFilter,
    };
    this.onSaveFilters(toSave);
  }

  // ─── Filter panel ────────────────────────────────────────────────────────

  private renderFilterPanel(container: HTMLElement): void {
    const panel = container.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_PANEL });
    this.renderTypeChips(panel);
    this.renderStatusChips(panel);
    this.renderClientFilter(panel);
    this.renderEngagementFilter(panel);
    this.renderSearch(panel);
  }

  private renderTypeChips(panel: HTMLElement): void {
    const row = panel.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_ROW });
    row.createSpan({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_LABEL, text: RAID_DASHBOARD_TEXT.TYPE_LABEL });
    const chips = row.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_CHIPS });
    for (const raidType of RAID_TYPES) {
      const chip = chips.createEl(HTML_TAG.BUTTON, {
        cls: chipClass(this.filters.raidTypes.includes(raidType)),
        text: RAID_TYPE_ABBR[raidType],
      });
      chip.title = raidType;
      chip.addEventListener(DOM_EVENT.CLICK, () => {
        this.filters.raidTypes = toggleValue(this.filters.raidTypes, raidType);
        chip.classList.toggle(CSS_CLS.RAID_CHIP_ACTIVE);
        this.onFilterChanged();
      });
    }
  }

  private renderStatusChips(panel: HTMLElement): void {
    const row = panel.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_ROW });
    row.createSpan({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_LABEL, text: RAID_DASHBOARD_TEXT.STATUS_LABEL });
    const chips = row.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_CHIPS });
    for (const status of RAID_STATUSES) {
      const chip = chips.createEl(HTML_TAG.BUTTON, {
        cls: chipClass(this.filters.statusFilter.includes(status)),
        text: status,
      });
      chip.addEventListener(DOM_EVENT.CLICK, () => {
        this.filters.statusFilter = toggleValue(this.filters.statusFilter, status);
        chip.classList.toggle(CSS_CLS.RAID_CHIP_ACTIVE);
        this.onFilterChanged();
      });
    }
  }

  private renderClientFilter(panel: HTMLElement): void {
    const row = panel.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_ROW });
    row.createSpan({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_LABEL, text: RAID_DASHBOARD_TEXT.CLIENTS_LABEL });
    const chipSelect = new FilterChipSelect(row, this.services.app, {
      options: buildEntityOptions(ENTITY_TAGS.client, this.services.queryService),
      selectedValues: this.filters.clientFilter,
      placeholder: RAID_DASHBOARD_TEXT.CLIENT_FILTER_PLACEHOLDER,
      ariaLabel: RAID_DASHBOARD_TEXT.CLIENT_FILTER_ARIA,
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters.clientFilter = selectedValues;
        this.onFilterChanged();
      },
    });
    this.chipSelects.push(chipSelect);
  }

  private renderEngagementFilter(panel: HTMLElement): void {
    const row = panel.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_ROW });
    row.createSpan({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_LABEL, text: RAID_DASHBOARD_TEXT.ENGAGEMENTS_LABEL });
    const chipSelect = new FilterChipSelect(row, this.services.app, {
      options: buildEntityOptions(ENTITY_TAGS.engagement, this.services.queryService),
      selectedValues: this.filters.engagementFilter,
      placeholder: RAID_DASHBOARD_TEXT.ENGAGEMENT_FILTER_PLACEHOLDER,
      ariaLabel: RAID_DASHBOARD_TEXT.ENGAGEMENT_FILTER_ARIA,
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters.engagementFilter = selectedValues;
        this.onFilterChanged();
      },
    });
    this.chipSelects.push(chipSelect);
  }

  private renderSearch(panel: HTMLElement): void {
    const row = panel.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_FILTER_ROW });
    const input = row.createEl(HTML_TAG.INPUT, {
      cls: CSS_CLS.RAID_DASHBOARD_SEARCH,
      attr: { type: INPUT_TYPE.TEXT, placeholder: RAID_DASHBOARD_TEXT.SEARCH_PLACEHOLDER, value: this.filters.searchText },
    });
    input.addEventListener(DOM_EVENT.INPUT, () => {
      this.filters.searchText = input.value;
      this.search.trigger();
    });
  }

  private destroyChipSelects(): void {
    for (const chipSelect of this.chipSelects) chipSelect.destroy();
    this.chipSelects = [];
  }

  // ─── Output rendering ──────────────────────────────────────────────────────

  private async refreshDashboardOutput(outputEl: HTMLElement): Promise<void> {
    const dv = this.services.queryService.dv();
    if (!dv) {
      outputEl.empty();
      outputEl.createEl(HTML_TAG.EM, { text: MSG.DATAVIEW_UNAVAILABLE });
      return;
    }

    try {
      await this.buildShell(outputEl).render(outputEl);
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.RAID_DASHBOARD, err);
      outputEl.empty();
      renderError(outputEl, RAID_DASHBOARD_MSG.ERROR(String(err)));
    }
  }

  /**
   * Assembles the generic {@link DashboardShell} from the RAID query, the single
   * composite renderer, and the RAID spec/state builders. The shell owns only
   * the data-flow; the filter panel and persistence stay on this view. A matrix
   * cell-click arrives here through `onFilterChange` and repaints the output.
   */
  private buildShell(
    outputEl: HTMLElement
  ): DashboardShell<DataviewPage, RaidRenderHelpers, RaidDashboardFilters> {
    const deps: DashboardShellDeps<DataviewPage, RaidRenderHelpers, RaidDashboardFilters> = {
      query: this.entityQuery,
      views: { [RAID_VIEW_MODE.MATRIX]: this.dashboardRenderer },
      getViewMode: () => RAID_VIEW_MODE.MATRIX,
      getFilters: () => this.filters,
      buildSpec: () => buildRaidFilterSpec({ hierarchyService: this.services.hierarchyService }),
      buildState: () => buildRaidFilterState(this.filters),
      buildHelpers: () => NO_RENDER_HELPERS,
      onFilterChange: (patch) => {
        // The only interactive renderer is the matrix, which emits the ephemeral
        // `matrixCell` — not part of the persisted subset — so no save here.
        Object.assign(this.filters, patch);
        void this.refreshDashboardOutput(outputEl);
      },
      emptyMessage: RAID_DASHBOARD_MSG.NO_ITEMS_MATCH,
      onUnknownMode: (el, mode) => renderError(el, RAID_DASHBOARD_MSG.UNKNOWN_VIEW_MODE(mode)),
    };
    return new DashboardShell(deps);
  }
}
