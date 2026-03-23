import { Notice } from "obsidian";
import type { Editor, MarkdownView, MarkdownFileInfo } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage, RaidType, RaidDirection } from "../types";
import { DIRECTION_LABELS, DIRECTION_ICONS } from "../processors/raid-constants";
import { MSG, LOG_CONTEXT } from "../constants";
import { normalizeToName } from "../utils/link-utils";

// ─── Direction picker helpers ─────────────────────────────────────────────────

interface DirectionOption {
  label: string;
  direction: RaidDirection;
}

function getDirectionOptions(raidType: RaidType): DirectionOption[] {
  return (["positive", "negative", "neutral"] as RaidDirection[]).map((dir) => ({
    label: `${DIRECTION_ICONS[dir]} ${dir.charAt(0).toUpperCase() + dir.slice(1)} — ${DIRECTION_LABELS[dir][raidType]}`,
    direction: dir,
  }));
}

// ─── Item display helper ──────────────────────────────────────────────────────

/**
 * Formats a single RAID item for display in the selection list.
 * Format: "[R] Name (Engagement)" where R is the first letter of raid-type.
 */
function formatRaidItem(page: DataviewPage): string {
  const typeRaw = page["raid-type"] as string | undefined;
  const initial = typeRaw ? typeRaw.charAt(0).toUpperCase() : "?";
  const name = page.file.name;
  const engagement = normalizeToName(page["engagement"]);
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

      // Step 1 — pick a RAID item (context items floated to top with ★ prefix)
      const contextPaths = new Set(contextItems.map((p) => p.file.path));
      const sortedItems = [
        ...contextItems,
        ...allItems.filter((p) => !contextPaths.has(p.file.path)),
      ];

      const modal1 = new SuggesterModal<DataviewPage>(
        services.app,
        sortedItems,
        (p) => (contextPaths.has(p.file.path) ? `★ ${formatRaidItem(p)}` : formatRaidItem(p))
      );
      const selectedItem = await modal1.choose();

      if (!selectedItem) {
        new Notice(MSG.CANCELLED);
        return;
      }

      // Step 2 — pick a direction based on the selected item's raid-type
      const raidType = (selectedItem["raid-type"] as RaidType | undefined) ?? "Risk";
      const modal2 = new SuggesterModal<DirectionOption>(
        services.app,
        getDirectionOptions(raidType),
        (opt) => opt.label
      );
      const selectedDirection = await modal2.choose();

      if (!selectedDirection) {
        new Notice(MSG.CANCELLED);
        return;
      }

      services.loggerService.debug(
        `tag-raid-reference: tagging line ${lineNumber} with {raid:${selectedDirection.direction}}[[${selectedItem.file.name}]]`,
        LOG_CONTEXT.TAG_RAID_REFERENCE
      );

      try {
        editor.setLine(
          lineNumber,
          currentLine + ` {raid:${selectedDirection.direction}}[[${selectedItem.file.name}]]`
        );
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.TAG_RAID_REFERENCE, err);
        new Notice(`Error tagging line: ${String(err)}`);
      }
    },
  });
}
