import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateRecurringMeetingEventCommand } from "../../src/commands/create-recurring-meeting-event";
import { createMockPlugin, runCommand, Notice } from "./helpers";

vi.mock("../../src/ui/modals/suggester-modal", () => ({
  SuggesterModal: vi.fn().mockImplementation(() => ({
    choose: vi.fn().mockResolvedValue({ file: { name: "Weekly Standup" } }),
  })),
}));

describe("registerCreateRecurringMeetingEventCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows SuggesterModal and calls createRecurringMeetingEvent with selected meeting name", async () => {
    const { services, addCommand, commands, entityService, queryService } = createMockPlugin();

    // Provide one active meeting so the modal is shown
    queryService.getActiveRecurringMeetings.mockReturnValue([
      { file: { name: "Weekly Standup" } },
    ]);

    registerCreateRecurringMeetingEventCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting-event");

    expect(entityService.createRecurringMeetingEvent).toHaveBeenCalledWith("Weekly Standup");
  });

  it("uses pendingActionContext when field is 'recurring-meeting' (skips modal)", async () => {
    const { services, addCommand, commands, entityService, queryService } = createMockPlugin();

    // Set pre-selected context (as if triggered from an action button)
    services.pendingActionContext = { field: "recurring-meeting", value: "Weekly Standup" };

    registerCreateRecurringMeetingEventCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting-event");

    // createRecurringMeetingEvent should be called with the context value
    expect(entityService.createRecurringMeetingEvent).toHaveBeenCalledWith("Weekly Standup");
    // Modal should NOT be shown — queryService not called
    expect(queryService.getActiveRecurringMeetings).not.toHaveBeenCalled();
    // Context should be cleared after use
    expect(services.pendingActionContext).toBeNull();
  });

  it("shows Notice and does NOT call createRecurringMeetingEvent when no active meetings", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const { services, addCommand, commands, entityService, queryService } = createMockPlugin();
    // No active meetings
    queryService.getActiveRecurringMeetings.mockReturnValue([]);

    registerCreateRecurringMeetingEventCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting-event");

    expect(entityService.createRecurringMeetingEvent).not.toHaveBeenCalled();
    // SuggesterModal should not have been opened
    expect(SuggesterModal).not.toHaveBeenCalled();
  });

  it("shows Notice and does NOT call createRecurringMeetingEvent when modal is cancelled (returns null)", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");
    vi.mocked(SuggesterModal).mockImplementation(
      () =>
        ({
          choose: vi.fn().mockResolvedValue(null),
        }) as unknown as InstanceType<typeof SuggesterModal>
    );

    const { services, addCommand, commands, entityService, queryService } = createMockPlugin();
    queryService.getActiveRecurringMeetings.mockReturnValue([
      { file: { name: "Weekly Standup" } },
    ]);

    registerCreateRecurringMeetingEventCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting-event");

    expect(entityService.createRecurringMeetingEvent).not.toHaveBeenCalled();
  });

  it("does not propagate error when createRecurringMeetingEvent throws", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");
    vi.mocked(SuggesterModal).mockImplementation(
      () =>
        ({
          choose: vi.fn().mockResolvedValue({ file: { name: "Weekly Standup" } }),
        }) as unknown as InstanceType<typeof SuggesterModal>
    );

    const { services, addCommand, commands, entityService, queryService } = createMockPlugin();
    queryService.getActiveRecurringMeetings.mockReturnValue([
      { file: { name: "Weekly Standup" } },
    ]);
    entityService.createRecurringMeetingEvent.mockRejectedValue(new Error("creation failed"));

    registerCreateRecurringMeetingEventCommand(services, addCommand);
    await expect(runCommand(commands, "create-recurring-meeting-event")).resolves.toBeUndefined();
  });
});
