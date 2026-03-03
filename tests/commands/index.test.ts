import { describe, it, expect } from "vitest";
import { registerAllCommands } from "../../src/commands";
import { createMockPlugin } from "./helpers";

// These mocks ensure no real modal/service code runs when commands register
vi.mock("../../src/ui/modals/input-modal", () => ({
  InputModal: vi.fn(),
}));
vi.mock("../../src/ui/modals/entity-creation-modal", () => ({
  EntityCreationModal: vi.fn(),
}));

describe("registerAllCommands", () => {
  it("registers exactly 10 commands", () => {
    const { plugin, commands } = createMockPlugin();
    registerAllCommands(plugin);
    expect(commands).toHaveLength(10);
  });

  it("registers the expected command IDs", () => {
    const { plugin, commands } = createMockPlugin();
    registerAllCommands(plugin);
    const ids = commands.map((c) => c.id);
    expect(ids).toContain("create-client");
    expect(ids).toContain("create-engagement");
    expect(ids).toContain("create-project");
    expect(ids).toContain("create-person");
    expect(ids).toContain("create-inbox");
    expect(ids).toContain("create-single-meeting");
    expect(ids).toContain("create-recurring-meeting");
    expect(ids).toContain("create-project-note");
    expect(ids).toContain("convert-inbox");
    expect(ids).toContain("scaffold-vault");
  });
});
