import { MarkdownRenderChild, MarkdownRenderer, Notice, TFile } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { RecurringEventsProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { DEBOUNCE_MS, CODEBLOCK, CSS_CLS, CSS_SELECTOR, ISO_DATETIME_INPUT_LENGTH, NOTES_MARKER, LOG_CONTEXT, MSG } from "../constants";

/**
 * Renders recurring meeting events as a tile grid.
 *
 * Place this code block in a recurring meeting note:
 * ```pm-recurring-events
 * ```
 * The parent meeting is auto-detected from the file's basename.
 */
export function registerPmRecurringEventsProcessor(
  services: RecurringEventsProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(
    CODEBLOCK.PM_RECURRING_EVENTS,
    (source, el, ctx: MarkdownPostProcessorContext) => {
      const child = new PmRecurringEventsRenderChild(el, ctx.sourcePath, services);
      ctx.addChild(child);
      void child.render();
    }
  );
}

// ─── Render child ──────────────────────────────────────────────────────────

class PmRecurringEventsRenderChild extends MarkdownRenderChild {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly sourcePath: string,
    private readonly services: RecurringEventsProcessorServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh when any vault file is modified.
    // Uses a 1 second debounce to allow Dataview to re-index before querying.
    this.registerEvent(
      this.services.app.vault.on("modify", () => {
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

  async render(): Promise<void> {
    const scrollParent = this.getScrollableParent();
    const savedScrollTop = scrollParent?.scrollTop ?? 0;

    // Pin container height to prevent collapse during the DOM swap.
    const currentHeight = this.containerEl.offsetHeight;
    if (currentHeight > 0) {
      this.containerEl.style.minHeight = `${currentHeight}px`;
    }

    const meetingName =
      this.sourcePath.split("/").pop()?.replace(/\.md$/, "") ?? "";

    const events = this.services.queryService.getRecurringMeetingEvents(meetingName);

    // Sort by date descending (newest first) using date frontmatter as string
    const sorted = [...events].sort((a, b) => {
      const dateA = String(a.date ?? "");
      const dateB = String(b.date ?? "");
      if (dateB > dateA) return 1;
      if (dateB < dateA) return -1;
      return 0;
    });

    // Build new content off-DOM to prevent incremental scroll anchoring as
    // tiles are appended one-by-one during the async renderAll loop.
    const fragment = document.createDocumentFragment();

    if (sorted.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "pm-recurring-events__empty";
      emptyDiv.textContent = "No events yet. Use the New Event button to create the first one.";
      fragment.appendChild(emptyDiv);
    } else {
      // Obsidian patches createDiv/createEl onto HTMLElement.prototype globally,
      // so they work on detached elements too.
      const grid = document.createElement("div");
      grid.className = "pm-recurring-events__grid";
      await this.renderAll(sorted, grid);
      fragment.appendChild(grid);
    }

    // Single atomic mutation — avoids the brief zero-height flash that
    // empty() + appendChild() causes between the two operations.
    this.containerEl.replaceChildren(fragment);

    // Restore scroll synchronously in the same JS frame as the DOM mutation,
    // so no painted frame occurs at the wrong scroll position.
    if (scrollParent) {
      scrollParent.scrollTop = savedScrollTop;
    }

    // Release height pin after the next paint so the container can shrink
    // naturally if the new content is shorter.
    requestAnimationFrame(() => {
      this.containerEl.style.minHeight = "";
    });
  }

  private getScrollableParent(): HTMLElement | null {
    let el: HTMLElement | null = this.containerEl.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  private async renderAll(events: DataviewPage[], grid: HTMLElement): Promise<void> {
    for (const event of events) {
      await this.renderTile(grid, event);
    }
  }

  private async renderTile(grid: HTMLElement, event: DataviewPage): Promise<void> {
    const abstractFile = this.services.app.vault.getAbstractFileByPath(event.file.path);
    if (!(abstractFile instanceof TFile)) return;

    const content = await this.services.app.vault.read(abstractFile);

    // Extract content after the first "# Notes" heading
    const notesIdx = content.indexOf(NOTES_MARKER.PREFIX);
    const notesContent =
      notesIdx >= 0
        ? content
            .slice(notesIdx + NOTES_MARKER.PREFIX.length)
            .replace(/^\s*\n/, "")
            .trim()
        : "";

    // Parse attendees from frontmatter
    const rawAttendees = event.attendees ?? [];
    const attendees = Array.isArray(rawAttendees)
      ? rawAttendees
          .map((a) => normalizeToName(a) ?? String(a))
          .filter(Boolean)
      : [];

    // Date display — truncate datetime to YYYY-MM-DDTHH:mm (16 chars)
    const rawDate = String(event.date ?? event.file.name);
    const dateDisplay = rawDate.length > ISO_DATETIME_INPUT_LENGTH ? rawDate.slice(0, ISO_DATETIME_INPUT_LENGTH) : rawDate;

    // Build tile
    const tile = grid.createDiv({ cls: "pm-recurring-events__tile" });

    // Header with internal link
    const header = tile.createDiv({ cls: "pm-recurring-events__tile-header" });
    const link = header.createEl("a", {
      cls: CSS_CLS.INTERNAL_LINK,
      text: dateDisplay,
    });
    link.setAttribute("data-href", event.file.path);
    link.setAttribute("href", event.file.path);

    // Attendees (only if present)
    if (attendees.length > 0) {
      const attendeesDiv = tile.createDiv({ cls: "pm-recurring-events__tile-attendees" });
      for (const name of attendees) {
        attendeesDiv.createEl("span", {
          cls: "pm-recurring-events__tile-attendee",
          text: name,
        });
      }
    }

    // Notes (only if non-empty)
    if (notesContent) {
      const notesDiv = tile.createDiv({ cls: "pm-recurring-events__tile-notes" });
      await MarkdownRenderer.render(
        this.services.app,
        notesContent,
        notesDiv,
        event.file.path,
        this
      );

      // Persist task-checkbox toggles back to the event note. Obsidian does not
      // wire checkbox persistence for markdown rendered inside a custom code
      // block, so we do it here (mirrors TaskListRenderer.toggleTask).
      notesDiv.addEventListener("change", (evt) => {
        const target = evt.target;
        if (
          !(target instanceof HTMLInputElement) ||
          target.type !== "checkbox" ||
          !target.classList.contains(CSS_CLS.TASK_LIST_ITEM_CHECKBOX)
        ) {
          return;
        }
        const checkboxes = Array.from(
          notesDiv.querySelectorAll<HTMLInputElement>(
            CSS_SELECTOR.TASK_LIST_CHECKBOX
          )
        );
        const checkboxIndex = checkboxes.indexOf(target);
        if (checkboxIndex < 0) return;
        void this.toggleNotesTask(event.file.path, checkboxIndex, target.checked);
      });
    }
  }

  /**
   * Persists a task-checkbox toggle from an event tile's "# Notes" section.
   *
   * The tile renders only the trimmed slice after `# Notes`, so the clicked
   * checkbox carries no source line. We re-read the note, re-derive the same
   * slice, and map the Nth rendered checkbox to the Nth task line within it —
   * a positional mapping that avoids mis-hits on duplicate task text. The
   * slice-relative index is translated to an absolute line by locating where
   * the trimmed slice begins in the full content (accounting for frontmatter,
   * the heading, and the blank lines stripped during render).
   */
  private async toggleNotesTask(
    filePath: string,
    checkboxIndex: number,
    nowCompleted: boolean
  ): Promise<void> {
    const abstractFile = this.services.app.vault.getAbstractFileByPath(filePath);
    if (!(abstractFile instanceof TFile)) return;

    try {
      const content = await this.services.app.vault.read(abstractFile);

      // Re-derive the same "# Notes" slice the tile rendered from.
      const notesIdx = content.indexOf(NOTES_MARKER.PREFIX);
      if (notesIdx < 0) return;
      const sliceRawStart = notesIdx + NOTES_MARKER.PREFIX.length;
      const notesContent = content
        .slice(sliceRawStart)
        .replace(/^\s*\n/, "")
        .trim();
      if (!notesContent) return;

      // Translate the trimmed slice's char offset to an absolute line number.
      const sliceStart = content.indexOf(notesContent, sliceRawStart);
      if (sliceStart < 0) return;
      const sliceStartLine = content.slice(0, sliceStart).split("\n").length - 1;

      // Map the Nth checkbox to the Nth task line within the slice.
      const sliceLines = notesContent.split("\n");
      const lines = content.split("\n");
      let taskCount = 0;
      for (let i = 0; i < sliceLines.length; i++) {
        if (!this.services.taskParser.parseTaskLine(sliceLines[i], filePath, i)) continue;
        if (taskCount === checkboxIndex) {
          const absLine = sliceStartLine + i;
          if (absLine >= lines.length) return;
          lines[absLine] = this.services.taskParser.toggleTaskLine(lines[absLine], nowCompleted);
          await this.services.app.vault.modify(abstractFile, lines.join("\n"));
          return;
        }
        taskCount++;
      }
    } catch (err) {
      // A rejected read/modify would otherwise become a silent unhandled
      // rejection, leaving the checkbox visually toggled but the note on disk
      // unchanged — the exact silent-loss bug this fix addresses. Surface it.
      this.services.loggerService.error(String(err), LOG_CONTEXT.RECURRING_EVENTS, err);
      new Notice(MSG.TASK_TOGGLE_FAILED);
    }
  }

  /**
   * Triggered by vault 'modify' events.
   * Uses a 1 second debounce to allow Dataview to re-index before re-querying.
   */
  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.render();
    }, DEBOUNCE_MS.TASKS);
  }
}
