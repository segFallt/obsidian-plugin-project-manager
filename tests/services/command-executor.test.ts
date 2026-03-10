import { describe, it, expect, vi } from "vitest";
import { CommandExecutor } from "../../src/services/command-executor";

function createMockApp(executeCommandById = vi.fn()) {
  return {
    commands: { executeCommandById },
  } as unknown as import("obsidian").App;
}

describe("CommandExecutor", () => {
  describe("executeCommandById()", () => {
    it("delegates to app.commands.executeCommandById with the given id", () => {
      const spy = vi.fn();
      const app = createMockApp(spy);
      const executor = new CommandExecutor(app);

      executor.executeCommandById("project-manager:create-client");

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("project-manager:create-client");
    });

    it("passes any command id string through unchanged", () => {
      const spy = vi.fn();
      const app = createMockApp(spy);
      const executor = new CommandExecutor(app);

      executor.executeCommandById("some-plugin:some-command");

      expect(spy).toHaveBeenCalledWith("some-plugin:some-command");
    });

    it("does not throw when the underlying command does not exist", () => {
      // Real Obsidian silently ignores unknown command ids — our executor should too.
      const noopSpy = vi.fn();
      const app = createMockApp(noopSpy);
      const executor = new CommandExecutor(app);

      expect(() => executor.executeCommandById("nonexistent:command")).not.toThrow();
    });
  });
});
