import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTagRaidReferenceCommand } from "@/commands/tag-raid-reference";
import { MSG, LOG_CONTEXT } from "@/constants";
import { createMockPlugin, runEditorCommand } from "./helpers";

const noticeMock = vi.hoisted(() => vi.fn());

vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../tests/mocks/obsidian-mock")>();
  return {
    ...original,
    Notice: noticeMock,
  };
});

// Hoisted prompt spy — default: happy path with Risk item, positive direction
const promptMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ itemName: "Scope Creep", direction: "positive" })
);

vi.mock("@/ui/modals/raid-tag-modal", () => ({
  RaidTagModal: vi.fn().mockImplementation(() => ({
    prompt: promptMock,
  })),
}));

/** Builds a minimal RAID item page for use in tests. */
function makePage(name: string, raidType: string, engagement?: string) {
  return {
    file: { name, path: `raid/${name}.md` },
    "raid-type": raidType,
    engagement,
  };
}

/** Creates a minimal mock editor with spy methods. */
function makeMockEditor(lineContent = "Some existing text") {
  return {
    getCursor: vi.fn().mockReturnValue({ line: 3, ch: 10 }),
    getLine: vi.fn().mockReturnValue(lineContent),
    setLine: vi.fn(),
  };
}

/** Creates a minimal mock MarkdownView. */
function makeMockView(
  file: unknown = { path: "notes/meeting.md" },
  frontmatter: Record<string, unknown> = {}
) {
  return {
    file,
    app: {
      metadataCache: {
        getFileCache: () => ({ frontmatter }),
      },
    },
  };
}

describe("registerTagRaidReferenceCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptMock.mockResolvedValue({ itemName: "Scope Creep", direction: "positive" });
  });

  it("registers the command with id 'tag-raid-reference'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerTagRaidReferenceCommand(services, addCommand);
    expect(commands.find((c) => c.id === "tag-raid-reference")).toBeDefined();
  });

  it("appends {raid:positive}[[ItemName]] annotation to the captured line", async () => {
    promptMock.mockResolvedValue({ itemName: "Scope Creep", direction: "positive" });
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Scope Creep", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Meeting notes here");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Meeting notes here {raid:positive}[[Scope Creep]]"
    );
  });

  it("appends {raid:negative}[[ItemName]] for a negative direction", async () => {
    promptMock.mockResolvedValue({ itemName: "Budget Overrun", direction: "negative" });
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Budget Overrun", "Issue")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Action item text");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Action item text {raid:negative}[[Budget Overrun]]"
    );
  });

  it("appends {raid:neutral}[[ItemName]] for a neutral direction", async () => {
    promptMock.mockResolvedValue({ itemName: "Vendor Choice", direction: "neutral" });
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Vendor Choice", "Decision")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Decision context");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Decision context {raid:neutral}[[Vendor Choice]]"
    );
  });

  it("captures cursor BEFORE the modal opens (getCursor called before RaidTagModal instantiated)", async () => {
    const { RaidTagModal } = await import("@/ui/modals/raid-tag-modal");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Scope Creep", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some text");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    const getCursorOrder = editor.getCursor.mock.invocationCallOrder[0];
    const modalOrder = vi.mocked(RaidTagModal).mock.invocationCallOrder[0];
    expect(getCursorOrder).toBeLessThan(modalOrder);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call setLine when cancelled", async () => {
    promptMock.mockResolvedValue(null);
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Risk Item", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice and does NOT open modal when no active RAID items", async () => {
    const { RaidTagModal } = await import("@/ui/modals/raid-tag-modal");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(vi.mocked(RaidTagModal)).not.toHaveBeenCalled();
    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith("No active RAID items found.");
  });

  it("shows Notice and does NOT open modal when file is null", async () => {
    const { RaidTagModal } = await import("@/ui/modals/raid-tag-modal");
    const { services, addCommand, commands } = createMockPlugin();

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor();
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView(null));

    expect(vi.mocked(RaidTagModal)).not.toHaveBeenCalled();
    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith("No active file.");
  });

  it("shows error Notice and does not propagate when setLine throws", async () => {
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Risk Item", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some text");
    editor.setLine.mockImplementation(() => { throw new Error("editor error"); });

    await expect(
      runEditorCommand(commands, "tag-raid-reference", editor, makeMockView())
    ).resolves.toBeUndefined();

    expect(noticeMock).toHaveBeenCalledWith(expect.stringContaining("Error"));
  });

  it("places context-matched items first with ★ prefix in the labelled list", async () => {
    const { RaidTagModal } = await import("@/ui/modals/raid-tag-modal");
    const riskPage = makePage("General Risk", "Risk");
    const contextPage = makePage("Client Risk", "Risk", "Acme Audit");

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([riskPage, contextPage]);
    queryService.getRaidItemsForContext.mockReturnValue([contextPage]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Line");
    await runEditorCommand(
      commands, "tag-raid-reference", editor,
      makeMockView({}, { engagement: "Acme Audit" })
    );

    const capturedItems = vi.mocked(RaidTagModal).mock.calls[0][1] as Array<{ label: string }>;
    expect(capturedItems[0]?.label).toMatch(/^★/);
    expect(capturedItems[1]?.label).not.toMatch(/^★/);
  });

  it("emits a debug log on success", async () => {
    const { services, addCommand, commands, queryService, loggerService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Scope Creep", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor(), makeMockView());

    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("Scope Creep"),
      LOG_CONTEXT.TAG_RAID_REFERENCE
    );
  });
});
