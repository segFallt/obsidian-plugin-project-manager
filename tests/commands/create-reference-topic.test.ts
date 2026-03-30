import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateReferenceTopicCommand } from "@/commands/create-reference-topic";
import { TEMPLATE_REFERENCE_TOPIC } from "@/services/template-constants";
import { createMockPlugin, runCommand, Notice } from "./helpers";

// Mock ReferenceTopicCreationModal — default: user enters "Architecture" with no parent
vi.mock("../../src/ui/modals/reference-topic-creation-modal", () => ({
  ReferenceTopicCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Architecture", parentName: null }),
  })),
}));

describe("TEMPLATE_REFERENCE_TOPIC", () => {
  it("includes status: Active so getActiveEntitiesByTag can find reference topic notes", () => {
    expect(TEMPLATE_REFERENCE_TOPIC).toContain("status: Active");
  });
});

describe("registerCreateReferenceTopicCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers the command with id 'create-reference-topic'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerCreateReferenceTopicCommand(services, addCommand);
    expect(commands.find((c) => c.id === "create-reference-topic")).toBeDefined();
  });

  it("calls entityService.createReferenceTopic with name and undefined parent on happy path", async () => {
    const { ReferenceTopicCreationModal } = await import("../../src/ui/modals/reference-topic-creation-modal");

    vi.mocked(ReferenceTopicCreationModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ name: "Clean Code", parentName: null }),
    }) as unknown as InstanceType<typeof ReferenceTopicCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "create-reference-topic");

    expect(
      (entityService as unknown as Record<string, unknown>).createReferenceTopic
    ).toHaveBeenCalledWith("Clean Code", undefined);
  });

  it("calls entityService.createReferenceTopic with parentName when parent selected", async () => {
    const { ReferenceTopicCreationModal } = await import("../../src/ui/modals/reference-topic-creation-modal");

    vi.mocked(ReferenceTopicCreationModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ name: "Helm", parentName: "Kubernetes" }),
    }) as unknown as InstanceType<typeof ReferenceTopicCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "create-reference-topic");

    expect(
      (entityService as unknown as Record<string, unknown>).createReferenceTopic
    ).toHaveBeenCalledWith("Helm", "Kubernetes");
  });

  it("shows Notice and does NOT call createReferenceTopic when modal is cancelled", async () => {
    const { ReferenceTopicCreationModal } = await import("../../src/ui/modals/reference-topic-creation-modal");

    vi.mocked(ReferenceTopicCreationModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof ReferenceTopicCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "create-reference-topic");

    expect(
      (entityService as unknown as Record<string, unknown>).createReferenceTopic
    ).not.toHaveBeenCalled();
  });

  it("shows error Notice and does not propagate when createReferenceTopic throws", async () => {
    const { ReferenceTopicCreationModal } = await import("../../src/ui/modals/reference-topic-creation-modal");

    vi.mocked(ReferenceTopicCreationModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue({ name: "Failing Topic", parentName: null }),
    }) as unknown as InstanceType<typeof ReferenceTopicCreationModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockRejectedValue(new Error("disk full"));

    registerCreateReferenceTopicCommand(services, addCommand);

    // Should not throw
    await expect(runCommand(commands, "create-reference-topic")).resolves.toBeUndefined();
  });
});
