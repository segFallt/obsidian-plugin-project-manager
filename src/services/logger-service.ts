import type { App } from "obsidian";
import type { LoggingSettings } from "../settings";
import type { ILoggerService } from "./interfaces";
import { LOG_LEVELS, LOG_FLUSH_INTERVAL_MS, LOG_FILE_SUFFIX, ISO_DATE_LENGTH } from "../constants";

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
}

/**
 * Writes timestamped log entries to vault files.
 *
 * Buffers entries in memory and flushes to disk every LOG_FLUSH_INTERVAL_MS ms
 * or on an explicit flush() call. All methods are no-ops when logging is disabled.
 * File names follow the pattern: YYYY-MM-DD-pm.log in the configured directory.
 */
export class LoggerService implements ILoggerService {
  private buffer: LogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => LoggingSettings
  ) {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, LOG_FLUSH_INTERVAL_MS);
  }

  // ─── Public log methods ───────────────────────────────────────────────────

  debug(message: string, context = ""): void {
    this.log("DEBUG", message, context);
  }

  info(message: string, context = ""): void {
    this.log("INFO", message, context);
  }

  warn(message: string, context = ""): void {
    this.log("WARN", message, context);
  }

  error(message: string, context = "", err?: unknown): void {
    const suffix = err instanceof Error ? ` — ${err.message}` : err != null ? ` — ${String(err)}` : "";
    this.log("ERROR", message + suffix, context);
  }

  // ─── Flush & cleanup ──────────────────────────────────────────────────────

  async flush(): Promise<void> {
    const settings = this.getSettings();
    if (!settings.enabled || this.buffer.length === 0) {
      return;
    }

    const entries = this.buffer.splice(0);
    const byDate = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const date = entry.timestamp.substring(0, ISO_DATE_LENGTH); // YYYY-MM-DD
      const bucket = byDate.get(date) ?? [];
      bucket.push(entry);
      byDate.set(date, bucket);
    }

    for (const [date, dateEntries] of byDate) {
      const filePath = `${settings.logDirectory}/${date}${LOG_FILE_SUFFIX}`;
      const lines = dateEntries.map((e) => this.formatEntry(e)).join("\n") + "\n";
      await this.ensureDirectoryExists(settings.logDirectory);
      await this.appendToFile(filePath, lines);
    }
  }

  async cleanOldLogs(): Promise<void> {
    const settings = this.getSettings();
    if (!settings.enabled || settings.maxRetentionDays === 0) {
      return;
    }

    const adapter = this.app.vault.adapter as unknown as {
      list(path: string): Promise<{ files: string[] }>;
      remove(path: string): Promise<void>;
    };

    let listing: { files: string[] };
    try {
      listing = await adapter.list(settings.logDirectory);
    } catch {
      // Directory doesn't exist yet — nothing to clean.
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.maxRetentionDays);
    const cutoffISO = cutoffDate.toISOString().substring(0, ISO_DATE_LENGTH);

    for (const filePath of listing.files) {
      const fileName = filePath.split("/").pop() ?? "";
      if (!fileName.endsWith(LOG_FILE_SUFFIX)) continue;
      // File name format: YYYY-MM-DD-pm.log
      const dateStr = fileName.substring(0, ISO_DATE_LENGTH);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr < cutoffISO) {
        try {
          await adapter.remove(filePath);
        } catch {
          // Best-effort — skip files that can't be deleted.
        }
      }
    }
  }

  /** Stops the background flush interval. Call from plugin onunload(). */
  destroy(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string, context: string): void {
    const settings = this.getSettings();
    if (!settings.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[settings.minLevel]) return;

    this.buffer.push({
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
    });
  }

  private formatEntry(entry: LogEntry): string {
    const ctx = entry.context ? ` [${entry.context}]` : "";
    return `[${entry.timestamp}] [${entry.level}]${ctx} ${entry.message}`;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const adapter = this.app.vault.adapter as unknown as {
      exists(path: string): Promise<boolean>;
      mkdir(path: string): Promise<void>;
    };

    const parts = dirPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const exists = await adapter.exists(current);
      if (!exists) {
        try {
          await adapter.mkdir(current);
        } catch {
          // May already exist due to race conditions — ignore.
        }
      }
    }
  }

  private async appendToFile(filePath: string, content: string): Promise<void> {
    const adapter = this.app.vault.adapter as unknown as {
      exists(path: string): Promise<boolean>;
      read(path: string): Promise<string>;
      write(path: string, content: string): Promise<void>;
    };

    const exists = await adapter.exists(filePath);
    if (exists) {
      const existing = await adapter.read(filePath);
      await adapter.write(filePath, existing + content);
    } else {
      await adapter.write(filePath, content);
    }
  }
}
