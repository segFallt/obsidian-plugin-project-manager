import type { TFile } from "obsidian";
import { JS_TYPE } from "../constants";
import type { FrontmatterIO } from "./frontmatter-io";

/** Per-view persisted state (filter selections, view mode, …); opaque to the store. */
export type ViewState = Record<string, unknown>;

/**
 * Persists a dashboard's per-view state under a caller-chosen key. The key is
 * a dot-path, so a caller may persist to a flat top-level key (`pm-tasks-filters`)
 * or nest per-block state under a namespaced parent (`pm-view-state.<blockKey>`)
 * — the store is not hardwired to any one namespace.
 *
 * Two adapters satisfy this contract: {@link FrontmatterViewStore} for note-bound
 * dashboards and {@link SettingsViewStore} for the note-less References panel.
 */
export interface ViewStateStore {
  /** The state stored under `key`, or `null` when absent. */
  load(key: string): ViewState | null;
  /** Persist `state` under `key`; `null` clears it. Skips writes that change nothing. */
  save(key: string, state: ViewState | null): Promise<void>;
  /**
   * Whether a `modify` event carries this store's own just-written value. Matches
   * and consumes a single pending write-echo, so a later same-note edit still
   * refreshes; returns `false` (refresh-when-unsure) on any mismatch.
   */
  isOwnWrite(file: TFile, value: unknown): boolean;
}

// ─── Canonical serialization ─────────────────────────────────────────────────

/**
 * A stable-key-order serialization that treats empty-array / `null` / absent as
 * equivalent. Obsidian coerces an empty frontmatter array to `null` on write, so
 * a written `[]` reads back as `null`; without this normalization every cleared
 * filter would look like an external edit and churn a refresh.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map(canonicalize);
  }
  if (typeof value === JS_TYPE.OBJECT) {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      const child = canonicalize(src[key]);
      if (child !== null) out[key] = child; // drop null/[]/absent-equivalent keys
    }
    return out;
  }
  return value;
}

function canonicalSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// ─── Dot-path helpers ────────────────────────────────────────────────────────

/** Separator for the store's dot-path keys (a flat `key` or a nested `parent.child`). */
export const KEY_PATH_SEPARATOR = ".";

function splitKey(key: string): string[] {
  return key.split(KEY_PATH_SEPARATOR);
}

function getAtPath(root: Record<string, unknown> | null, segments: string[]): unknown {
  let node: unknown = root;
  for (const segment of segments) {
    if (node === null || typeof node !== JS_TYPE.OBJECT) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

/** Sets `value` at the dot-path, creating intermediate objects along the way. */
function setAtPath(root: Record<string, unknown>, segments: string[], value: ViewState): void {
  let node = root;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (next === null || typeof next !== JS_TYPE.OBJECT || Array.isArray(next)) {
      node[segment] = {};
    }
    node = node[segment] as Record<string, unknown>;
  }
  node[segments[segments.length - 1]] = value;
}

/** Deletes the leaf at the dot-path; a no-op when its parent is absent. */
function deleteAtPath(root: Record<string, unknown>, segments: string[]): void {
  const parent = getAtPath(root, segments.slice(0, -1));
  if (parent !== null && typeof parent === JS_TYPE.OBJECT) {
    delete (parent as Record<string, unknown>)[segments[segments.length - 1]];
  }
}

// ─── Per-file write serialization ────────────────────────────────────────────

/**
 * Serializes frontmatter writes per file path across every store instance. Two
 * `pm-tasks` blocks in one note each own a render child (and store), but they
 * share the note's frontmatter; unserialized concurrent `processFrontMatter`
 * calls can clobber a sibling sub-key, so all writes to a path run one at a time.
 */
const writeChains = new Map<string, Promise<void>>();

function enqueueWrite(path: string, task: () => Promise<void>): Promise<void> {
  const prev = writeChains.get(path) ?? Promise.resolve();
  const next = prev.then(task, task);
  writeChains.set(path, next);
  void next.finally(() => {
    if (writeChains.get(path) === next) writeChains.delete(path);
  });
  return next;
}

// ─── Adapters ────────────────────────────────────────────────────────────────

interface PendingEcho {
  path: string;
  canon: string;
}

/**
 * Note-bound {@link ViewStateStore} over a {@link FrontmatterIO} port. Recognises
 * its own writes by value (a one-shot pending-echo consume), skips writes that
 * change nothing, and funnels every write through the shared per-file serializer.
 */
export class FrontmatterViewStore implements ViewStateStore {
  private pending: PendingEcho | null = null;

  constructor(
    private readonly io: FrontmatterIO,
    private readonly getFile: () => TFile | null
  ) {}

  load(key: string): ViewState | null {
    const file = this.getFile();
    if (!file) return null;
    const value = getAtPath(this.io.read(file), splitKey(key));
    return value === undefined || value === null ? null : (value as ViewState);
  }

  async save(key: string, state: ViewState | null): Promise<void> {
    const file = this.getFile();
    if (!file) return;
    if (canonicalSerialize(this.load(key)) === canonicalSerialize(state)) return; // diff-before-write
    this.pending = { path: file.path, canon: canonicalSerialize(state) };
    const segments = splitKey(key);
    await enqueueWrite(file.path, () =>
      this.io.write(file, (fm) =>
        state === null ? deleteAtPath(fm, segments) : setAtPath(fm, segments, state)
      )
    );
  }

  isOwnWrite(file: TFile, value: unknown): boolean {
    const pending = this.pending;
    if (!pending || pending.path !== file.path) return false;
    if (pending.canon !== canonicalSerialize(value)) return false; // mismatched / coalesced → refresh
    this.pending = null; // consume once
    return true;
  }
}

/**
 * Note-less {@link ViewStateStore} over plugin settings, for dashboards with no
 * host note (the References side-panel). Satisfies the same contract; settings
 * writes raise no metadata-cache event, so there is no echo to suppress.
 */
export class SettingsViewStore implements ViewStateStore {
  constructor(
    private readonly getBag: () => Record<string, unknown>,
    private readonly persist: () => Promise<void>
  ) {}

  load(key: string): ViewState | null {
    const value = getAtPath(this.getBag(), splitKey(key));
    return value === undefined || value === null ? null : (value as ViewState);
  }

  async save(key: string, state: ViewState | null): Promise<void> {
    const bag = this.getBag();
    const segments = splitKey(key);
    if (canonicalSerialize(getAtPath(bag, segments)) === canonicalSerialize(state)) return;
    if (state === null) deleteAtPath(bag, segments);
    else setAtPath(bag, segments, state);
    await this.persist();
  }

  isOwnWrite(): boolean {
    return false; // settings writes trigger no vault modify event
  }
}
