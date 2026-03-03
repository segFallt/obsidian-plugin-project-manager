import { describe, it, expect, vi } from "vitest";
import { registerCreateProjectNoteCommand } from "../../src/commands/create-project-note";
import { createMockPlugin, runCommand } from "./helpers";
import { TFile } from "../mocks/obsidian-mock";

vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("Sprint Planning Notes"),
  })),
}));

describe("registerCreateProjectNoteCommand", () => {
  it("calls entityService.createProjectNote when active file has notesDirectory", async () => {
    const activeFile = new TFile("projects/Foo.md");
    const { plugin, commands, entityService } = createMockPlugin({
      activeFile,
      notesDirectory: "projects/notes/foo",
    });
    registerCreateProjectNoteCommand(plugin);
    await runCommand(commands, "create-project-note");
    expect(entityService.createProjectNote).toHaveBeenCalledWith(
      activeFile,
      "Sprint Planning Notes"
    );
  });

  it("shows Notice and does NOT call createProjectNote when no active file", async () => {
    const { plugin, commands, entityService } = createMockPlugin({ activeFile: null });
    registerCreateProjectNoteCommand(plugin);
    await runCommand(commands, "create-project-note");
    expect(entityService.createProjectNote).not.toHaveBeenCalled();
  });

  it("shows Notice when active file has no notesDirectory", async () => {
    const activeFile = new TFile("projects/Foo.md");
    const { plugin, commands, entityService, app } = createMockPlugin({ activeFile });
    // No notesDirectory in cache
    app.metadataCache.getFileCache = () => ({ frontmatter: {} });
    registerCreateProjectNoteCommand(plugin);
    await runCommand(commands, "create-project-note");
    expect(entityService.createProjectNote).not.toHaveBeenCalled();
  });

  it("does NOT call createProjectNote when modal returns null", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue(null) }) as unknown as InstanceType<typeof InputModal>);

    const activeFile = new TFile("projects/Foo.md");
    const { plugin, commands, entityService } = createMockPlugin({
      activeFile,
      notesDirectory: "projects/notes/foo",
    });
    registerCreateProjectNoteCommand(plugin);
    await runCommand(commands, "create-project-note");
    expect(entityService.createProjectNote).not.toHaveBeenCalled();
  });

  it("shows error Notice when createProjectNote throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    vi.mocked(InputModal).mockImplementation(() => ({ prompt: vi.fn().mockResolvedValue("Note") }) as unknown as InstanceType<typeof InputModal>);

    const activeFile = new TFile("projects/Foo.md");
    const { plugin, commands, entityService } = createMockPlugin({
      activeFile,
      notesDirectory: "projects/notes/foo",
    });
    entityService.createProjectNote.mockRejectedValue(new Error("fail"));
    registerCreateProjectNoteCommand(plugin);
    await expect(runCommand(commands, "create-project-note")).resolves.toBeUndefined();
  });
});
