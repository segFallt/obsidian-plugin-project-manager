import { MarkdownRenderChild, parseYaml, TFile } from "obsidian";
import type { App, MarkdownPostProcessorContext } from "obsidian";
import type { Plugin } from "obsidian";
import type { IQueryService, ILoggerService, RaidProcessorServices } from "../services/interfaces";
import type { RaidDashboardFilters, RaidType, RaidStatus, RaidLikelihood, RaidImpact, DataviewPage, SavedRaidDashboardFilters } from "../types";
import { CODEBLOCK, DEBOUNCE_MS, CSS_CLS, ENTITY_TAGS, FM_KEY } from "../constants";
import { renderError } from "./dom-helpers";
import { normalizeToName } from "../utils/link-utils";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { buildEntityOptions } from "../utils/filter-utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];
const RAID_TYPE_ABBR: Record<RaidType, string> = { Risk: "R", Assumption: "A", Issue: "I", Decision: "D" };
const RAID_STATUSES: RaidStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const LIKELIHOODS: RaidLikelihood[] = ["High", "Medium", "Low"];
const IMPACTS: RaidImpact[] = ["Low", "Medium", "High"]; // columns: low→high left to right

// Matrix cell CSS class based on likelihood×impact key
const MATRIX_CELL_CLASS: Record<string, string> = {
  "High-High": "raid-cell--hh",
  "High-Medium": "raid-cell--hm",
  "High-Low": "raid-cell--hl",
  "Medium-High": "raid-cell--mh",
  "Medium-Medium": "raid-cell--mm",
  "Medium-Low": "raid-cell--ml",
  "Low-High": "raid-cell--lh",
  "Low-Medium": "raid-cell--lm",
  "Low-Low": "raid-cell--ll",
};

const STATUS_CSS: Record<string, string> = {
  "Open": "raid-status--open",
  "In Progress": "raid-status--in-progress",
  "Resolved": "raid-status--resolved",
  "Closed": "raid-status--closed",
};

// ─── Config type ─────────────────────────────────────────────────────────────

interface PmRaidDashboardConfig {
  raidTypes?: RaidType[];
  statusFilter?: RaidStatus[];
  clientFilter?: string[];
  engagementFilter?: string[];
}

// ─── Default filters ─────────────────────────────────────────────────────────

function defaultFilters(config: PmRaidDashboardConfig): RaidDashboardFilters {
  return {
    raidTypes: config.raidTypes ?? [...RAID_TYPES],
    statusFilter: config.statusFilter ?? ["Open", "In Progress"],
    clientFilter: config.clientFilter ?? [],
    engagementFilter: config.engagementFilter ?? [],
    searchText: "",
    matrixCell: null,
  };
}

// ─── Exported registration function ─────────────────────────────────────────

export function registerPmRaidDashboardProcessor(
  plugin: Plugin,
  services: RaidProcessorServices
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODEBLOCK.PM_RAID_DASHBOARD,
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const child = new PmRaidDashboardRenderChild(
        el,
        source,
        ctx.sourcePath,
        services.app,
        services.queryService,
        services.loggerService
      );
      ctx.addChild(child);
      child.render();
    }
  );
}

// ─── Render child ───────────────────────────────────────────────────────────

class PmRaidDashboardRenderChild extends MarkdownRenderChild {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdating = false;
  private filters!: RaidDashboardFilters;
  private config: PmRaidDashboardConfig = {};
  private chipSelects: FilterChipSelect[] = [];

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly app: App,
    private readonly queryService: IQueryService,
    private readonly loggerService: ILoggerService
  ) {
    super(containerEl);
  }

  onload(): void {
    this.registerEvent(
      this.app.vault.on("modify", () => {
        if (this.isUpdating) return;
        this.debouncedRefresh();
      })
    );
  }

  onunload(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.destroyChipSelects();
  }

  render(): void {
    // Parse config on first render (or re-render); preserve ephemeral filter state
    try {
      const parsed = this.source.trim()
        ? (parseYaml(this.source) as PmRaidDashboardConfig)
        : {};
      this.config = parsed ?? {};
    } catch {
      renderError(this.containerEl, "Invalid pm-raid-dashboard config.");
      return;
    }

    // Initialise filters from config on first render only
    if (!this.filters) {
      this.filters = defaultFilters(this.config);
      this.loadSavedFilters();
    }

    this.destroyChipSelects();
    this.containerEl.empty();

    let allItems: DataviewPage[];
    try {
      allItems = this.queryService.getAllRaidItems();
    } catch (err) {
      renderError(this.containerEl, `pm-raid-dashboard: ${String(err)}`);
      return;
    }

    const dashboard = this.containerEl.createDiv({ cls: "pm-raid-dashboard" });

    this.renderFilterPanel(dashboard, allItems);
    const filtered = this.applyFilters(allItems);
    this.renderMatrix(dashboard, filtered);
    this.renderCountStrip(dashboard, filtered);
    this.renderItemGroups(dashboard, filtered);
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private loadSavedFilters(): void {
    const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return;
    const cache = this.app.metadataCache.getFileCache(file);
    const saved = cache?.frontmatter?.[FM_KEY.RAID_DASHBOARD_FILTERS] as Partial<SavedRaidDashboardFilters> | undefined;
    if (!saved) return;
    if (Array.isArray(saved.clientFilter)) {
      this.filters.clientFilter = saved.clientFilter;
    }
    if (Array.isArray(saved.engagementFilter)) {
      this.filters.engagementFilter = saved.engagementFilter;
    }
    if (Array.isArray(saved.raidTypes)) {
      this.filters.raidTypes = saved.raidTypes.filter((v): v is RaidType =>
        ["Risk", "Assumption", "Issue", "Decision"].includes(v)
      );
    }
    if (Array.isArray(saved.statusFilter)) {
      this.filters.statusFilter = saved.statusFilter.filter((v): v is RaidStatus =>
        ["Open", "In Progress", "Resolved", "Closed"].includes(v)
      );
    }
  }

  private debouncedSaveFilters(): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      void this.persistFilters();
    }, DEBOUNCE_MS.PROPERTIES);
  }

  private async persistFilters(): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return;
    this.isUpdating = true;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        const toSave: SavedRaidDashboardFilters = {
          clientFilter: this.filters.clientFilter,
          engagementFilter: this.filters.engagementFilter,
          raidTypes: this.filters.raidTypes,
          statusFilter: this.filters.statusFilter,
        };
        fm[FM_KEY.RAID_DASHBOARD_FILTERS] = toSave;
      });
    } finally {
      this.isUpdating = false;
    }
  }

  // ─── FilterChipSelect lifecycle ──────────────────────────────────────────

  private destroyChipSelects(): void {
    for (const cs of this.chipSelects) {
      cs.destroy();
    }
    this.chipSelects = [];
  }

  // ─── Filter panel ───────────────────────────────────────────────────────

  private renderFilterPanel(container: HTMLElement, _allItems: DataviewPage[]): void {
    const panel = container.createDiv({ cls: "pm-raid-dashboard__filters" });

    // RAID type toggles
    const typeRow = panel.createDiv({ cls: "pm-raid-dashboard__filter-row" });
    typeRow.createSpan({ cls: "pm-raid-dashboard__filter-label", text: "Type" });
    const typeChips = typeRow.createDiv({ cls: "pm-raid-dashboard__chips" });
    for (const raidType of RAID_TYPES) {
      const active = this.filters.raidTypes.includes(raidType);
      const chip = typeChips.createEl("button", {
        cls: `raid-chip${active ? " raid-chip--active" : ""}`,
        text: RAID_TYPE_ABBR[raidType],
      });
      chip.title = raidType;
      chip.addEventListener("click", () => {
        if (this.filters.raidTypes.includes(raidType)) {
          this.filters.raidTypes = this.filters.raidTypes.filter((t) => t !== raidType);
        } else {
          this.filters.raidTypes = [...this.filters.raidTypes, raidType];
        }
        this.debouncedSaveFilters();
        this.render();
      });
    }

    // Status toggles
    const statusRow = panel.createDiv({ cls: "pm-raid-dashboard__filter-row" });
    statusRow.createSpan({ cls: "pm-raid-dashboard__filter-label", text: "Status" });
    const statusChips = statusRow.createDiv({ cls: "pm-raid-dashboard__chips" });
    for (const status of RAID_STATUSES) {
      const active = this.filters.statusFilter.includes(status);
      const chip = statusChips.createEl("button", {
        cls: `raid-chip${active ? " raid-chip--active" : ""}`,
        text: status,
      });
      chip.addEventListener("click", () => {
        if (this.filters.statusFilter.includes(status)) {
          this.filters.statusFilter = this.filters.statusFilter.filter((s) => s !== status);
        } else {
          this.filters.statusFilter = [...this.filters.statusFilter, status];
        }
        this.debouncedSaveFilters();
        this.render();
      });
    }

    // Client FilterChipSelect
    const clientRow = panel.createDiv({ cls: "pm-raid-dashboard__filter-row" });
    clientRow.createSpan({ cls: "pm-raid-dashboard__filter-label", text: "Clients" });
    const clientOptions = buildEntityOptions(ENTITY_TAGS.client, this.queryService);
    const clientChipSelect = new FilterChipSelect(clientRow, this.app, {
      options: clientOptions,
      selectedValues: this.filters.clientFilter,
      placeholder: "Filter by client…",
      ariaLabel: "Filter by client",
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters.clientFilter = selectedValues;
        this.debouncedSaveFilters();
        this.render();
      },
    });
    this.chipSelects.push(clientChipSelect);

    // Engagement FilterChipSelect
    const engagementRow = panel.createDiv({ cls: "pm-raid-dashboard__filter-row" });
    engagementRow.createSpan({ cls: "pm-raid-dashboard__filter-label", text: "Engagements" });
    const engagementOptions = buildEntityOptions(ENTITY_TAGS.engagement, this.queryService);
    const engagementChipSelect = new FilterChipSelect(engagementRow, this.app, {
      options: engagementOptions,
      selectedValues: this.filters.engagementFilter,
      placeholder: "Filter by engagement…",
      ariaLabel: "Filter by engagement",
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters.engagementFilter = selectedValues;
        this.debouncedSaveFilters();
        this.render();
      },
    });
    this.chipSelects.push(engagementChipSelect);

    // Search input
    const searchRow = panel.createDiv({ cls: "pm-raid-dashboard__filter-row" });
    const searchInput = searchRow.createEl("input", {
      cls: "pm-raid-dashboard__search",
      attr: { type: "text", placeholder: "Search items…", value: this.filters.searchText },
    });
    searchInput.addEventListener("input", () => {
      this.filters.searchText = searchInput.value;
      this.debouncedRefresh();
    });
  }

  // ─── Apply filters ──────────────────────────────────────────────────────

  private applyFilters(items: DataviewPage[]): DataviewPage[] {
    return items.filter((item) => {
      const raidType = String(item["raid-type"] ?? "") as RaidType;
      const status = String(item.status ?? "") as RaidStatus;
      const likelihood = String(item.likelihood ?? "") as RaidLikelihood;
      const impact = String(item.impact ?? "") as RaidImpact;

      if (this.filters.raidTypes.length > 0 && !this.filters.raidTypes.includes(raidType)) return false;
      if (this.filters.statusFilter.length > 0 && !this.filters.statusFilter.includes(status)) return false;

      if (this.filters.clientFilter.length > 0) {
        const client = normalizeToName(item.client) ?? "";
        if (!this.filters.clientFilter.some((c) => client === c)) return false;
      }
      if (this.filters.engagementFilter.length > 0) {
        const engagement = normalizeToName(item.engagement) ?? "";
        if (!this.filters.engagementFilter.some((e) => engagement === e)) return false;
      }

      if (this.filters.searchText) {
        const search = this.filters.searchText.toLowerCase();
        if (!item.file.name.toLowerCase().includes(search)) return false;
      }

      if (this.filters.matrixCell) {
        if (likelihood !== this.filters.matrixCell.likelihood) return false;
        if (impact !== this.filters.matrixCell.impact) return false;
      }

      return true;
    });
  }

  // ─── Matrix ─────────────────────────────────────────────────────────────

  private renderMatrix(container: HTMLElement, filtered: DataviewPage[]): void {
    const wrapper = container.createDiv({ cls: "raid-matrix-wrapper" });
    wrapper.createEl("h5", { cls: "raid-section-header", text: "Likelihood × Impact" });

    // Column headers (impact: Low / Medium / High)
    const grid = wrapper.createDiv({ cls: "raid-matrix" });

    // Top-left empty cell
    grid.createDiv({ cls: "raid-matrix-cell raid-matrix-cell--header" });
    // Impact column headers
    for (const impact of IMPACTS) {
      grid.createEl("div", { cls: "raid-matrix-cell raid-matrix-cell--header", text: impact });
    }

    // Matrix rows (likelihood: High / Medium / Low top to bottom)
    for (const likelihood of LIKELIHOODS) {
      // Row header (likelihood)
      grid.createEl("div", { cls: "raid-matrix-cell raid-matrix-cell--header", text: likelihood });

      // Data cells
      for (const impact of IMPACTS) {
        const cellKey = `${likelihood}-${impact}`;
        const cellClass = MATRIX_CELL_CLASS[cellKey] ?? "";
        const count = filtered.filter(
          (item) => String(item.likelihood ?? "") === likelihood && String(item.impact ?? "") === impact
        ).length;

        const isActive =
          this.filters.matrixCell?.likelihood === likelihood &&
          this.filters.matrixCell?.impact === impact;

        const cell = grid.createEl("div", {
          cls: `raid-matrix-cell ${cellClass}${isActive ? " raid-matrix-cell--selected" : ""}`,
          text: String(count),
        });

        cell.addEventListener("click", () => {
          if (isActive) {
            this.filters.matrixCell = null;
          } else {
            this.filters.matrixCell = { likelihood, impact };
          }
          this.render();
        });
      }
    }
  }

  // ─── Count strip ────────────────────────────────────────────────────────

  private renderCountStrip(container: HTMLElement, filtered: DataviewPage[]): void {
    const strip = container.createDiv({ cls: "pm-raid-dashboard__counts" });
    const counts = RAID_TYPES.map((t) => {
      const n = filtered.filter((item) => String(item["raid-type"] ?? "") === t).length;
      return `${t}s: ${n}`;
    });
    strip.textContent = counts.join(" | ");
  }

  // ─── Item groups ────────────────────────────────────────────────────────

  private renderItemGroups(container: HTMLElement, filtered: DataviewPage[]): void {
    for (const raidType of RAID_TYPES) {
      const items = filtered.filter((item) => String(item["raid-type"] ?? "") === raidType);
      if (items.length === 0) continue;

      const section = container.createDiv({ cls: "pm-raid-dashboard__section" });
      section.createEl("h4", { cls: "raid-section-header", text: `${raidType}s` });

      const table = section.createEl("table", { cls: "raid-item-table" });
      const thead = table.createEl("thead");
      const headerRow = thead.createEl("tr");
      ["Title", "Status", "L×I", "Age", "Owner"].forEach((h) => {
        headerRow.createEl("th", { text: h });
      });

      const tbody = table.createEl("tbody");
      for (const item of items) {
        this.renderItemRow(tbody, item);
      }
    }
  }

  private renderItemRow(tbody: HTMLElement, item: DataviewPage): void {
    const row = tbody.createEl("tr", { cls: "raid-item-row" });

    // Title (internal link)
    const titleCell = row.createEl("td");
    const link = titleCell.createEl("a", {
      cls: CSS_CLS.INTERNAL_LINK,
      text: item.file.name,
    });
    link.setAttribute("data-href", item.file.path);
    link.setAttribute("href", item.file.path);

    // Status badge
    const status = String(item.status ?? "");
    const statusCell = row.createEl("td");
    const statusBadge = statusCell.createEl("span", {
      cls: `raid-status-badge ${STATUS_CSS[status] ?? ""}`,
      text: status,
    });
    void statusBadge;

    // L×I coloured dot
    const likelihood = String(item.likelihood ?? "") as RaidLikelihood;
    const impact = String(item.impact ?? "") as RaidImpact;
    const lxiCell = row.createEl("td");
    const cellKey = `${likelihood}-${impact}`;
    const lxiClass = MATRIX_CELL_CLASS[cellKey] ?? "";
    lxiCell.createEl("span", {
      cls: `raid-lxi-dot ${lxiClass}`,
      text: `${likelihood.charAt(0)}×${impact.charAt(0)}`,
    });

    // Age (days since raised-date)
    const ageCell = row.createEl("td");
    const raisedRaw = item["raised-date"];
    if (raisedRaw) {
      // Dataview may return a Luxon DateTime object with a .ts millisecond timestamp
      const raisedMs =
        typeof raisedRaw === "object" && raisedRaw !== null && "ts" in raisedRaw
          ? (raisedRaw as { ts: number }).ts
          : new Date(String(raisedRaw)).getTime();
      const days = Math.floor((Date.now() - raisedMs) / 86400000);
      if (!isNaN(days)) {
        ageCell.createEl("span", { cls: "raid-age-pill", text: `${days}d` });
      }
    }

    // Owner initials avatar
    const ownerCell = row.createEl("td");
    const ownerName = normalizeToName(item.owner) ?? "";
    if (ownerName) {
      const initials = ownerName
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("");
      ownerCell.createEl("span", { cls: "raid-owner-avatar", text: initials, attr: { title: ownerName } });
    }
  }

  // ─── Debounced refresh ──────────────────────────────────────────────────

  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.render();
    }, DEBOUNCE_MS.PROPERTIES);
  }
}
