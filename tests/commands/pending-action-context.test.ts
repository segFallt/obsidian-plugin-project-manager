/**
 * Tests for the pendingActionContext mechanism — Phase D.
 *
 * Verifies that create-engagement, create-project, and create-person each:
 *  - Read and immediately clear services.pendingActionContext
 *  - Pass the context value as preselectedParent to EntityCreationModal
 *  - Fall back to undefined preselectedParent when context is absent or for a different field
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateEngagementCommand } from "../../src/commands/create-engagement";
import { registerCreateProjectCommand } from "../../src/commands/create-project";
import { registerCreatePersonCommand } from "../../src/commands/create-person";
import { createMockPlugin, runCommand } from "./helpers";

vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn().mockImplementation(() => ({
    prompt: vi.fn().mockResolvedValue({ name: "Test", parentName: null }),
  })),
}));

// Lazily resolved after mock hoisting completes
async function getMockCtor() {
  const { EntityCreationModal } = await import("../../src/ui/modals/entity-creation-modal");
  return vi.mocked(EntityCreationModal);
}

beforeEach(async () => {
  (await getMockCtor()).mockClear();
});

// ─── create-engagement ────────────────────────────────────────────────────────

describe("create-engagement: pendingActionContext", () => {
  it("passes preselectedParent when pendingActionContext.field === 'client'", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "client",
      value: "Acme Corp",
    };

    registerCreateEngagementCommand(services, addCommand);
    await runCommand(commands, "create-engagement");

    // 6th arg is preselectedParent
    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      "Acme Corp"
    );
  });

  it("clears pendingActionContext after reading it", async () => {
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "client",
      value: "Acme Corp",
    };

    registerCreateEngagementCommand(services, addCommand);
    await runCommand(commands, "create-engagement");

    expect(services.pendingActionContext).toBeNull();
  });

  it("passes undefined preselectedParent when pendingActionContext is null", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = null;

    registerCreateEngagementCommand(services, addCommand);
    await runCommand(commands, "create-engagement");

    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      undefined
    );
  });

  it("passes undefined preselectedParent when context field is for a different entity", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "engagement", // wrong field for create-engagement
      value: "Some Engagement",
    };

    registerCreateEngagementCommand(services, addCommand);
    await runCommand(commands, "create-engagement");

    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      undefined
    );
  });
});

// ─── create-project ────────────────────────────────────────────────────────────

describe("create-project: pendingActionContext", () => {
  it("passes preselectedParent when pendingActionContext.field === 'engagement'", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "engagement",
      value: "Q1 2026",
    };

    registerCreateProjectCommand(services, addCommand);
    await runCommand(commands, "create-project");

    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      "Q1 2026"
    );
  });

  it("clears pendingActionContext after reading it", async () => {
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "engagement",
      value: "Q1 2026",
    };

    registerCreateProjectCommand(services, addCommand);
    await runCommand(commands, "create-project");

    expect(services.pendingActionContext).toBeNull();
  });

  it("passes undefined preselectedParent when context field is for a different entity", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "client", // wrong field for create-project
      value: "Acme",
    };

    registerCreateProjectCommand(services, addCommand);
    await runCommand(commands, "create-project");

    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      undefined
    );
  });
});

// ─── create-person ─────────────────────────────────────────────────────────────

describe("create-person: pendingActionContext", () => {
  it("passes preselectedParent when pendingActionContext.field === 'client'", async () => {
    const MockCtor = await getMockCtor();
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "client",
      value: "Acme Corp",
    };

    registerCreatePersonCommand(services, addCommand);
    await runCommand(commands, "create-person");

    expect(MockCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.any(String),
      null,
      expect.any(Array),
      "Acme Corp"
    );
  });

  it("clears pendingActionContext after reading it", async () => {
    const { services, addCommand, commands } = createMockPlugin();
    (services as unknown as Record<string, unknown>).pendingActionContext = {
      field: "client",
      value: "Acme Corp",
    };

    registerCreatePersonCommand(services, addCommand);
    await runCommand(commands, "create-person");

    expect(services.pendingActionContext).toBeNull();
  });
});
