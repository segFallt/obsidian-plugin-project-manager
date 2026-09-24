import type { WorkspaceLeaf } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { buildSearchViewServices } from "../plugin-context";
import { PmSearchView } from "./pm-search-view";
import { DashboardItemViewHost } from "../processors/dashboard-item-view-host";
import type { DashboardItemViewConfig } from "../processors/dashboard-item-view-host";
import { SettingsViewStore } from "../processors/view-state-store";
import {
  PM_SEARCH_VIEW_TYPE,
  PM_SEARCH_ICON,
  PM_SEARCH_STATE_KEY,
  PM_SEARCH_TEXT,
} from "../constants";

/**
 * ItemView panel for pm-search.
 *
 * Hosts the {@link PmSearchView} shell in an Obsidian leaf on the generic
 * capability spine: {@link DashboardItemViewHost} owns the `onOpen`/`onClose`
 * lifecycle, and a {@link SettingsViewStore} backs the panel's view state in
 * plugin settings — no host note, so there is no metadata-cache echo and the
 * host registers no vault-modify listener.
 *
 * The view-identity getters return module constants only. Since Obsidian 1.7.2
 * the {@link import("obsidian").ItemView} base constructor calls
 * `getViewType()` while `super()` runs, before any subclass field is assigned,
 * so the getters must read no post-`super()` state.
 */
export class PmSearchItemView extends DashboardItemViewHost {
  static readonly VIEW_TYPE = PM_SEARCH_VIEW_TYPE;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagerPlugin) {
    const store = new SettingsViewStore(
      () => plugin.settings.ui as unknown as Record<string, unknown>,
      () => plugin.saveSettings()
    );

    const config: DashboardItemViewConfig = {
      store,
      stateKey: PM_SEARCH_STATE_KEY,
      createView: (_persist, container) =>
        new PmSearchView(container, buildSearchViewServices(plugin)),
    };

    super(leaf, config);
  }

  getViewType(): string {
    return PmSearchItemView.VIEW_TYPE;
  }

  getDisplayText(): string {
    return PM_SEARCH_TEXT.TITLE;
  }

  getIcon(): string {
    return PM_SEARCH_ICON;
  }
}
