import { Notice } from "obsidian";
import type { Editor, MarkdownView, MarkdownFileInfo } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage, RaidType, RaidDirection } from "../types";

/**
 * Direction option displayed in the second SuggesterModal.
 * Carries the label shown to the user and the direction value written to the file.
 */
interface DirectionOption {
  label: string;
  direction: RaidDirection;
}

/** Returns type-specific direction options for the given RAID type. */
function getDirectionOptions(raidType: RaidType): DirectionOption[] {
  const labels: Record<RaidType, [string, string, string]> = {
    Risk: ["Mitigates", "Escalates", "Notes"],
    Assumption: ["Validates", "Invalidates", "Notes"],
    Issue: ["Resolves", "Compounds", "Notes"],
    Decision: ["Supports", "Challenges", "Notes"],
  };
  const [pos, neg, neu] = labels[raidType];
  return [
    { label: `↑ Positive — ${pos}`, direction: "positive" },
    { label: `↓ Negative — ${neg}`, direction: "negative" },
    { label: `· Neutral — ${neu}`, direction: "neutral" },
  ];
}

/**
 * Formats a single RAID item for display in the SuggesterModal.
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

      // Read frontmatter for context-aware prioritisation
      const cache = services.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter ?? {};
      const clientName = fm["client"] as string | undefined;
      const engagementName = fm["engagement"] as string | undefined;

      // Fetch all RAID items and context-matched items
      const allItems = services.queryService.getActiveRaidItems();
      const contextItems = services.queryService.getRaidItemsForContext(clientName, engagementName);

      if (allItems.length === 0) {
        new Notice("No active RAID items found.");
        return;
      }

      // Build display list: context items first (★ prefixed), then remaining
      const contextPaths = new Set(contextItems.map((p) => p.file.path));
      const remainingItems = allItems.filter((p) => !contextPaths.has(p.file.path));

      // Items as labelled tuples to pass through the modal
      interface LabelledItem {
        page: DataviewPage;
        label: string;
      }
      const labelledItems: LabelledItem[] = [
        ...contextItems.map((p) => ({ page: p, label: `★ ${formatRaidItem(p)}` })),
        ...remainingItems.map((p) => ({ page: p, label: formatRaidItem(p) })),
      ];

      // Step 1: Pick RAID item
      const itemModal = new SuggesterModal<LabelledItem>(
        services.app,
        labelledItems,
        (item) => item.label,
        "Select RAID item"
      );
      const selectedItem = await itemModal.choose();
      if (!selectedItem) return;

      // Resolve raid-type from the selected item's frontmatter
      const raidTypeRaw = selectedItem.page["raid-type"] as string | undefined;
      const raidType = (raidTypeRaw as RaidType) ?? "Risk";

      // Step 2: Pick direction
      const directionOptions = getDirectionOptions(raidType);
      const directionModal = new SuggesterModal<DirectionOption>(
        services.app,
        directionOptions,
        (opt) => opt.label,
        "Select relationship direction"
      );
      const selectedDirection = await directionModal.choose();
      if (!selectedDirection) return;

      // Append annotation to the current line
      const itemName = selectedItem.page.file.name;
      const lineNumber = editor.getCursor().line;
      const currentLine = editor.getLine(lineNumber);
      editor.setLine(lineNumber, currentLine + ` {raid:${selectedDirection.direction}}[[${itemName}]]`);
    },
  });
}
