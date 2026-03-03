import { describe, it, expect, vi } from "vitest";
import { registerCreatePersonCommand } from "../../src/commands/create-person";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Alice Smith", parentName: "Acme Corp" }),
  })),
}));

describe("registerCreatePersonCommand", () => {
  it("calls entityService.createPerson with name and client", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreatePersonCommand(services, addCommand);
    await runCommand(commands, "create-person");
    expect(entityService.createPerson).toHaveBeenCalledWith("Alice Smith", "Acme Corp");
  });

  it("does NOT call createPerson when modal returns null", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreatePersonCommand(services, addCommand);
    await runCommand(commands, "create-person");
    expect(entityService.createPerson).not.toHaveBeenCalled();
  });

  it("shows error Notice when createPerson throws", async () => {
    const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
    vi.mocked(EntityCreationModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue({ name: "Bob", parentName: null }) }) as unknown as InstanceType<typeof EntityCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createPerson.mockRejectedValue(new Error("fail"));
    registerCreatePersonCommand(services, addCommand);
    await expect(runCommand(commands, "create-person")).resolves.toBeUndefined();
  });
});
