import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateReferenceCommand } from "@/commands/create-reference";
import { MSG, LOG_CONTEXT, ENTITY_TAGS } from "@/constants";
import { createMockPlugin, runCommand } from "./helpers";

// Hoisted spy so vi.mock factory can reference it
const noticeMock = vi.hoisted(() => vi.fn());

vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../tests/mocks/obsidian-mock")>();
  return {
    ...original,
    Notice: noticeMock,
  };
});

// Hoisted prompt spy — default: happy path with one topic, no client/engagement
const promptMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    name: "Clean Architecture",
    topics: ["[[Architecture]]"],
    clientName: undefined,
    engagementName: undefined,
  })
);

vi.mock("@/ui/modals/reference-creation-modal", () => ({
  ReferenceCreationModal: vi.fn().mockImplementation(() => ({
    prompt: promptMock,
  })),
}));

describe("registerCreateReferenceCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptMock.mockResolvedValue({
      name: "Clean Architecture",
      topics: ["[[Architecture]]"],
      clientName: undefined,
      engagementName: undefined,
    });
  });

  it("registers the command with id 'create-reference'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    expect(commands.find((c) => c.id === "create-reference")).toBeDefined();
  });

  it("queries getActiveEntitiesByTag with ENTITY_TAGS.referenceTopic, .client, and .engagement", async () => {
    const { services, addCommand, commands, queryService } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith(ENTITY_TAGS.referenceTopic);
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith(ENTITY_TAGS.client);
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith(ENTITY_TAGS.engagement);
  });

  it("calls entityService.createReference with one topic and no client/engagement", async () => {
    promptMock.mockResolvedValue({
      name: "CQRS Pattern",
      topics: ["[[Architecture]]"],
      clientName: undefined,
      engagementName: undefined,
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(entityService.createReference).toHaveBeenCalledWith(
      "CQRS Pattern",
      ["[[Architecture]]"],
      undefined,
      undefined
    );
  });

  it("passes clientName and engagementName when both are selected", async () => {
    promptMock.mockResolvedValue({
      name: "Full Reference",
      topics: ["[[Architecture]]"],
      clientName: "Acme Corp",
      engagementName: "Acme Audit 2025",
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(entityService.createReference).toHaveBeenCalledWith(
      "Full Reference",
      ["[[Architecture]]"],
      "Acme Corp",
      "Acme Audit 2025"
    );
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createReference when cancelled", async () => {
    promptMock.mockResolvedValue(null);
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(entityService.createReference).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows error Notice and does not propagate when createReference throws", async () => {
    promptMock.mockResolvedValue({
      name: "Failing Reference",
      topics: ["[[Architecture]]"],
      clientName: undefined,
      engagementName: undefined,
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createReference.mockRejectedValue(new Error("service failure"));
    registerCreateReferenceCommand(services, addCommand);
    await expect(runCommand(commands, "create-reference")).resolves.toBeUndefined();
    expect(noticeMock).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });

  it("pre-fills topic from actionContext when field === 'topic'", async () => {
    const { ReferenceCreationModal } = await import("@/ui/modals/reference-creation-modal");
    const { services, addCommand, commands, actionContext } = createMockPlugin();
    actionContext.set({ field: "topic", value: "Architecture" });
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(vi.mocked(ReferenceCreationModal)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.arrayContaining(["[[Architecture]]"]),
      undefined,
      undefined
    );
  });

  it("pre-fills client from actionContext when field === 'client'", async () => {
    const { ReferenceCreationModal } = await import("@/ui/modals/reference-creation-modal");
    const { services, addCommand, commands, actionContext } = createMockPlugin();
    actionContext.set({ field: "client", value: "Acme Corp" });
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(vi.mocked(ReferenceCreationModal)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      [],
      "Acme Corp",
      undefined
    );
  });

  it("pre-fills engagement from actionContext when field === 'engagement'", async () => {
    const { ReferenceCreationModal } = await import("@/ui/modals/reference-creation-modal");
    const { services, addCommand, commands, actionContext } = createMockPlugin();
    actionContext.set({ field: "engagement", value: "Acme Audit" });
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(vi.mocked(ReferenceCreationModal)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      [],
      undefined,
      "Acme Audit"
    );
  });

  it("emits a debug log on success", async () => {
    const { services, addCommand, commands, loggerService } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("Clean Architecture"),
      LOG_CONTEXT.CREATE_REFERENCE
    );
  });
});
