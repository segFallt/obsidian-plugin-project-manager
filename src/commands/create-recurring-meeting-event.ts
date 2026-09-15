import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage } from "../types";
import { COMMAND_NAMES, LOG_CONTEXT, CMD_ERROR_LABEL, ACTION_CTX_FIELD } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

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
    id: COMMAND_IDS.CREATE_RECURRING_MEETING_EVENT,
    name: COMMAND_NAMES.CREATE_RECURRING_MEETING_EVENT,
    callback: async () => {
      let meetingName: string | null = null;

      // Check for pre-selected parent from action button context
      const pendingCtx = services.actionContext.consume();
      if (pendingCtx?.field === ACTION_CTX_FIELD.RECURRING_MEETING) {
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

      const resolvedMeetingName = meetingName;
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RECURRING_MEETING_EVENT} invoked: "${resolvedMeetingName}"`, LOG_CONTEXT.CREATE_RECURRING_MEETING_EVENT);
      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CREATE_RECURRING_MEETING_EVENT,
        (err) => `${CMD_ERROR_LABEL.CREATE_RECURRING_MEETING_EVENT}: ${String(err)}`,
        () => services.entityService.createRecurringMeetingEvent(resolvedMeetingName)
      );
    },
  });
}
