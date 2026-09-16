import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTagRaidReferenceCommand } from "@/commands/tag-raid-reference";
import { MSG, LOG_CONTEXT } from "@/constants";
import { registerBuiltInEntityQueries } from "@/entity-registry";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { MockPageData } from "../mocks/dataview-mock";
import { createMockPlugin, runEditorCommand } from "./helpers";

// The command reads the RAID base set through the entity-query registry, so the
// built-in RAID query factory must be registered for tests.
registerBuiltInEntityQueries();

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

/** Builds MockPageData for a #raid item (fed to the mock Dataview the command reads). */
function raidPageData(name: string, raidType: string, engagement?: string): MockPageData {
  return {
    path: `raid/${name}.md`,
    tags: ["#raid"],
    frontmatter: {
      "raid-type": raidType,
      ...(engagement !== undefined ? { engagement } : {}),
    },
  };
}

/** Points the mock queryService.dv() at a Dataview over the given #raid pages. */
function setRaidPages(
  queryService: { dv: ReturnType<typeof vi.fn> },
  pages: MockPageData[]
): void {
  queryService.dv.mockReturnValue(createMockDataviewApi(pages));
}

/** Creates a minimal mock editor with spy methods. */
function makeMockEditor(lineContent = "Some existing text") {
  // Full document with `lineContent` at line index 3 (matches the mock cursor),
  // so the command's context-aware heading detection sees consistent content.
  const fullContent = ["", "", "", lineContent].join("\n");
  return {
    getCursor: vi.fn().mockReturnValue({ line: 3, ch: 10 }),
    getLine: vi.fn().mockReturnValue(lineContent),
    getValue: vi.fn().mockReturnValue(fullContent),
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
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

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
    setRaidPages(queryService, [raidPageData("Budget Overrun", "Issue")]);

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
    setRaidPages(queryService, [raidPageData("Vendor Choice", "Decision")]);

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
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

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
    setRaidPages(queryService, [raidPageData("Risk Item", "Risk")]);

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
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Some line");
    await runEditorCommand(commands, "tag-raid-reference", editor, makeMockView());

    expect(editor.setLine).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith(MSG.CANCELLED);
  });

  it("shows Notice and does NOT open modal when no active RAID items", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, []);

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
    setRaidPages(queryService, [raidPageData("Risk Item", "Risk")]);

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
    const { services, addCommand, commands, queryService, app } = createMockPlugin();
    app.metadataCache.getFileCache = vi.fn().mockReturnValue({ frontmatter: { engagement: "Acme Audit" } });
    setRaidPages(queryService, [
      raidPageData("General Risk", "Risk"),
      raidPageData("Client Risk", "Risk", "Acme Audit"),
    ]);

    registerTagRaidReferenceCommand(services, addCommand);
    const editor = makeMockEditor("Line");
    await runEditorCommand(
      commands, "tag-raid-reference", editor,
      makeMockView({}, { engagement: "Acme Audit" })
    );

    // First SuggesterModal call is the item picker — check that the context item is first
    const capturedItems = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string } }>;
    expect(capturedItems[0]?.file.name).toBe("Client Risk");
    expect(capturedItems[1]?.file.name).toBe("General Risk");
  });

  it("displayFn prefixes context-matched items with ★", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService, app } = createMockPlugin();
    app.metadataCache.getFileCache = vi.fn().mockReturnValue({ frontmatter: { engagement: "Acme Audit" } });
    setRaidPages(queryService, [
      raidPageData("General Risk", "Risk"),
      raidPageData("Client Risk", "Risk", "Acme Audit"),
    ]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(
      commands, "tag-raid-reference", makeMockEditor("Line"),
      makeMockView({}, { engagement: "Acme Audit" })
    );

    // Extract the displayFn passed to the first modal and call it on each item
    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const items = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string; path: string }; "raid-type": string }>;
    expect(displayFn(items[0])).toMatch(/^★/);    // context item is first
    expect(displayFn(items[1])).not.toMatch(/^★/); // general item is second
  });

  it("displayFn renders plain engagement name when engagement is a DataviewLink object", async () => {
    // Bug 1: formatRaidItem previously cast page["engagement"] as string,
    // causing DataviewLink.toString() = "[[path]]" to appear in the picker.
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const pageWithDataviewLink = {
      file: { name: "Scope Risk", path: "raid/Scope Risk.md" },
      "raid-type": "Risk",
      engagement: { path: "engagements/My Engagement.md", type: "file" },
    };
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, [
      { path: "raid/Scope Risk.md", tags: ["#raid"], frontmatter: { "raid-type": "Risk", engagement: { path: "engagements/My Engagement.md", type: "file" } } },
    ]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor("Line"), makeMockView());

    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const label = displayFn(pageWithDataviewLink);
    expect(label).toBe("[R] Scope Risk (My Engagement)");
    expect(label).not.toContain("[[");
  });

  it("displayFn renders item without suffix when engagement is absent", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const pageNoEngagement = {
      file: { name: "No Eng Risk", path: "raid/No Eng Risk.md" },
      "raid-type": "Risk",
    };
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, [raidPageData("No Eng Risk", "Risk")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor("Line"), makeMockView());

    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const label = displayFn(pageNoEngagement);
    expect(label).toBe("[R] No Eng Risk");
  });

  it("displayFn renders plain engagement name when engagement is a wikilink string", async () => {
    // Ensures [[My Engagement]] string format is also stripped correctly
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const pageWithWikilink = {
      file: { name: "Wikilink Risk", path: "raid/Wikilink Risk.md" },
      "raid-type": "Risk",
      engagement: "[[My Engagement]]",
    };
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, [raidPageData("Wikilink Risk", "Risk", "[[My Engagement]]")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor("Line"), makeMockView());

    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const label = displayFn(pageWithWikilink);
    expect(label).toBe("[R] Wikilink Risk (My Engagement)");
    expect(label).not.toContain("[[");
  });

  it("does not prefix any item with ★ when current note has no client or engagement frontmatter", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService, hierarchyService, app } = createMockPlugin();
    // Current note has no client/engagement context → no context filtering runs.
    app.metadataCache.getFileCache = vi.fn().mockReturnValue({ frontmatter: {} });
    setRaidPages(queryService, [raidPageData("Risk Alpha", "Risk"), raidPageData("Issue Beta", "Issue")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(
      commands, "tag-raid-reference", makeMockEditor("Line"),
      makeMockView({}, {})
    );

    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const items = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string; path: string }; "raid-type": string }>;
    expect(displayFn(items[0])).not.toMatch(/^★/);
    expect(displayFn(items[1])).not.toMatch(/^★/);
    // No context ⇒ the hierarchy resolver is never consulted for context matching.
    expect(hierarchyService.resolveClientName).not.toHaveBeenCalled();
    expect(hierarchyService.resolveEngagementName).not.toHaveBeenCalled();
  });

  it("does not prefix any item with ★ when frontmatter keys exist but are empty strings", async () => {
    const { SuggesterModal } = await import("@/ui/modals/suggester-modal");
    const { services, addCommand, commands, queryService, hierarchyService, app } = createMockPlugin();
    // Frontmatter keys present but both empty strings — still no meaningful context.
    app.metadataCache.getFileCache = vi.fn().mockReturnValue({ frontmatter: { client: "", engagement: "" } });
    setRaidPages(queryService, [raidPageData("Risk Alpha", "Risk"), raidPageData("Issue Beta", "Issue")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(
      commands, "tag-raid-reference", makeMockEditor("Line"),
      makeMockView({ path: "notes/meeting.md" }, { client: "", engagement: "" })
    );

    const displayFn = vi.mocked(SuggesterModal).mock.calls[0][2] as (item: unknown) => string;
    const items = vi.mocked(SuggesterModal).mock.calls[0][1] as Array<{ file: { name: string; path: string }; "raid-type": string }>;
    expect(displayFn(items[0])).not.toMatch(/^★/);
    expect(displayFn(items[1])).not.toMatch(/^★/);
    expect(hierarchyService.resolveClientName).not.toHaveBeenCalled();
    expect(hierarchyService.resolveEngagementName).not.toHaveBeenCalled();
  });

  it("shows the line-scoped success Notice for a non-heading line", async () => {
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor("Meeting notes"), makeMockView());

    expect(noticeMock).toHaveBeenCalledWith(MSG.RAID_REFERENCE_TAGGED_LINE);
  });

  it("shows the section-scoped success Notice (with heading text) for a heading line", async () => {
    const { services, addCommand, commands, queryService } = createMockPlugin();
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(
      commands, "tag-raid-reference", makeMockEditor("## Payment approach"), makeMockView()
    );

    expect(noticeMock).toHaveBeenCalledWith(MSG.RAID_REFERENCE_TAGGED_SECTION("Payment approach"));
  });

  it("emits a debug log on success", async () => {
    const { services, addCommand, commands, queryService, loggerService } = createMockPlugin();
    setRaidPages(queryService, [raidPageData("Scope Creep", "Risk")]);

    registerTagRaidReferenceCommand(services, addCommand);
    await runEditorCommand(commands, "tag-raid-reference", makeMockEditor(), makeMockView());

    expect(loggerService.debug).toHaveBeenCalledWith(
      expect.stringContaining("Scope Creep"),
      LOG_CONTEXT.TAG_RAID_REFERENCE
    );
  });
});
