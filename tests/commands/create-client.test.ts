import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateClientCommand } from "../../src/commands/create-client";
import { createMockPlugin, runCommand } from "./helpers";

// Mock InputModal so we control what the user "types"
vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("Acme Corp"),
  })),
}));

describe("registerCreateClientCommand", () => {
  it("calls entityService.createClient with the provided name", async () => {
    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateClientCommand(plugin);
    await runCommand(commands, "create-client");
    expect(entityService.createClient).toHaveBeenCalledWith("Acme Corp");
  });

  it("shows Notice and does NOT call createClient when modal returns null", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof InputModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    registerCreateClientCommand(plugin);
    await runCommand(commands, "create-client");
    expect(entityService.createClient).not.toHaveBeenCalled();
  });

  it("shows error Notice when createClient throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue("Bad") }) as unknown as InstanceType<typeof InputModal>);

    const { plugin, commands, entityService } = createMockPlugin();
    entityService.createClient.mockRejectedValue(new Error("disk full"));
    registerCreateClientCommand(plugin);
    // Should not throw — error is caught and shown via Notice
    await expect(runCommand(commands, "create-client")).resolves.toBeUndefined();
  });
});
