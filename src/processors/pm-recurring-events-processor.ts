import { MarkdownRenderChild, MarkdownRenderer, TFile } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PropertyProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { DEBOUNCE_MS, CODEBLOCK, CSS_CLS, ISO_DATETIME_INPUT_LENGTH, NOTES_MARKER } from "../constants";

/**
 * Renders recurring meeting events as a tile grid.
 *
 * Place this code block in a recurring meeting note:
 * ```pm-recurring-events
 * ```
 * The parent meeting is auto-detected from the file's basename.
 */
export function registerPmRecurringEventsProcessor(
  services: PropertyProcessorServices,
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
    private readonly services: PropertyProcessorServices
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
