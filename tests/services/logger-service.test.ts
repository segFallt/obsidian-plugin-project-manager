import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LoggerService } from "../../src/services/logger-service";
import type { LoggingSettings } from "../../src/settings";

// ─── Mock vault adapter ───────────────────────────────────────────────────────

function createMockAdapter() {
  const written = new Map<string, string>();
  const removed: string[] = [];

  return {
    written,
    removed,
    exists: vi.fn(async (path: string) => written.has(path)),
    read: vi.fn(async (path: string) => written.get(path) ?? ""),
    write: vi.fn(async (path: string, content: string) => {
      written.set(path, content);
    }),
    remove: vi.fn(async (path: string) => {
      written.delete(path);
      removed.push(path);
    }),
    list: vi.fn(async (_path: string) => ({ files: [...written.keys()] })),
    mkdir: vi.fn(async (_path: string) => {}),
  };
}

function createMockApp(adapter: ReturnType<typeof createMockAdapter>) {
  return {
    vault: { adapter },
  };
}

function makeSettings(overrides: Partial<LoggingSettings> = {}): LoggingSettings {
  return {
    enabled: true,
    logDirectory: "utility/logs",
    minLevel: "DEBUG",
    maxRetentionDays: 30,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LoggerService", () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let app: ReturnType<typeof createMockApp>;
  let settings: LoggingSettings;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = createMockAdapter();
    app = createMockApp(adapter);
    settings = makeSettings();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Disabled logging ────────────────────────────────────────────────────

  it("produces no I/O when logging is disabled", async () => {
    settings = makeSettings({ enabled: false });
    const logger = new LoggerService(app as never, () => settings);
    logger.debug("hello");
    logger.info("world");
    logger.warn("warn");
    logger.error("err");
    await logger.flush();
    expect(adapter.write).not.toHaveBeenCalled();
    logger.destroy();
  });

  // ─── Level filtering ─────────────────────────────────────────────────────

  it("does not write entries below minLevel", async () => {
    settings = makeSettings({ minLevel: "WARN" });
    const logger = new LoggerService(app as never, () => settings);
    logger.debug("should be filtered");
    logger.info("also filtered");
    logger.warn("this passes");
    await logger.flush();
    expect(adapter.write).toHaveBeenCalledOnce();
    const written = [...adapter.written.values()][0]!;
    expect(written).toContain("[WARN]");
    expect(written).not.toContain("[DEBUG]");
    expect(written).not.toContain("[INFO]");
    logger.destroy();
  });

  it("writes entries at and above minLevel", async () => {
    settings = makeSettings({ minLevel: "INFO" });
    const logger = new LoggerService(app as never, () => settings);
    logger.info("info passes");
    logger.warn("warn passes");
    logger.error("error passes");
    await logger.flush();
    const written = [...adapter.written.values()][0]!;
    expect(written).toContain("[INFO]");
    expect(written).toContain("[WARN]");
    expect(written).toContain("[ERROR]");
    logger.destroy();
  });

  // ─── Log line format ────────────────────────────────────────────────────

  it("formats log lines as [ISO timestamp] [LEVEL] [context] message", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("test message", "TestContext");
    await logger.flush();
    const written = [...adapter.written.values()][0]!;
    // ISO timestamp pattern: YYYY-MM-DDTHH:mm:ss...
    expect(written).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(written).toContain("[INFO]");
    expect(written).toContain("[TestContext]");
    expect(written).toContain("test message");
    logger.destroy();
  });

  it("formats log lines without context brackets when context is omitted", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("no context message");
    await logger.flush();
    const written = [...adapter.written.values()][0]!;
    expect(written).toContain("[INFO]");
    expect(written).toContain("no context message");
    // Should not have a second pair of brackets for context
    expect(written).not.toMatch(/\[INFO\] \[/);
    logger.destroy();
  });

  it("appends error details when err is provided", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.error("something broke", "Ctx", new Error("oops"));
    await logger.flush();
    const written = [...adapter.written.values()][0]!;
    expect(written).toContain("[ERROR]");
    expect(written).toContain("something broke");
    expect(written).toContain("oops");
    logger.destroy();
  });

  // ─── File naming ────────────────────────────────────────────────────────

  it("writes to a file named YYYY-MM-DD-pm.log in the configured directory", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("file naming test");
    await logger.flush();
    const keys = [...adapter.written.keys()];
    expect(keys.some((k) => k.startsWith("utility/logs/"))).toBe(true);
    expect(keys.some((k) => k.endsWith("-pm.log"))).toBe(true);
    // The date portion should be YYYY-MM-DD
    const logKey = keys.find((k) => k.endsWith("-pm.log"))!;
    const fileName = logKey.split("/").pop()!;
    expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}-pm\.log$/);
    logger.destroy();
  });

  // ─── Buffer & flush ─────────────────────────────────────────────────────

  it("buffers entries and writes them all on flush()", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("entry one");
    logger.info("entry two");
    logger.info("entry three");
    // Not yet written
    expect(adapter.write).not.toHaveBeenCalled();
    await logger.flush();
    expect(adapter.write).toHaveBeenCalled();
    const written = [...adapter.written.values()][0]!;
    expect(written).toContain("entry one");
    expect(written).toContain("entry two");
    expect(written).toContain("entry three");
    logger.destroy();
  });

  it("flush() on empty buffer does nothing", async () => {
    const logger = new LoggerService(app as never, () => settings);
    await logger.flush();
    expect(adapter.write).not.toHaveBeenCalled();
    logger.destroy();
  });

  it("flushes automatically via setInterval", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("auto-flush test");
    expect(adapter.write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(adapter.write).toHaveBeenCalled();
    logger.destroy();
  });

  it("destroy() stops the flush interval", async () => {
    const logger = new LoggerService(app as never, () => settings);
    logger.info("before destroy");
    logger.destroy();
    await vi.advanceTimersByTimeAsync(10000);
    // Interval stopped, so no auto-flush occurred
    expect(adapter.write).not.toHaveBeenCalled();
  });

  // ─── cleanOldLogs ───────────────────────────────────────────────────────

  it("cleanOldLogs() deletes files older than maxRetentionDays", async () => {
    // Pre-populate adapter with old and recent log files
    const oldDate = "2020-01-01";
    const recentDate = "2030-12-31";
    adapter.written.set(`utility/logs/${oldDate}-pm.log`, "old content");
    adapter.written.set(`utility/logs/${recentDate}-pm.log`, "recent content");
    adapter.list.mockResolvedValueOnce({
      files: [
        `utility/logs/${oldDate}-pm.log`,
        `utility/logs/${recentDate}-pm.log`,
      ],
    });

    settings = makeSettings({ maxRetentionDays: 30 });
    const logger = new LoggerService(app as never, () => settings);
    await logger.cleanOldLogs();

    expect(adapter.removed).toContain(`utility/logs/${oldDate}-pm.log`);
    expect(adapter.removed).not.toContain(`utility/logs/${recentDate}-pm.log`);
    logger.destroy();
  });

  it("cleanOldLogs() keeps all files when maxRetentionDays is 0", async () => {
    const oldDate = "2020-01-01";
    adapter.written.set(`utility/logs/${oldDate}-pm.log`, "content");
    adapter.list.mockResolvedValueOnce({ files: [`utility/logs/${oldDate}-pm.log`] });

    settings = makeSettings({ maxRetentionDays: 0 });
    const logger = new LoggerService(app as never, () => settings);
    await logger.cleanOldLogs();

    expect(adapter.removed).toHaveLength(0);
    logger.destroy();
  });

  it("cleanOldLogs() is a no-op when logging is disabled", async () => {
    adapter.written.set("utility/logs/2020-01-01-pm.log", "content");
    settings = makeSettings({ enabled: false, maxRetentionDays: 30 });
    const logger = new LoggerService(app as never, () => settings);
    await logger.cleanOldLogs();
    expect(adapter.list).not.toHaveBeenCalled();
    logger.destroy();
  });

  it("cleanOldLogs() skips non-log files in directory", async () => {
    adapter.written.set("utility/logs/notes.md", "content");
    adapter.list.mockResolvedValueOnce({ files: ["utility/logs/notes.md"] });
    settings = makeSettings({ maxRetentionDays: 30 });
    const logger = new LoggerService(app as never, () => settings);
    await logger.cleanOldLogs();
    expect(adapter.removed).toHaveLength(0);
    logger.destroy();
  });
});
