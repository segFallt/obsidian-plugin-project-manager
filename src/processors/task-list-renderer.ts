import { MarkdownRenderChild, MarkdownRenderer, TFile } from "obsidian";
import type { TaskProcessorServices } from "../plugin-context";
import type { DataviewTask } from "../types";
import { DUE_DATE_EMOJI, PRIORITY_EMOJI, DEFAULT_PRIORITY, ARIA_LABEL_MAX_LENGTH, CSS_CLS } from "../constants";
import { todayISO } from "../utils/date-utils";
import { cleanTaskText, extractEmojiDate, getTaskPriority } from "../utils/task-utils";

/**
 * Renders a list of tasks as interactive `<ul>` items with checkboxes, badges, and source links.
 * Task text is rendered via MarkdownRenderer so that wikilinks and external markdown links
 * are clickable rather than appearing as raw strings.
 * Also handles toggling task completion state in the vault.
 */
export class TaskListRenderer {
  constructor(
    private readonly services: TaskProcessorServices,
    private readonly component: MarkdownRenderChild
  ) {}

  async renderTaskList(container: HTMLElement, tasks: DataviewTask[]): Promise<void> {
    const ul = container.createEl("ul", { cls: `${CSS_CLS.TASK_LIST} contains-task-list` });

    for (const task of tasks) {
      const li = ul.createEl("li", { cls: "task-list-item" });

      const checkbox = li.createEl("input", {
        type: "checkbox",
        cls: "task-list-item-checkbox",
      });
      checkbox.checked = task.completed;
      const ariaPrefix = task.completed ? "Mark incomplete: " : "Mark complete: ";
      checkbox.setAttribute("aria-label", ariaPrefix + cleanTaskText(task.text).substring(0, ARIA_LABEL_MAX_LENGTH));

      checkbox.addEventListener("change", () => {
        void this.toggleTask(task, checkbox.checked);
      });

      const textSpan = li.createSpan({ cls: CSS_CLS.TASK_TEXT });
      await MarkdownRenderer.render(
        this.services.app,
        cleanTaskText(task.text),
        textSpan,
        task.link.path,
        this.component
      );

      // Due date badge
      const dueDate = extractEmojiDate(task.text, DUE_DATE_EMOJI);
      if (dueDate) {
        const badge = li.createSpan({ cls: CSS_CLS.TASK_DUE });
        badge.textContent = `📅 ${dueDate}`;
        if (dueDate < todayISO()) badge.classList.add(CSS_CLS.TASK_DUE_OVERDUE);
      }

      // Priority badge
      const priority = getTaskPriority(task);
      if (priority !== DEFAULT_PRIORITY) {
        const priorityEmoji = Object.entries(PRIORITY_EMOJI).find(([, p]) => p === priority)?.[0];
        if (priorityEmoji) {
          li.createSpan({ cls: CSS_CLS.TASK_PRIORITY, text: priorityEmoji });
        }
      }

      // Source file link — compact "link" label maximises screen real-estate
      const sourceLink = li.createEl("a", {
        cls: `${CSS_CLS.TASK_SOURCE} ${CSS_CLS.INTERNAL_LINK}`,
        href: task.link.path,
      });
      sourceLink.dataset.href = task.link.path;
      sourceLink.textContent = "link";
    }
  }

  async toggleTask(task: DataviewTask, nowCompleted: boolean): Promise<void> {
    const file = this.services.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;

    const content = await this.services.app.vault.read(file);
    const lines = content.split("\n");
    const lineIndex = task.line;

    if (lineIndex >= lines.length) return;

    const originalLine = lines[lineIndex];
    lines[lineIndex] = this.services.taskParser.toggleTaskLine(originalLine, nowCompleted);
    await this.services.app.vault.modify(file, lines.join("\n"));
  }
}
