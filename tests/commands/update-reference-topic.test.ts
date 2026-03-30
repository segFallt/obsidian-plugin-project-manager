import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "obsidian";
import { registerUpdateReferenceTopicCommand } from "@/commands/update-reference-topic";
import { createMockPlugin, runCommand } from "./helpers";

// Mock ReferenceTopicUpdateModal — default: selects "Helm" with parent "Kubernetes"
vi.mock("../../src/ui/modals/reference-topic-update-modal", () => ({
  ReferenceTopicUpdateModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
  })),
}));

function makeTopicPage(name: string): { file: { name: string; path: string; tags: string[] } } {
  return { file: { name, path: `reference/reference-topics/${name}.md`, tags: ["#reference-topic"] } };
}

describe("registerUpdateReferenceTopicCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers the command with id 'update-reference-topic'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerUpdateReferenceTopicCommand(services, addCommand);
    expect(commands.find((c) => c.id === "update-reference-topic")).toBeDefined();
  });

  it("shows Notice when no reference topics exist", async () => {
    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    // processFrontMatter should not be called
    expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("sets parent wikilink via processFrontMatter on happy path", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const helmPage = makeTopicPage("Helm");
    const kubePage = makeTopicPage("Kubernetes");
    const helmFile = new TFile(helmPage.file.path);

    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([helmPage, kubePage]);
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(helmFile);

    const savedFm: Record<string, unknown>[] = [];
    (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mockImplementation(
      async (_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
        const fm: Record<string, unknown> = {};
        callback(fm);
        savedFm.push(fm);
      }
    );

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
    expect(savedFm[0]["parent"]).toBe("[[Kubernetes]]");
  });

  it("clears parent field when parentName is null (None selected)", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: null }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const helmPage = makeTopicPage("Helm");
    const helmFile = new TFile(helmPage.file.path);

    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([helmPage]);
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(helmFile);

    const savedFm: Record<string, unknown>[] = [];
    (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mockImplementation(
      async (_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
        const fm: Record<string, unknown> = { parent: "[[OldParent]]" };
        callback(fm);
        savedFm.push(fm);
      }
    );

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
    expect(savedFm[0]["parent"]).toBeUndefined();
  });

  it("shows error Notice when file cannot be found", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([makeTopicPage("Helm")]);
    // vault returns null — file not found
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

    registerUpdateReferenceTopicCommand(services, addCommand);
    // Should not throw
    await expect(runCommand(commands, "update-reference-topic")).resolves.toBeUndefined();
    expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("does not call processFrontMatter when modal is cancelled", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([makeTopicPage("Helm")]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("shows error Notice and does not propagate when processFrontMatter throws", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const helmPage = makeTopicPage("Helm");
    const helmFile = new TFile(helmPage.file.path);

    const { services, addCommand, commands } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([helmPage]);
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(helmFile);
    (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("disk full"));

    registerUpdateReferenceTopicCommand(services, addCommand);
    await expect(runCommand(commands, "update-reference-topic")).resolves.toBeUndefined();
  });
});
