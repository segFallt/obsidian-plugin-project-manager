import { describe, it, expect, vi } from "vitest";
import { registerCreateProjectCommand } from "../../src/commands/create-project";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "My Project", parentName: "Q1 Engagement" }),
  })),
}));

describe("registerCreateProjectCommand", () => {
  it("calls entityService.createProject with name and engagement", async () => {
    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateProjectCommand(plugin);
    await runCommand(commands, "create-project");
    expect(entityService.createProject).toHaveBeenCalledWith("My Project", "Q1 Engagement");
  });

  it("does NOT call createProject when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateProjectCommand(plugin);
    await runCommand(commands, "create-project");
    expect(entityService.createProject).not.toHaveBeenCalled();
  });

  it("shows error Notice when createProject throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Proj", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    entityService.createProject.mockRejectedValue(new Error("fail"));
    registerCreateProjectCommand(plugin);
    await expect(runCommand(commands, "create-project")).resolves.toBeUndefined();
  });
});
