import { describe, it, expect, beforeEach } from "vitest";
import type { TFile } from "obsidian";
import { blockStateKey, loadWithMigration } from "@/processors/pm-tasks-processor";
import type { ViewState, ViewStateStore } from "@/processors/view-state-store";
import { hashString } from "@/utils/hash-utils";
import { FM_KEY } from "@/constants";
import type { PmTasksConfig } from "@/types";

const dashboard: PmTasksConfig = { mode: "dashboard" };

/** In-memory ViewStateStore for exercising the migration/keying logic. */
class FakeStore implements ViewStateStore {
  private readonly data = new Map<string, ViewState>();
  readonly saved: Array<{ key: string; state: ViewState | null }> = [];

  seed(key: string, state: ViewState): void {
    this.data.set(key, state);
  }
  load(key: string): ViewState | null {
    return this.data.get(key) ?? null;
  }
  async save(key: string, state: ViewState | null): Promise<void> {
    this.saved.push({ key, state });
    if (state === null) this.data.delete(key);
    else this.data.set(key, state);
  }
  isOwnWrite(_file: TFile, _value: unknown): boolean {
    return false;
  }
}

describe("blockStateKey", () => {
  it("derives a per-block key by hashing the block source", () => {
    expect(blockStateKey(dashboard, "mode: dashboard")).toBe(
      `${FM_KEY.VIEW_STATE}.${hashString("mode: dashboard")}`
    );
  });

  it("separates structurally different blocks (dashboard vs by-project)", () => {
    const dash = blockStateKey({ mode: "dashboard" }, "mode: dashboard");
    const proj = blockStateKey({ mode: "by-project" }, "mode: by-project");
    expect(dash).not.toBe(proj);
  });

  it("gives byte-identical blocks the same key", () => {
    expect(blockStateKey(dashboard, "mode: dashboard")).toBe(
      blockStateKey(dashboard, "mode: dashboard")
    );
  });

  it("honours an explicit id: over the hash, disambiguating identical blocks", () => {
    expect(blockStateKey({ mode: "dashboard", id: "a" }, "mode: dashboard")).toBe(
      `${FM_KEY.VIEW_STATE}.a`
    );
    expect(blockStateKey({ mode: "dashboard", id: "a" }, "mode: dashboard")).not.toBe(
      blockStateKey({ mode: "dashboard", id: "b" }, "mode: dashboard")
    );
  });

  it("falls back to the hash for an empty or whitespace id:", () => {
    const hashed = blockStateKey({ mode: "dashboard" }, "mode: dashboard");
    expect(blockStateKey({ mode: "dashboard", id: "" }, "mode: dashboard")).toBe(hashed);
    expect(blockStateKey({ mode: "dashboard", id: "   " }, "mode: dashboard")).toBe(hashed);
  });
});

describe("loadWithMigration", () => {
  let store: FakeStore;
  beforeEach(() => {
    store = new FakeStore();
  });

  it("returns the per-block entry when present, without touching the legacy key", () => {
    const key = "pm-view-state.abc";
    store.seed(key, { viewMode: "context" });
    store.seed(FM_KEY.TASKS_FILTERS, { viewMode: "date" });

    expect(loadWithMigration(store, key)).toEqual({ viewMode: "context" });
    expect(store.saved).toHaveLength(0); // no migration write
  });

  it("copies a legacy value into the per-block key and leaves the legacy key in place", () => {
    const key = "pm-view-state.abc";
    const legacy = { viewMode: "priority", tagFilter: ["x"] };
    store.seed(FM_KEY.TASKS_FILTERS, legacy);

    expect(loadWithMigration(store, key)).toEqual(legacy); // returns the legacy value
    expect(store.saved).toEqual([{ key, state: legacy }]); // copied into the per-block key
    expect(store.load(FM_KEY.TASKS_FILTERS)).toEqual(legacy); // legacy retained (copy-not-delete)
  });

  it("returns null when neither the per-block nor the legacy key has a value", () => {
    expect(loadWithMigration(store, "pm-view-state.abc")).toBeNull();
    expect(store.saved).toHaveLength(0);
  });

  it("reports a failed migration copy through the error callback (legacy retained)", async () => {
    const legacy = { viewMode: "context" };
    const rejecting: ViewStateStore = {
      load: (key) => (key === FM_KEY.TASKS_FILTERS ? legacy : null),
      save: () => Promise.reject(new Error("write blew up")),
      isOwnWrite: () => false,
    };
    const errors: unknown[] = [];
    // Still returns the legacy value immediately for rendering.
    expect(loadWithMigration(rejecting, "pm-view-state.abc", (e) => errors.push(e))).toEqual(legacy);
    await Promise.resolve(); // let the rejected save's catch run
    expect(errors).toHaveLength(1);
  });

  it("keeps two sibling blocks independent after both migrate from the shared legacy key", () => {
    const legacy = { viewMode: "context" };
    store.seed(FM_KEY.TASKS_FILTERS, legacy);
    const keyA = blockStateKey({ mode: "dashboard" }, "mode: dashboard");
    const keyB = blockStateKey({ mode: "by-project" }, "mode: by-project");

    expect(loadWithMigration(store, keyA)).toEqual(legacy);
    expect(loadWithMigration(store, keyB)).toEqual(legacy);
    // each block now owns its own entry; a later write to one leaves the other intact
    void store.save(keyA, { viewMode: "date" });
    expect(store.load(keyA)).toEqual({ viewMode: "date" });
    expect(store.load(keyB)).toEqual(legacy);
  });
});
