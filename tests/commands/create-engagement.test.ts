import { describe, it, expect, vi } from "vitest";
import { registerCreateEngagementCommand } from "../../src/commands/create-engagement";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Q1 Engagement", parentName: "Acme Corp" }),
  })),
}));

describe("registerCreateEngagementCommand", () => {
  it("calls entityService.createEngagement with name and client", async () => {
    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateEngagementCommand(plugin);
    await runCommand(commands, "create-engagement");
    expect(entityService.createEngagement).toHaveBeenCalledWith("Q1 Engagement", "Acme Corp");
  });

  it("does NOT call createEngagement when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateEngagementCommand(plugin);
    await runCommand(commands, "create-engagement");
    expect(entityService.createEngagement).not.toHaveBeenCalled();
  });

  it("does NOT call createEngagement when name is empty", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateEngagementCommand(plugin);
    await runCommand(commands, "create-engagement");
    expect(entityService.createEngagement).not.toHaveBeenCalled();
  });

  it("shows error Notice when createEngagement throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Eng", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    entityService.createEngagement.mockRejectedValue(new Error("fail"));
    registerCreateEngagementCommand(plugin);
    await expect(runCommand(commands, "create-engagement")).resolves.toBeUndefined();
  });
});
