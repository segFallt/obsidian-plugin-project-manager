import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateRaidItemCommand } from "@/commands/create-raid-item";
import { MSG, LOG_CONTEXT, ENTITY_TAGS } from "@/constants";
import { createMockPlugin, runCommand } from "./helpers";

const noticeMock = vi.hoisted(() => vi.fn());

vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../tests/mocks/obsidian-mock")>();
  return { ...original, Notice: noticeMock };
});

// InputModal.prompt() mock — returns the entered name string (or null on cancel)
const promptMock = vi.hoisted(() => vi.fn());

vi.mock("@/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({ prompt: promptMock })),
}));

// SuggesterModal.choose() mock — each call consumes the next queued value
const chooseMock = vi.hoisted(() => vi.fn());

vi.mock("@/ui/modals/suggester-modal", () => ({
  SuggesterModal: vi.fn().mockImplementation(() => ({ choose: chooseMock })),
}));

/** Default happy-path setup: name provided, Risk selected, (None) for both optional steps. */
function setupDefaultChoose() {
  promptMock.mockReset();
  chooseMock.mockReset();
  promptMock.mockResolvedValueOnce("Default Risk");
  chooseMock
    .mockResolvedValueOnce("Risk")                                  // RAID type
    .mockResolvedValueOnce({ file: { name: "(None)", path: "" } }) // engagement → (None)
    .mockResolvedValueOnce({ file: { name: "(None)", path: "" } }); // owner → (None)
}

function makePage(name: string) {
  return { file: { name, path: `people/${name}.md` } };
}

describe("registerCreateRaidItemCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultChoose();
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
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce("Scope Creep Risk");
    chooseMock
      .mockResolvedValueOnce("Risk")
      .mockResolvedValueOnce({ file: { name: "(None)", path: "" } })
      .mockResolvedValueOnce({ file: { name: "(None)", path: "" } });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).toHaveBeenCalledWith(
      "Scope Creep Risk", "Risk", undefined, undefined
    );
  });

  it("calls createRaidItem with engagement and owner when both are selected", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce("Budget Cut Decision");
    chooseMock
      .mockResolvedValueOnce("Decision")
      .mockResolvedValueOnce({ file: { name: "Acme Audit", path: "engagements/Acme Audit.md" } })
      .mockResolvedValueOnce({ file: { name: "Alice Smith", path: "people/Alice Smith.md" } });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).toHaveBeenCalledWith(
      "Budget Cut Decision", "Decision", "Acme Audit", "Alice Smith"
    );
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createRaidItem when name step cancelled", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce(null); // cancel at name step

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createRaidItem when type step cancelled", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce("My Risk");
    chooseMock.mockResolvedValueOnce(null); // cancel at type step

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createRaidItem when engagement step cancelled", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce("My Risk");
    chooseMock
      .mockResolvedValueOnce("Risk")
      .mockResolvedValueOnce(null); // cancel at engagement step

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call createRaidItem when owner step cancelled", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce("My Risk");
    chooseMock
      .mockResolvedValueOnce("Risk")
      .mockResolvedValueOnce({ file: { name: "(None)", path: "" } })
      .mockResolvedValueOnce(null); // cancel at owner step

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("emits a warn log when cancelled", async () => {
    promptMock.mockReset();
    chooseMock.mockReset();
    promptMock.mockResolvedValueOnce(null);

    const { services, addCommand, commands, loggerService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");
    expect(loggerService.warn).toHaveBeenCalledWith(
      expect.stringContaining("cancelled"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
  });

  it("shows error Notice and does not propagate when createRaidItem throws", async () => {
    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createRaidItem.mockRejectedValue(new Error("service failure"));
    registerCreateRaidItemCommand(services, addCommand);
    await expect(runCommand(commands, "create-raid-item")).resolves.toBeUndefined();
    expect(noticeMock).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });

  it("emits debug log at start and on success, no warn on success path", async () => {
    const { services, addCommand, commands, loggerService, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).toHaveBeenCalledWith("Default Risk", "Risk", undefined, undefined);
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("command started"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("Default Risk"),
      LOG_CONTEXT.CREATE_RAID_ITEM
    );
    expect(loggerService.warn).not.toHaveBeenCalled();
  });

  it("passes (None) sentinel + engagements list to the engagement SuggesterModal", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const eng = makePage("Acme Audit");

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveEntitiesByTag.mockImplementation((tag: string) => {
      if (tag === ENTITY_TAGS.engagement) return [eng];
      return [];
    });

    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    // SuggesterModal calls: [0] = type picker, [1] = engagement picker, [2] = owner picker
    const calls = vi.mocked(SuggesterModal).mock.calls;
    const engItems = calls[1][1] as Array<{ file: { name: string } }>;
    expect(engItems[0].file.name).toBe("(None)");
    expect(engItems[1].file.name).toBe("Acme Audit");
  });
});
