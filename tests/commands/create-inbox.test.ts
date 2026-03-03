import { describe, it, expect, vi } from "vitest";
import { registerCreateInboxCommand } from "../../src/commands/create-inbox";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Fix bug", parentName: "Q1 Engagement" }),
  })),
}));

describe("registerCreateInboxCommand", () => {
  it("calls entityService.createInboxNote with name and engagement", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateInboxCommand(services, addCommand);
    await runCommand(commands, "create-inbox");
    expect(entityService.createInboxNote).toHaveBeenCalledWith("Fix bug", "Q1 Engagement");
  });

  it("does NOT call createInboxNote when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateInboxCommand(services, addCommand);
    await runCommand(commands, "create-inbox");
    expect(entityService.createInboxNote).not.toHaveBeenCalled();
  });

  it("shows error Notice when createInboxNote throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Task", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createInboxNote.mockRejectedValue(new Error("fail"));
    registerCreateInboxCommand(services, addCommand);
    await expect(runCommand(commands, "create-inbox")).resolves.toBeUndefined();
  });
});
