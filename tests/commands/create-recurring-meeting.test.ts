import { describe, it, expect, vi } from "vitest";
import { registerCreateRecurringMeetingCommand } from "../../src/commands/create-recurring-meeting";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Weekly Standup", parentName: null }),
  })),
}));

describe("registerCreateRecurringMeetingCommand", () => {
  it("calls entityService.createRecurringMeeting with name (no engagement)", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRecurringMeetingCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting");
    expect(entityService.createRecurringMeeting).toHaveBeenCalledWith("Weekly Standup", undefined);
  });

  it("does NOT call createRecurringMeeting when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRecurringMeetingCommand(services, addCommand);
    await runCommand(commands, "create-recurring-meeting");
    expect(entityService.createRecurringMeeting).not.toHaveBeenCalled();
  });

  it("shows error Notice when createRecurringMeeting throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Mtg", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createRecurringMeeting.mockRejectedValue(new Error("fail"));
    registerCreateRecurringMeetingCommand(services, addCommand);
    await expect(runCommand(commands, "create-recurring-meeting")).resolves.toBeUndefined();
  });
});
