import { Notice } from "obsidian";
import type { Editor, MarkdownView, MarkdownFileInfo } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { RaidTagModal } from "../ui/modals/raid-tag-modal";
import type { RaidTagLabelledItem } from "../ui/modals/raid-tag-modal";
import type { DataviewPage } from "../types";
import { MSG, LOG_CONTEXT } from "../constants";

/**
 * Formats a single RAID item for display in the selection list.
 * Format: "[R] Name (Engagement)" where R is the first letter of raid-type.
 */
function formatRaidItem(page: DataviewPage): string {
  const typeRaw = page["raid-type"] as string | undefined;
  const initial = typeRaw ? typeRaw.charAt(0).toUpperCase() : "?";
  const name = page.file.name;
  const engagement = page["engagement"] as string | undefined;
  const suffix = engagement ? ` (${engagement})` : "";
  return `[${initial}] ${name}${suffix}`;
}

/**
 * PM: Tag Line as RAID Reference
 *
 * Editor command: appends `{raid:<direction>}[[ItemName]]` to the current cursor line.
 * Context-matched items (from the current file's client/engagement) are displayed first
 * with a ★ prefix to help the user quickly identify relevant RAID items.
 *
 * The cursor position is captured synchronously before the modal opens to prevent
 * stale-cursor bugs after async modal resolution.
 */
export function registerTagRaidReferenceCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: "tag-raid-reference",
    name: "PM: Tag Line as RAID Reference",
    editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
      const view = ctx as MarkdownView;
      const file = view.file;
      if (!file) {
        new Notice("No active file.");
        return;
      }

      // Capture cursor position synchronously BEFORE any async operation.
      // After modals close, the editor cursor may have moved or may not be accessible,
      // so both values must be read while the editor is still in its pre-modal state.
      const lineNumber = editor.getCursor().line;
      const currentLine = editor.getLine(lineNumber);

      // Read frontmatter for context-aware prioritisation
      const cache = services.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};
      const clientName = fm["client"] as string | undefined;
      const engagementName = fm["engagement"] as string | undefined;

      // Fetch all active RAID items and context-matched items
      const allItems = services.queryService.getActiveRaidItems();
      const contextItems = services.queryService.getRaidItemsForContext(clientName, engagementName);

      if (allItems.length === 0) {
        new Notice("No active RAID items found.");
        return;
      }

      // Build display list: context items first (★ prefixed), then remaining
      const contextPaths = new Set(contextItems.map((p) => p.file.path));
      const remainingItems = allItems.filter((p) => !contextPaths.has(p.file.path));

      const labelledItems: RaidTagLabelledItem[] = [
        ...contextItems.map((p) => ({ page: p, label: `★ ${formatRaidItem(p)}` })),
        ...remainingItems.map((p) => ({ page: p, label: formatRaidItem(p) })),
      ];

      const modal = new RaidTagModal(services.app, labelledItems);
      const result = await modal.prompt();

      if (!result) {
        new Notice(MSG.CANCELLED);
        return;
      }

      services.loggerService.debug(
        `tag-raid-reference: tagging line ${lineNumber} with {raid:${result.direction}}[[${result.itemName}]]`,
        LOG_CONTEXT.TAG_RAID_REFERENCE
      );

      try {
        editor.setLine(lineNumber, currentLine + ` {raid:${result.direction}}[[${result.itemName}]]`);
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.TAG_RAID_REFERENCE, err);
        new Notice(`Error tagging line: ${String(err)}`);
      }
    },
  });
}
