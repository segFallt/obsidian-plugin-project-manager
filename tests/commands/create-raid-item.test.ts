import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateRaidItemCommand } from "@/commands/create-raid-item";
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

// Hoisted prompt spy — default: happy path result
const promptMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    name: "Default Risk",
    raidType: "Risk",
    engagementName: undefined,
    ownerName: undefined,
  })
);

vi.mock("@/ui/modals/raid-item-creation-modal", () => ({
  RaidItemCreationModal: vi.fn().mockImplementation(() => ({
    prompt: promptMock,
  })),
}));

describe("registerCreateRaidItemCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptMock.mockResolvedValue({
      name: "Default Risk",
      raidType: "Risk",
      engagementName: undefined,
      ownerName: undefined,
    });
  });

  it("registers the command with id 'create-raid-item'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    expect(commands.find((c) => c.id === "create-raid-item")).toBeDefined();
  });

  it("fetches engagements and owners from queryService", async () => {
    const { services, addCommand, commands, queryService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith(ENTITY_TAGS.engagement);
    expect(queryService.getActiveEntitiesByTag).toHaveBeenCalledWith(ENTITY_TAGS.person);
  });

  it("calls entityService.createRaidItem with correct arguments on success", async () => {
    promptMock.mockResolvedValue({
      name: "Scope Creep Risk",
      raidType: "Risk",
      engagementName: undefined,
      ownerName: undefined,
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).toHaveBeenCalledWith(
      "Scope Creep Risk",
      "Risk",
      undefined,
      undefined
    );
  });

  it("calls createRaidItem with engagement and owner when both are selected", async () => {
    promptMock.mockResolvedValue({
      name: "Budget Cut Decision",
      raidType: "Decision",
      engagementName: "Acme Audit",
      ownerName: "Alice Smith",
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).toHaveBeenCalledWith(
      "Budget Cut Decision",
      "Decision",
      "Acme Audit",
      "Alice Smith"
    );
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createRaidItem when cancelled", async () => {
    promptMock.mockResolvedValue(null);
    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("emits a warn log when cancelled", async () => {
    promptMock.mockResolvedValue(null);
    const { services, addCommand, commands, loggerService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(loggerService.warn).toHaveBeenCalledWith(
      expect.stringContaining("cancelled"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
  });

  it("shows error Notice and does not propagate when createRaidItem throws", async () => {
    promptMock.mockResolvedValue({
      name: "Risk Item",
      raidType: "Issue",
      engagementName: undefined,
      ownerName: undefined,
    });
    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createRaidItem.mockRejectedValue(new Error("service failure"));
    registerCreateRaidItemCommand(services, addCommand);
    await expect(runCommand(commands, "create-raid-item")).resolves.toBeUndefined();
    expect(noticeMock).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });

  it("emits debug log at start and on success, no warn on success path", async () => {
    promptMock.mockResolvedValue({
      name: "New Risk",
      raidType: "Risk",
      engagementName: undefined,
      ownerName: undefined,
    });
    const { services, addCommand, commands, loggerService, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).toHaveBeenCalledWith("New Risk", "Risk", undefined, undefined);
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("command started"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("New Risk"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
    expect(loggerService.warn).not.toHaveBeenCalled();
  });
});
