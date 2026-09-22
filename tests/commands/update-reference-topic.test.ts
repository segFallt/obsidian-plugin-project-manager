import { describe, it, expect, vi, beforeEach } from "vitest";
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

  it("shows Notice and does not call the service when no reference topics exist", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(entityService.setReferenceTopicParent).not.toHaveBeenCalled();
  });

  it("delegates to entityService.setReferenceTopicParent with the chosen parent", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
      makeTopicPage("Helm"),
      makeTopicPage("Kubernetes"),
    ]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(entityService.setReferenceTopicParent).toHaveBeenCalledWith("Helm", "Kubernetes");
    // Command performs no direct vault mutation.
    expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    expect(services.app.vault.getAbstractFileByPath).not.toHaveBeenCalled();
  });

  it("delegates with undefined parent when None is selected (clearing)", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: null }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([makeTopicPage("Helm")]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(entityService.setReferenceTopicParent).toHaveBeenCalledWith("Helm", undefined);
    expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("shows error Notice and does not propagate when the service rejects", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ topicName: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([makeTopicPage("Helm")]);
    entityService.setReferenceTopicParent.mockRejectedValue(new Error("disk full"));

    registerUpdateReferenceTopicCommand(services, addCommand);
    await expect(runCommand(commands, "update-reference-topic")).resolves.toBeUndefined();
    expect(services.loggerService.error).toHaveBeenCalled();
  });

  it("does not call the service when modal is cancelled", async () => {
    const { ReferenceTopicUpdateModal } = await import("../../src/ui/modals/reference-topic-update-modal");

    vi.mocked(ReferenceTopicUpdateModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof ReferenceTopicUpdateModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (services.queryService.getEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([makeTopicPage("Helm")]);

    registerUpdateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "update-reference-topic");

    expect(entityService.setReferenceTopicParent).not.toHaveBeenCalled();
  });
});
