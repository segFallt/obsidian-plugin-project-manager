import { describe, it, expect, vi } from "vitest";
import { registerConvertSingleToRecurringCommand } from "../../src/commands/convert-single-to-recurring";
import { createMockPlugin, runCommand } from "./helpers";
import { TFile } from "../mocks/obsidian-mock";

vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("Weekly Standup"),
  })),
}));

describe("registerConvertSingleToRecurringCommand", () => {
  it("converts single meeting to recurring when active file is in single meetings folder", async () => {
    const activeFile = new TFile("meetings/single/Weekly Standup.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });

    registerConvertSingleToRecurringCommand(services, addCommand);
    await runCommand(commands, "convert-single-to-recurring");

    expect(entityService.convertSingleToRecurring).toHaveBeenCalledWith(
      activeFile,
      "Weekly Standup"
    );
  });

  it("shows Notice and does NOT call convertSingleToRecurring when no active file", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin({
      activeFile: null,
    });

    registerConvertSingleToRecurringCommand(services, addCommand);
    await runCommand(commands, "convert-single-to-recurring");

    expect(entityService.convertSingleToRecurring).not.toHaveBeenCalled();
  });

  it("shows Notice when active file is NOT in the single meetings folder", async () => {
    const activeFile = new TFile("meetings/recurring/Some Meeting.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });

    registerConvertSingleToRecurringCommand(services, addCommand);
    await runCommand(commands, "convert-single-to-recurring");

    expect(entityService.convertSingleToRecurring).not.toHaveBeenCalled();
  });

  it("does NOT call convertSingleToRecurring when modal returns null (cancelled)", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(
      () =>
        ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof InputModal>
    );

    const activeFile = new TFile("meetings/single/Weekly Standup.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });

    registerConvertSingleToRecurringCommand(services, addCommand);
    await runCommand(commands, "convert-single-to-recurring");

    expect(entityService.convertSingleToRecurring).not.toHaveBeenCalled();
  });

  it("does not propagate error when convertSingleToRecurring throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(
      () =>
        ({
          prompt: vi.fn().mockResolvedValue("Weekly Standup"),
        }) as unknown as InstanceType<typeof InputModal>
    );

    const activeFile = new TFile("meetings/single/Weekly Standup.md");
    const { services, addCommand, commands, entityService } = createMockPlugin({ activeFile });
    entityService.convertSingleToRecurring.mockRejectedValue(new Error("conversion failed"));

    registerConvertSingleToRecurringCommand(services, addCommand);
    await expect(runCommand(commands, "convert-single-to-recurring")).resolves.toBeUndefined();
  });
});
