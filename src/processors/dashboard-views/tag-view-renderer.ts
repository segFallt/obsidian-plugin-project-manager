import type { DataviewTask } from "../../types";
import { HTML_TAG, TAG_VIEW_LABEL, VIEW_MODE } from "../../constants";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/**
 * Renders tasks grouped by tag. Tags are sorted alphabetically.
 * Untagged tasks appear last under "📌 Untagged".
 */
export class TagViewRenderer implements IViewRenderer<DataviewTask> {
  readonly mode = VIEW_MODE.TAG;

  async render(ctx: ViewRenderContext<DataviewTask>): Promise<void> {
    const { container, items: tasks, filters: f, helpers } = ctx;
    const { sortService, taskRenderer, contextMap, mtimeMap } = helpers;

    const tagMap: Record<string, DataviewTask[]> = {};
    const untagged: DataviewTask[] = [];

    for (const task of tasks) {
      const tags = task.tags ?? [];
      if (tags.length === 0) {
        untagged.push(task);
      } else {
        for (const tag of tags) {
          if (!tagMap[tag]) tagMap[tag] = [];
          tagMap[tag].push(task);
        }
      }
    }

    for (const tag of Object.keys(tagMap).sort()) {
      container.createEl(HTML_TAG.H2, { text: tag });
      await taskRenderer.renderTaskList(container, sortService.sortTasks(tagMap[tag], f.sortBy, contextMap, mtimeMap));
    }

    if (untagged.length > 0) {
      container.createEl(HTML_TAG.H2, { text: TAG_VIEW_LABEL.UNTAGGED });
      await taskRenderer.renderTaskList(container, sortService.sortTasks(untagged, f.sortBy, contextMap, mtimeMap));
    }
  }
}
