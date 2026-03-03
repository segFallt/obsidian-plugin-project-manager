import { describe, it, expect, vi } from "vitest";
import { registerCreateSingleMeetingCommand } from "../../src/commands/create-single-meeting";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Kickoff Meeting", parentName: "My Engagement" }),
  })),
}));

describe("registerCreateSingleMeetingCommand", () => {
  it("calls entityService.createSingleMeeting with name and engagement", async () => {
    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateSingleMeetingCommand(plugin);
    await runCommand(commands, "create-single-meeting");
    expect(entityService.createSingleMeeting).toHaveBeenCalledWith("Kickoff Meeting", "My Engagement");
  });

  it("does NOT call createSingleMeeting when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateSingleMeetingCommand(plugin);
    await runCommand(commands, "create-single-meeting");
    expect(entityService.createSingleMeeting).not.toHaveBeenCalled();
  });

  it("shows error Notice when createSingleMeeting throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Mtg", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    entityService.createSingleMeeting.mockRejectedValue(new Error("fail"));
    registerCreateSingleMeetingCommand(plugin);
    await expect(runCommand(commands, "create-single-meeting")).resolves.toBeUndefined();
  });
});
