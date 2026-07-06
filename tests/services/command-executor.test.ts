import { describe, it, expect, vi } from "vitest";
import { CommandExecutor } from "../../src/services/command-executor";

function createMockApp(executeCommandById = vi.fn()) {
  return {
    commands: { executeCommandById },
  } as unknown as import("obsidian").App;
}

describe("CommandExecutor", () => {
  describe("executeCommandById()", () => {
    it("prefixes a bare command id with the injected plugin id", () => {
      // This is the real contract: a rename of the plugin (manifest.id) must
      // flow through to the dispatched command id, so bare ids are namespaced
      // at dispatch time rather than at each call site.
      const spy = vi.fn();
      const app = createMockApp(spy);
      const executor = new CommandExecutor(app, "engagement-project-manager");

      executor.executeCommandById("create-client");

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("engagement-project-manager:create-client");
    });

    it("passes a fully-qualified (colon-containing) command id through unchanged", () => {
      // Foreign/explicit ids (e.g. a user-supplied Obsidian command) must not be
      // re-prefixed — the ":" guard preserves them exactly.
      const spy = vi.fn();
      const app = createMockApp(spy);
      const executor = new CommandExecutor(app, "engagement-project-manager");

      executor.executeCommandById("workspace:split-vertical");

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith("workspace:split-vertical");
    });

    it("uses whatever plugin id is injected (drift is structurally impossible)", () => {
      const spy = vi.fn();
      const app = createMockApp(spy);
      const executor = new CommandExecutor(app, "some-other-id");

      executor.executeCommandById("scaffold-vault");

      expect(spy).toHaveBeenCalledWith("some-other-id:scaffold-vault");
    });

    it("prefixes an empty id to a bare-prefix (documents the empty boundary)", () => {
      // Empty input has no ":", so it is treated as a (degenerate) bare id and
      // prefixed, yielding a trailing colon. Call sites guard empty commandId
      // upstream (action-renderers `if (!commandId)`), so this never dispatches
      // in practice — this test pins the boundary behaviour so it can't drift.
      const spy = vi.fn();
      const executor = new CommandExecutor(createMockApp(spy), "engagement-project-manager");

      executor.executeCommandById("");

      expect(spy).toHaveBeenCalledWith("engagement-project-manager:");
    });

    it("passes a bare colon through unchanged (documents the colon-only boundary)", () => {
      // ":" already contains ":", so the foreign-id guard passes it through as-is
      // rather than prefixing it.
      const spy = vi.fn();
      const executor = new CommandExecutor(createMockApp(spy), "engagement-project-manager");

      executor.executeCommandById(":");

      expect(spy).toHaveBeenCalledWith(":");
    });

    it("does not throw when the underlying command does not exist", () => {
      // Real Obsidian silently ignores unknown command ids — our executor should too.
      const noopSpy = vi.fn();
      const app = createMockApp(noopSpy);
      const executor = new CommandExecutor(app, "engagement-project-manager");

      expect(() => executor.executeCommandById("nonexistent-command")).not.toThrow();
    });
  });
});
