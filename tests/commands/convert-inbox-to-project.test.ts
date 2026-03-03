import { describe, it, expect, vi } from "vitest";
import { registerConvertInboxCommand } from "../../src/commands/convert-inbox-to-project";
import { createMockPlugin, runCommand } from "./helpers";
import { TFile } from "../mocks/obsidian-mock";

vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("My New Project"),
  })),
}));

describe("registerConvertInboxCommand", () => {
  it("calls entityService.convertInboxToProject when active file is in inbox folder", async () => {
    const activeFile = new TFile("inbox/Some Task.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });
    registerConvertInboxCommand(services, addCommand);
    await runCommand(commands, "convert-inbox");
    expect(entityService.convertInboxToProject).toHaveBeenCalledWith(
      activeFile,
      "My New Project"
    );
  });

  it("shows Notice and does NOT call convertInboxToProject when no active file", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile: null });
    registerConvertInboxCommand(services, addCommand);
    await runCommand(commands, "convert-inbox");
    expect(entityService.convertInboxToProject).not.toHaveBeenCalled();
  });

  it("shows Notice when active file is NOT in the inbox folder", async () => {
    const activeFile = new TFile("projects/Foo.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });
    registerConvertInboxCommand(services, addCommand);
    await runCommand(commands, "convert-inbox");
    expect(entityService.convertInboxToProject).not.toHaveBeenCalled();
  });

  it("does NOT call convertInboxToProject when modal returns null", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof InputModal>);

    const activeFile = new TFile("inbox/Some Task.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });
    registerConvertInboxCommand(services, addCommand);
    await runCommand(commands, "convert-inbox");
    expect(entityService.convertInboxToProject).not.toHaveBeenCalled();
  });

  it("shows error Notice when convertInboxToProject throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue("Proj") }) as unknown as InstanceType<typeof InputModal>);

    const activeFile = new TFile("inbox/Some Task.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });
    entityService.convertInboxToProject.mockRejectedValue(new Error("fail"));
    registerConvertInboxCommand(services, addCommand);
    await expect(runCommand(commands, "convert-inbox")).resolves.toBeUndefined();
  });
});
