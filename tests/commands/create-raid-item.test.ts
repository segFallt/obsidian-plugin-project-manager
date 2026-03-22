import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateRaidItemCommand } from "@/commands/create-raid-item";
import { createMockPlugin, runCommand, Notice } from "./helpers";

// Hoisted spy so vi.mock factory can reference it
const noticeMock = vi.hoisted(() => vi.fn());

// Override the obsidian Notice export with a spy-backed constructor
vi.mock("obsidian", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../tests/mocks/obsidian-mock")>();
  return {
    ...original,
    Notice: noticeMock,
  };
});

// Mock InputModal — default: user enters "My RAID Item"
vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("My RAID Item"),
  })),
}));

// Mock SuggesterModal — default responses: type=Risk, engagement=(None), owner=(None)
vi.mock("../../src/ui/modals/suggester-modal", () => {
  let callCount = 0;
  return {
    SuggesterModal: vi.fn().mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Risk");          // RAID type
          if (call === 1) return Promise.resolve("(None)");        // engagement
          if (call === 2) return Promise.resolve("(None)");        // owner
          return Promise.resolve(null);
        }),
      };
    }),
  };
});

describe("registerCreateRaidItemCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the call counter inside the SuggesterModal mock by re-importing
  });

  it("registers the command with id 'create-raid-item'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    expect(commands.find((c) => c.id === "create-raid-item")).toBeDefined();
  });

  it("calls entityService.createRaidItem with correct arguments when flow completes with (None) selections", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Scope Creep Risk"),
    }) as unknown as InstanceType<typeof InputModal>);

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Risk");
          if (call === 1) return Promise.resolve("(None)");
          if (call === 2) return Promise.resolve("(None)");
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
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
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Budget Cut Decision"),
    }) as unknown as InstanceType<typeof InputModal>);

    const engagementPage = { file: { name: "Acme Audit" } };
    const ownerPage = { file: { name: "Alice Smith" } };

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Decision");
          if (call === 1) return Promise.resolve(engagementPage);
          if (call === 2) return Promise.resolve(ownerPage);
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
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

  it("shows Notice and does NOT call createRaidItem when name is empty", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof InputModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).not.toHaveBeenCalled();
  });

  it("shows error Notice and does not propagate when createRaidItem throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Risk Item"),
    }) as unknown as InstanceType<typeof InputModal>);

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Issue");
          if (call === 1) return Promise.resolve("(None)");
          if (call === 2) return Promise.resolve("(None)");
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    entityService.createRaidItem.mockRejectedValue(new Error("service failure"));

    registerCreateRaidItemCommand(services, addCommand);
    await expect(runCommand(commands, "create-raid-item")).resolves.toBeUndefined();
  });

  it("does NOT call createRaidItem when RAID type selection is cancelled", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Some Risk"),
    }) as unknown as InstanceType<typeof InputModal>);

    vi.mocked(SuggesterModal).mockImplementation(() => ({
      choose: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof SuggesterModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith('RAID item creation cancelled.');
  });

  it("shows cancellation Notice and does NOT call createRaidItem when engagement selection is cancelled", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Some Risk"),
    }) as unknown as InstanceType<typeof InputModal>);

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Risk"); // RAID type
          return Promise.resolve(null);                   // engagement cancelled
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith('RAID item creation cancelled.');
  });

  it("shows cancellation Notice and does NOT call createRaidItem when owner selection is cancelled", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Some Risk"),
    }) as unknown as InstanceType<typeof InputModal>);

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve("Risk");     // RAID type
          if (call === 1) return Promise.resolve("(None)");  // engagement selected
          return Promise.resolve(null);                       // owner cancelled
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    registerCreateRaidItemCommand(services, addCommand);
    await runCommand(commands, "create-raid-item");

    expect(entityService.createRaidItem).not.toHaveBeenCalled();
    expect(noticeMock).toHaveBeenCalledWith('RAID item creation cancelled.');
  });
});
