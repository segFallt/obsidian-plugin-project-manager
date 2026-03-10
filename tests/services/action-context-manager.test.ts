import { describe, it, expect, beforeEach } from "vitest";
import { ActionContextManager } from "../../src/services/action-context-manager";

describe("ActionContextManager", () => {
  let mgr: ActionContextManager;

  beforeEach(() => {
    mgr = new ActionContextManager();
  });

  describe("get()", () => {
    it("returns null when no context has been set", () => {
      expect(mgr.get()).toBeNull();
    });

    it("returns the context after set()", () => {
      mgr.set({ field: "engagement", value: "My Engagement" });
      expect(mgr.get()).toEqual({ field: "engagement", value: "My Engagement" });
    });

    it("does not consume the context — repeated calls return the same value", () => {
      mgr.set({ field: "client", value: "Acme" });
      expect(mgr.get()).toEqual({ field: "client", value: "Acme" });
      expect(mgr.get()).toEqual({ field: "client", value: "Acme" });
    });
  });

  describe("set()", () => {
    it("overwrites an existing context", () => {
      mgr.set({ field: "client", value: "Acme" });
      mgr.set({ field: "engagement", value: "NewEngage" });
      expect(mgr.get()).toEqual({ field: "engagement", value: "NewEngage" });
    });
  });

  describe("consume()", () => {
    it("returns null when no context is set", () => {
      expect(mgr.consume()).toBeNull();
    });

    it("returns the context and clears it", () => {
      mgr.set({ field: "project", value: "Big Project" });
      const ctx = mgr.consume();
      expect(ctx).toEqual({ field: "project", value: "Big Project" });
      expect(mgr.get()).toBeNull();
    });

    it("returns null on a second consume after the first cleared it", () => {
      mgr.set({ field: "client", value: "Foo" });
      mgr.consume();
      expect(mgr.consume()).toBeNull();
    });
  });
});
