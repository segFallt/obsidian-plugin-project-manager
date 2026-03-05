import type { ParsedTask, TaskPriority } from "../types";
import type { ITaskParser } from "./interfaces";
import {
  PRIORITY_EMOJI,
  DUE_DATE_EMOJI,
  COMPLETION_DATE_EMOJI,
  RECURRENCE_EMOJI,
  DEFAULT_PRIORITY,
} from "../constants";

// Regex to detect a markdown task line: "- [ ] text" or "- [x] text"
const TASK_LINE_REGEX = /^(\s*)-\s+\[([x ])\]\s+(.+)$/i;

// ISO date pattern used after emoji markers
const ISO_DATE_PATTERN = /(\d{4}-\d{2}-\d{2})/;

// Tag pattern: #tag (not followed by a digit to avoid priority-style numbers)
const TAG_PATTERN = /#[a-zA-Z][a-zA-Z0-9_/-]*/g;

/**
 * Parses markdown task lines into structured `ParsedTask` objects.
 *
 * Supports the Obsidian Tasks plugin emoji format:
 * - Due date: 📅 YYYY-MM-DD
 * - Completion: ✅ YYYY-MM-DD
 * - Recurrence: 🔁 <text>
 * - Priority: ⏫ (1), 🔼 (2), [none] (3), 🔽 (4), ⏬ (5)
 * - Tags: #tag
 */
export class TaskParser implements ITaskParser {
  /**
   * Parses a single markdown line into a ParsedTask.
   * Returns null if the line is not a task.
   */
  parseTaskLine(line: string, filePath: string, lineNumber: number): ParsedTask | null {
    const match = TASK_LINE_REGEX.exec(line);
    if (!match) return null;

    const completedChar = match[2].toLowerCase();
    const rawText = match[3].trim();

    return {
      text: rawText,
      rawText,
      completed: completedChar === "x",
      filePath,
      lineNumber,
      dueDate: this.extractEmojiDate(rawText, DUE_DATE_EMOJI),
      completionDate: this.extractEmojiDate(rawText, COMPLETION_DATE_EMOJI),
      priority: this.extractPriority(rawText),
      recurrence: this.extractRecurrence(rawText),
      tags: this.extractTags(rawText),
    };
  }

  /**
   * Parses all task lines from a markdown content string.
   */
  parseTasksFromContent(content: string, filePath: string): ParsedTask[] {
    const lines = content.split("\n");
    const tasks: ParsedTask[] = [];

    for (let i = 0; i < lines.length; i++) {
      const task = this.parseTaskLine(lines[i], filePath, i);
      if (task) tasks.push(task);
    }

    return tasks;
  }

  /**
   * Generates the updated line for a task with its completion state toggled.
   * Adds or removes the completion date emoji accordingly.
   */
  toggleTaskLine(originalLine: string, nowCompleted: boolean): string {
    if (nowCompleted) {
      // Mark as done: replace [ ] with [x], append completion date
      const today = new Date().toISOString().split("T")[0];
      return originalLine
        .replace(/\[[ ]\]/, "[x]")
        .replace(COMPLETION_DATE_EMOJI + " " + ISO_DATE_PATTERN.source, "")
        .trimEnd()
        + ` ${COMPLETION_DATE_EMOJI} ${today}`;
    } else {
      // Mark as undone: replace [x] with [ ], remove completion date
      return originalLine
        .replace(/\[[xX]\]/, "[ ]")
        .replace(new RegExp(`\\s*${COMPLETION_DATE_EMOJI}\\s+\\d{4}-\\d{2}-\\d{2}`), "");
    }
  }

  // ─── Private extraction helpers ──────────────────────────────────────────

  private extractEmojiDate(text: string, emoji: string): string | null {
    const idx = text.indexOf(emoji);
    if (idx === -1) return null;
    const rest = text.substring(idx + emoji.length).trim();
    const match = ISO_DATE_PATTERN.exec(rest);
    return match ? match[1] : null;
  }

  private extractPriority(text: string): TaskPriority {
    for (const [emoji, priority] of Object.entries(PRIORITY_EMOJI)) {
      if (text.includes(emoji)) return priority as TaskPriority;
    }
    return DEFAULT_PRIORITY; // Default: Medium
  }

  private extractRecurrence(text: string): string | null {
    const idx = text.indexOf(RECURRENCE_EMOJI);
    if (idx === -1) return null;
    // Everything after 🔁 up to the next emoji or end
    const rest = text.substring(idx + RECURRENCE_EMOJI.length).trim();
    // Stop at next emoji (non-ASCII character block) or end of string
    const nextEmojiMatch = rest.match(/[\u{1F300}-\u{1FFFF}]/u);
    if (nextEmojiMatch && nextEmojiMatch.index !== undefined) {
      return rest.substring(0, nextEmojiMatch.index).trim() || null;
    }
    return rest || null;
  }

  private extractTags(text: string): string[] {
    return Array.from(text.matchAll(TAG_PATTERN), (m) => m[0]);
  }
}
