import { describe, it, expect, beforeEach } from "vitest";
import type { TFile } from "obsidian";
import type { FrontmatterIO } from "@/processors/frontmatter-io";
import {
  FrontmatterViewStore,
  SettingsViewStore,
  type ViewState,
} from "@/processors/view-state-store";

const file = { path: "note.md" } as unknown as TFile;

/** Recursively coerce empty arrays to null, mirroring Obsidian's frontmatter write. */
function coerceEmptyArrays(v: unknown): unknown {
  if (Array.isArray(v)) return v.length === 0 ? null : v.map(coerceEmptyArrays);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = coerceEmptyArrays(o[k]);
    return o;
  }
  return v;
}

class FakeFrontmatterIO implements FrontmatterIO {
  private readonly fm = new Map<string, Record<string, unknown>>();
  writes = 0;

  read(f: TFile): Record<string, unknown> | null {
    return this.fm.get(f.path) ?? null;
  }

  async write(f: TFile, mutate: (fm: Record<string, unknown>) => void): Promise<void> {
    this.writes++;
    const current = this.fm.get(f.path) ?? {};
    mutate(current);
    coerceEmptyArrays(current);
    this.fm.set(f.path, current);
  }

  raw(f: TFile): Record<string, unknown> | null {
    return this.read(f);
  }
}

describe("FrontmatterViewStore", () => {
  let io: FakeFrontmatterIO;
  let store: FrontmatterViewStore;

  beforeEach(() => {
    io = new FakeFrontmatterIO();
    store = new FrontmatterViewStore(io, () => file);
  });

  it("round-trips state nested under a namespaced per-block key", async () => {
    const state: ViewState = { viewMode: "context", tags: ["a", "b"] };
    await store.save("pm-view-state.blockA", state);

    expect(store.load("pm-view-state.blockA")).toEqual(state);
    expect(io.raw(file)).toEqual({ "pm-view-state": { blockA: state } });
  });

  it("round-trips state under a flat top-level key", async () => {
    const state: ViewState = { viewMode: "date" };
    await store.save("pm-tasks-filters", state);

    expect(store.load("pm-tasks-filters")).toEqual(state);
    expect(io.raw(file)).toEqual({ "pm-tasks-filters": state });
  });

  it("keeps sibling per-block entries independent under the shared parent", async () => {
    await store.save("pm-view-state.blockA", { viewMode: "context" });
    await store.save("pm-view-state.blockB", { viewMode: "priority" });

    expect(store.load("pm-view-state.blockA")).toEqual({ viewMode: "context" });
    expect(store.load("pm-view-state.blockB")).toEqual({ viewMode: "priority" });
  });

  it("returns null for an absent key and when no file resolves", async () => {
    expect(store.load("pm-view-state.missing")).toBeNull();
    const noFileStore = new FrontmatterViewStore(io, () => null);
    expect(noFileStore.load("pm-tasks-filters")).toBeNull();
    await noFileStore.save("pm-tasks-filters", { viewMode: "x" });
    expect(io.writes).toBe(0);
  });

  it("consumes its own write echo exactly once", async () => {
    const state: ViewState = { viewMode: "context" };
    await store.save("pm-view-state.blockA", state);

    expect(store.isOwnWrite(file, state)).toBe(true); // matched + consumed
    expect(store.isOwnWrite(file, state)).toBe(false); // already consumed
  });

  it("treats a later same-note edit as external (refreshes)", async () => {
    await store.save("pm-view-state.blockA", { viewMode: "context" });
    expect(store.isOwnWrite(file, { viewMode: "context" })).toBe(true);
    // subsequent edit, no pending expectation → external
    expect(store.isOwnWrite(file, { viewMode: "date" })).toBe(false);
  });

  it("refreshes when unsure: an unmatched value returns false", async () => {
    await store.save("pm-view-state.blockA", { viewMode: "context" });
    expect(store.isOwnWrite(file, { viewMode: "different" })).toBe(false);
    expect(store.isOwnWrite({ path: "other.md" } as unknown as TFile, { viewMode: "context" })).toBe(false);
  });

  it("matches its echo across Obsidian's empty-array→null coercion", async () => {
    // Written [] reads back as null; the canonical compare must still match.
    const state: ViewState = { tags: [], viewMode: "context" };
    await store.save("pm-view-state.blockA", state);

    // stored value came back with tags coerced to null…
    expect(io.raw(file)).toEqual({ "pm-view-state": { blockA: { tags: null, viewMode: "context" } } });
    // …yet the round-tripped value is recognised as the store's own write
    expect(store.isOwnWrite(file, store.load("pm-view-state.blockA"))).toBe(true);
  });

  it("skips a write that changes nothing (diff-before-write)", async () => {
    const state: ViewState = { viewMode: "context" };
    await store.save("pm-view-state.blockA", state);
    expect(io.writes).toBe(1);
    await store.save("pm-view-state.blockA", { viewMode: "context" });
    expect(io.writes).toBe(1); // unchanged → no second write
  });

  it("clears state under a key when saved null", async () => {
    await store.save("pm-tasks-filters", { viewMode: "context" });
    await store.save("pm-tasks-filters", null);
    expect(store.load("pm-tasks-filters")).toBeNull();
    expect(io.raw(file)).toEqual({});
  });

  it("serializes concurrent writes to the same note without clobbering siblings", async () => {
    await Promise.all([
      store.save("pm-view-state.blockA", { viewMode: "context" }),
      store.save("pm-view-state.blockB", { viewMode: "priority" }),
    ]);
    expect(io.raw(file)).toEqual({
      "pm-view-state": {
        blockA: { viewMode: "context" },
        blockB: { viewMode: "priority" },
      },
    });
  });
});

describe("SettingsViewStore", () => {
  it("round-trips through the same interface over a settings bag", async () => {
    let saved = 0;
    const bag: Record<string, unknown> = {};
    const store = new SettingsViewStore(
      () => bag,
      async () => {
        saved++;
      }
    );

    const state: ViewState = { viewMode: "topic", topics: ["x"] };
    await store.save("referenceDashboardFilters", state);

    expect(store.load("referenceDashboardFilters")).toEqual(state);
    expect(bag).toEqual({ referenceDashboardFilters: state });
    expect(saved).toBe(1);
  });

  it("skips a settings write that changes nothing and never suppresses events", async () => {
    let saved = 0;
    const bag: Record<string, unknown> = {};
    const store = new SettingsViewStore(
      () => bag,
      async () => {
        saved++;
      }
    );

    await store.save("k", { a: 1 });
    await store.save("k", { a: 1 });
    expect(saved).toBe(1);
    expect(store.isOwnWrite()).toBe(false);
  });
});
