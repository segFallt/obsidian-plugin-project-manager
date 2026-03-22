import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateReferenceCommand, DONE_PREFIX } from "@/commands/create-reference";
import { createMockPlugin, runCommand, Notice } from "./helpers";

// Mock InputModal — default: user enters "Clean Architecture"
vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue("Clean Architecture"),
  })),
}));

/**
 * SuggesterModal call sequence for the default (happy path) test:
 *   call 0 — topic loop iteration 1: returns a topic page (Architecture)
 *   call 1 — topic loop iteration 2: returns the "Done" sentinel
 *   call 2 — client modal: returns (None)
 *   call 3 — engagement modal: returns (None)
 */
vi.mock("../../src/ui/modals/suggester-modal", () => {
  let callCount = 0;
  const topicPage = { file: { name: "Architecture" } };
  return {
    SuggesterModal: vi.fn().mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve(topicPage);        // pick a topic
          if (call === 1) return Promise.resolve(`${DONE_PREFIX} (1 selected)`); // Done sentinel
          if (call === 2) return Promise.resolve("(None)");             // client
          if (call === 3) return Promise.resolve("(None)");             // engagement
          return Promise.resolve(null);
        }),
      };
    }),
  };
});

describe("registerCreateReferenceCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers the command with id 'create-reference'", () => {
    const { services, addCommand, commands } = createMockPlugin();
    registerCreateReferenceCommand(services, addCommand);
    expect(commands.find((c) => c.id === "create-reference")).toBeDefined();
  });

  it("calls entityService.createReference with one topic and no client/engagement", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("CQRS Pattern"),
    }) as unknown as InstanceType<typeof InputModal>);

    const topicPage = { file: { name: "Architecture" } };
    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve(topicPage);           // pick topic
          if (call === 1) return Promise.resolve(`${DONE_PREFIX} (1 selected)`); // done sentinel
          if (call === 2) return Promise.resolve("(None)");             // client
          if (call === 3) return Promise.resolve("(None)");             // engagement
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    expect(
      (entityService as unknown as Record<string, unknown>).createReference
    ).toHaveBeenCalledWith("CQRS Pattern", ["[[Architecture]]"], undefined, undefined);
  });

  it("shows Notice and does NOT call createReference when name is empty", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof InputModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    expect(
      (entityService as unknown as Record<string, unknown>).createReference
    ).not.toHaveBeenCalled();
  });

  it("shows Notice when no topic is selected (user picks Done immediately)", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Some Reference"),
    }) as unknown as InstanceType<typeof InputModal>);

    // First call to SuggesterModal returns the Done sentinel (0 topics selected)
    vi.mocked(SuggesterModal).mockImplementationOnce(() => ({
      choose: vi.fn().mockResolvedValue(`${DONE_PREFIX} (0 selected)`),
    }) as unknown as InstanceType<typeof SuggesterModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    expect(
      (entityService as unknown as Record<string, unknown>).createReference
    ).not.toHaveBeenCalled();
  });

  it("pre-fills topic from actionContext when field === 'topic'", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Pre-filled Reference"),
    }) as unknown as InstanceType<typeof InputModal>);

    // After pre-fill, the loop still opens once — user picks Done immediately
    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve(`${DONE_PREFIX} (1 selected)`); // done with pre-filled
          if (call === 1) return Promise.resolve("(None)");               // client
          if (call === 2) return Promise.resolve("(None)");               // engagement
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService, actionContext } = createMockPlugin();
    actionContext.set({ field: "topic", value: "Architecture" });
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    // The pre-filled topic "[[Architecture]]" should be in the call
    const calls = vi.mocked(
      (entityService as unknown as Record<string, unknown>).createReference as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toContain("[[Architecture]]");
  });

  it("stops and does NOT call createReference when topic modal is cancelled (null returned)", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Cancelled Reference"),
    }) as unknown as InstanceType<typeof InputModal>);

    // Cancellation (null) on first topic selection
    vi.mocked(SuggesterModal).mockImplementationOnce(() => ({
      choose: vi.fn().mockResolvedValue(null),
    }) as unknown as InstanceType<typeof SuggesterModal>);

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    // Null from topic loop = break with 0 topics → shows Notice, does not call createReference
    expect(
      (entityService as unknown as Record<string, unknown>).createReference
    ).not.toHaveBeenCalled();
  });

  it("passes client and engagement when both are selected", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Full Reference"),
    }) as unknown as InstanceType<typeof InputModal>);

    const topicPage = { file: { name: "Architecture" } };
    const clientPage = { file: { name: "Acme Corp" } };
    const engagementPage = { file: { name: "Acme Audit 2025" } };

    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve(topicPage);           // pick topic
          if (call === 1) return Promise.resolve(`${DONE_PREFIX} (1 selected)`); // done sentinel
          if (call === 2) return Promise.resolve(clientPage);           // client
          if (call === 3) return Promise.resolve(engagementPage);       // engagement
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockResolvedValue({});

    registerCreateReferenceCommand(services, addCommand);
    await runCommand(commands, "create-reference");

    expect(
      (entityService as unknown as Record<string, unknown>).createReference
    ).toHaveBeenCalledWith(
      "Full Reference",
      ["[[Architecture]]"],
      "Acme Corp",
      "Acme Audit 2025"
    );
  });

  it("shows error Notice and does not propagate when createReference throws", async () => {
    const { InputModal } = await import("../../src/ui/modals/input-modal");
    const { SuggesterModal } = await import("../../src/ui/modals/suggester-modal");

    vi.mocked(InputModal).mockImplementation(() => ({
      prompt: vi.fn().mockResolvedValue("Failing Reference"),
    }) as unknown as InstanceType<typeof InputModal>);

    const topicPage = { file: { name: "Architecture" } };
    let callCount = 0;
    vi.mocked(SuggesterModal).mockImplementation(() => {
      const call = callCount++;
      return {
        choose: vi.fn().mockImplementation(() => {
          if (call === 0) return Promise.resolve(topicPage);
          if (call === 1) return Promise.resolve(`${DONE_PREFIX} (1 selected)`);
          if (call === 2) return Promise.resolve("(None)");
          if (call === 3) return Promise.resolve("(None)");
          return Promise.resolve(null);
        }),
      } as unknown as InstanceType<typeof SuggesterModal>;
    });

    const { services, addCommand, commands, entityService } = createMockPlugin();
    (entityService as unknown as Record<string, unknown>).createReference = vi
      .fn()
      .mockRejectedValue(new Error("service failure"));

    registerCreateReferenceCommand(services, addCommand);

    await expect(runCommand(commands, "create-reference")).resolves.toBeUndefined();
  });
});
