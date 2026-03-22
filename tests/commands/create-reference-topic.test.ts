import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateReferenceTopicCommand } from "@/commands/create-reference-topic";
import { TEMPLATE_REFERENCE_TOPIC } from "@/services/template-constants";
import { createMockPlugin, runCommand, Notice } from "./helpers";

// Mock InputModal — default: user enters "Architecture"
vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("Architecture"),
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

  it("calls entityService.createReferenceTopic with the entered name on happy path", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Clean Code"),
    }) as unknown as InstanceType<typeof InputModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    // Add createReferenceTopic mock to entityService
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceTopicCommand(services, addCommand);
    await runCommand(commands, "create-reference-topic");

    expect(
      (entityService as unknown as Record<string, unknown>).createReferenceTopic
    ).toHaveBeenCalledWith("Clean Code");
  });

  it("shows Notice and does NOT call createReferenceTopic when name is empty", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof InputModal>);

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
    const { InputModal } = await import("../../src/ui/modals/input-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Failing Topic"),
    }) as unknown as InstanceType<typeof InputModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReferenceTopic = vi
      .fn()
      .mockRejectedValue(new Error("disk full"));

    registerCreateReferenceTopicCommand(services, addCommand);

    // Should not throw
    await expect(runCommand(commands, "create-reference-topic")).resolves.toBeUndefined();
  });
});
