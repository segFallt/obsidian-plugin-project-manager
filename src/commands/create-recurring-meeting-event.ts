import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage } from "../types";

/**
 * PM: Create Recurring Meeting Event
 *
 * When triggered from an action button (pendingActionContext.field === "recurring-meeting"):
 *   - Uses the pre-selected parent from context, no modal shown
 * When triggered from command palette:
 *   - Shows a SuggesterModal to pick the parent recurring meeting
 */
export function registerCreateRecurringMeetingEventCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: "create-recurring-meeting-event",
    name: "PM: Create Recurring Meeting Event",
    callback: async () => {
      let meetingName: string | null = null;

      // Check for pre-selected parent from action button context
      const pendingCtx = services.actionContext.consume();
      if (pendingCtx?.field === "recurring-meeting") {
        meetingName = pendingCtx.value;
      }

      // If no pre-selected parent, show suggester modal
      if (!meetingName) {
        const meetings = services.queryService.getActiveRecurringMeetings();
        if (meetings.length === 0) {
          new Notice("No active recurring meetings found. Create a recurring meeting first.");
          return;
        }
        const modal = new SuggesterModal<DataviewPage>(
          services.app,
          meetings,
          (page) => page.file.name
        );
        const selected = await modal.choose();
        if (!selected) {
          new Notice("No meeting selected.");
          return;
        }
        meetingName = selected.file.name;
      }

      try {
        await services.entityService.createRecurringMeetingEvent(meetingName);
      } catch (err) {
        services.loggerService.error(String(err), "create-recurring-meeting-event", err);
        new Notice(`Error creating event: ${String(err)}`);
      }
    },
  });
}
