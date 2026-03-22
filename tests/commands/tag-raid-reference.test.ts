import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTagRaidReferenceCommand } from "@/commands/tag-raid-reference";
import { createMockPlugin, runEditorCommand } from "./helpers";

// Default SuggesterModal mock: first call picks a RAID item, second picks direction
vi.mock("../../src/ui/modals/suggester-modal", () => ({
  SuggesterModal: vi.fn(),
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
function makeMockView(file: unknown = { path: "notes/meeting.md" }, frontmatter: Record<string, unknown> = {}) {
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
  });

  it("registers the command with id 'tag-raid-reference'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerTagRaidReferenceCommand(services, addCommand);
    expect(commands.find((c) => c.id === "tag-raid-reference")).toBeDefined();
  });

  it("appends {raid:positive}[[ItemName]] for a positive direction selection", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const riskPage = makePage("Scope Creep", "Risk");
    let callCount = 0;

    vi.mocked(SuggesterModal).mockImplementation((_app, items) => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) {
            // Return the labelled item wrapper that the command builds internally
            // The items array contains { page, label } objects
            const labelled = (items as Array<{ page: typeof riskPage; label: string }>);
            return Promise.resolve(labelled.find((i) => i.page === riskPage) ?? null);
          }
          // Direction: pick positive (index 0)
          const dirItems = items as Array<{ label: string; direction: string }>;
          return Promise.resolve(dirItems[0] ?? null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([riskPage]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Meeting notes here");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Meeting notes here {raid:positive}[[Scope Creep]]"
    );
  });

  it("appends {raid:negative}[[ItemName]] for a negative direction selection", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const issuePage = makePage("Budget Overrun", "Issue");
    let callCount = 0;

    vi.mocked(SuggesterModal).mockImplementation((_app, items) => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) {
            const labelled = (items as Array<{ page: typeof issuePage; label: string }>);
            return Promise.resolve(labelled.find((i) => i.page === issuePage) ?? null);
          }
          // Direction: pick negative (index 1)
          const dirItems = items as Array<{ label: string; direction: string }>;
          return Promise.resolve(dirItems[1] ?? null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([issuePage]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Action item text");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Action item text {raid:negative}[[Budget Overrun]]"
    );
  });

  it("appends {raid:neutral}[[ItemName]] for a neutral direction selection", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const decisionPage = makePage("Vendor Choice", "Decision");
    let callCount = 0;

    vi.mocked(SuggesterModal).mockImplementation((_app, items) => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) {
            const labelled = (items as Array<{ page: typeof decisionPage; label: string }>);
            return Promise.resolve(labelled.find((i) => i.page === decisionPage) ?? null);
          }
          // Direction: pick neutral (index 2)
          const dirItems = items as Array<{ label: string; direction: string }>;
          return Promise.resolve(dirItems[2] ?? null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([decisionPage]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Decision context");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(editor.setLine).toHaveBeenCalledWith(
      3,
      "Decision context {raid:neutral}[[Vendor Choice]]"
    );
  });

  it("does not modify the line when the RAID item suggester is cancelled", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(SuggesterModal).mockImplementation(() => ({
      choose: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof SuggesterModal>);

    const riskPage = makePage("Some Risk", "Risk");
    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([riskPage]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Some line");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(editor.setLine).not.toHaveBeenCalled();
  });

  it("does not modify the line when direction suggester is cancelled", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const assumptionPage = makePage("Deploy Blocker", "Assumption");
    let callCount = 0;

    vi.mocked(SuggesterModal).mockImplementation((_app, items) => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) {
            const labelled = (items as Array<{ page: typeof assumptionPage; label: string }>);
            return Promise.resolve(labelled.find((i) => i.page === assumptionPage) ?? null);
          }
          // Cancel direction selection
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([assumptionPage]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Some note");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(editor.setLine).not.toHaveBeenCalled();
  });

  it("shows Notice and does not open modal when no active RAID items", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([]);
    queryService.getRaidItemsForContext.mockReturnValue([]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Some line");
    const view = makeMockView();
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    expect(SuggesterModal).not.toHaveBeenCalled();
    expect(editor.setLine).not.toHaveBeenCalled();
  });

  it("places context-matched items first with ★ prefix in item list", async () => {
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    const riskPage = makePage("General Risk", "Risk");
    const contextPage = makePage("Client Risk", "Risk", "Acme Audit");

    let capturedItems: Array<{ label: string }> = [];
    let callCount = 0;

    vi.mocked(SuggesterModal).mockImplementation((_app, items) => {
      const call = callCount++;
      if (call === 0) {
        capturedItems = items as Array<{ label: string }>;
        return {
          choose: vi.fn().mockImplementation(() => {
            const labelled = items as Array<{ page: unknown; label: string }>;
            return Promise.resolve(labelled[0] ?? null); // Pick first (context item)
          }),
        } as unknown as InstanceType<typeof SuggesterModal>;
      }
      // Direction: cancel to avoid modifying the line
      return {
        choose: vi.fn().mockResolvedValue(null),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, queryService } = createMockPlugin();
    queryService.getActiveRaidItems.mockReturnValue([riskPage, contextPage]);
    queryService.getRaidItemsForContext.mockReturnValue([contextPage]);

    registerTagRaidReferenceCommand(services, addCommand);

    const editor = makeMockEditor("Line");
    const view = makeMockView({}, { engagement: "Acme Audit" });
    await runEditorCommand(commands, "tag-raid-reference", editor, view);

    // First item should have ★ prefix (context-matched)
    expect(capturedItems[0]?.label).toMatch(/^★/);
    // Second item should not have ★ prefix (non-context)
    expect(capturedItems[1]?.label).not.toMatch(/^★/);
  });
});
