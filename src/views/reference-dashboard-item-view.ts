import type { WorkspaceLeaf } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { buildReferenceProcessorServices } from "../plugin-context";
import { ReferenceDashboardView } from "../processors/pm-references-dashboard";
import { DashboardItemViewHost } from "../processors/dashboard-item-view-host";
import type { DashboardItemViewConfig } from "../processors/dashboard-item-view-host";
import { SettingsViewStore } from "../processors/view-state-store";
import type { ViewState } from "../processors/view-state-store";
import {
  PM_REFERENCE_DASHBOARD_VIEW_TYPE,
  REFERENCE_DASHBOARD_ICON,
  REFERENCE_DASHBOARD_STATE_KEY,
  REFERENCES_DASHBOARD_TEXT,
  CSS_CLS,
} from "../constants";
import type { SavedReferenceFilters } from "../types";

/**
 * ItemView panel for the Reference Dashboard.
 *
 * Hosts the {@link ReferenceDashboardView} component in an Obsidian leaf on the
 * generic capability spine: {@link DashboardItemViewHost} owns the
 * `onOpen`/`onClose` lifecycle and debounced persistence, and a
 * {@link SettingsViewStore} persists the durable filter subset into plugin
 * settings (`settings.ui.referenceDashboardFilters`) — no host note, so there is
 * no metadata-cache echo and the host registers no vault-modify listener.
 */
export class ReferenceDashboardItemView extends DashboardItemViewHost {
  static readonly VIEW_TYPE = PM_REFERENCE_DASHBOARD_VIEW_TYPE;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagerPlugin) {
    const store = new SettingsViewStore(
      () => plugin.settings.ui as unknown as Record<string, unknown>,
      () => plugin.saveSettings()
    );
    const stateKey = REFERENCE_DASHBOARD_STATE_KEY;

    const config: DashboardItemViewConfig = {
      store,
      stateKey,
      createView: (persist, container) => {
        const services = buildReferenceProcessorServices(plugin);
        const saved = store.load(stateKey) as SavedReferenceFilters | null;
        return new ReferenceDashboardView(
          container,
          services,
          {},
          saved,
          (filters) => persist(filters as ViewState | null)
        );
      },
    };

    super(leaf, config);
  }

  getViewType(): string {
    return ReferenceDashboardItemView.VIEW_TYPE;
  }

  getDisplayText(): string {
    return REFERENCES_DASHBOARD_TEXT.TITLE;
  }

  getIcon(): string {
    return REFERENCE_DASHBOARD_ICON;
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass(CSS_CLS.REFERENCE_DASHBOARD_VIEW);
    await super.onOpen();
  }
}
