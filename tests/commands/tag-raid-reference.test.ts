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

// Hoisted choose spy — reset and re-configured in each test via beforeEach / per-test setup
const chooseMock = vi.hoisted(() => vi.fn());

vi.mock("@/ui/modals/suggester-modal", () => ({
  SuggesterModal: vi.fn().mockImplementation(() => ({
    choose: chooseMock,
  })),
}));

/** Default happy-path: Risk item selected, then positive direction. */
function setupDefaultChoose() {
  chooseMock.mockReset();
  chooseMock
    .mockResolvedValueOnce({ file: { name: "Scope Creep", path: "raid/Scope Creep.md" }, "raid-type": "Risk" })
    .mockResolvedValueOnce({ label: "↑ Positive — Mitigates", direction: "positive" });
}

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
    setupDefaultChoose();
  });

  it("registers the command with id 'tag-raid-reference'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerTagRaidReferenceCommand(services, addCommand);
    expect(commands.find((c) => c.id === "tag-raid-reference")).toBeDefined();
  });

  it("appends {raid:positive}[[ItemName]] annotation to the captured line", async () => {
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
    chooseMock.mockReset();
    chooseMock
      .mockResolvedValueOnce({ file: { name: "Budget Overrun", path: "raid/Budget Overrun.md" }, "raid-type": "Issue" })
      .mockResolvedValueOnce({ label: "↓ Negative — Compounds", direction: "negative" });

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
    chooseMock.mockReset();
    chooseMock
      .mockResolvedValueOnce({ file: { name: "Vendor Choice", path: "raid/Vendor Choice.md" }, "raid-type": "Decision" })
      .mockResolvedValueOnce({ label: "· Neutral — Notes", direction: "neutral" });

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

  it("captures cursor BEFORE the first SuggesterModal is instantiated", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Scope Creep", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some text");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    const getCursorOrder = editor.getCursor.mock.invocationCallOrder[0];
    const modalOrder = vi.mocked(SuggesterModal).mock.invocationCallOrder[0];
    expect(getCursorOrder).toBeLessThan(modalOrder);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call setLine when item selection cancelled", async () => {
    chooseMock.mockReset();
    chooseMock.mockResolvedValueOnce(null); // cancel item picker — direction picker never opens

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Risk Item", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice(MSG.CANCELLED) and does NOT call setLine when direction selection cancelled", async () => {
    chooseMock.mockReset();
    chooseMock
      .mockResolvedValueOnce({ file: { name: "Scope Creep", path: "raid/Scope Creep.md" }, "raid-type": "Risk" })
      .mockResolvedValueOnce(null); // cancel direction picker

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([makePage("Scope Creep", "Risk")]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice and does NOT open modal when no active RAID items", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(vi.mocked(SuggesterModal)).not.toHaveBeenCalled();
    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith("No active RAID items found.");
  });

  it("shows Notice and does NOT open modal when file is null", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands } = createMockPlugin();

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor();
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView(null));

    expect(vi.mocked(SuggesterModal)).not.toHaveBeenCalled();
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

  it("places context-matched items first in the items list passed to SuggesterModal", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
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

    // First SuggesterModal call is the item picker — check that contextPage is first
    const capturedItems = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string } }>;
    expect(capturedItems[0]?.file.name).toBe("Client Risk");
    expect(capturedItems[1]?.file.name).toBe("General Risk");
  });

  it("displayFn prefixes context-matched items with ★", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const riskPage = makePage("General Risk", "Risk");
    const contextPage = makePage("Client Risk", "Risk", "Acme Audit");

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([riskPage, contextPage]);
    queryService.getRaidItemsForContext.mockReturnValue([contextPage]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(
      commands, "tag-raid-reference", makeMockEditor("Line"),
      makeMockView({}, { engagement: "Acme Audit" })
    );

    // Extract the displayFn passed to the first modal and call it on each item
    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const items = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string; path: string }; "raid-type": string }>;
    expect(displayFn(items[0])).toMatch(/^★/);    // contextPage is first
    expect(displayFn(items[1])).not.toMatch(/^★/); // riskPage is second
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
