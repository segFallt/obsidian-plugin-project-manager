import { Notice, TFile } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceTopicUpdateModal } from "../ui/modals/reference-topic-update-modal";
import { ENTITY_TAGS, FM_KEY } from "../constants";
import { toWikilink } from "../utils/link-utils";

const LOG_CTX = "update-reference-topic";

/**
 * PM: Update Reference Topic
 * Selects an existing reference topic and assigns or clears its parent.
 */
export function registerUpdateReferenceTopicCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: "update-reference-topic",
    name: "PM: Update Reference Topic",
    callback: async () => {
      const topics = services.queryService.getEntitiesByTag(ENTITY_TAGS.referenceTopic);
      if (topics.length === 0) {
        new Notice("No reference topics found. Create one first.");
        return;
      }

      const modal = new ReferenceTopicUpdateModal(services.app, topics);
      const result = await modal.prompt();
      if (!result) return;

      services.loggerService.debug(
        `update-reference-topic: "${result.topicName}", parent: "${result.parentName ?? "none"}"`,
        LOG_CTX
      );

      try {
        const file = services.app.vault.getAbstractFileByPath(
          topics.find((t) => t.file.name === result.topicName)?.file.path ?? ""
        );
        if (!(file instanceof TFile)) {
          new Notice(`Could not find file for topic "${result.topicName}".`);
          return;
        }
        await services.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
          if (result.parentName) {
            fm[FM_KEY.PARENT] = toWikilink(result.parentName);
          } else {
            delete fm[FM_KEY.PARENT];
          }
        });
        new Notice(`Updated "${result.topicName}".`);
      } catch (err) {
        services.loggerService.error(String(err), LOG_CTX, err);
        new Notice(`Error: ${String(err)}`);
      }
    },
  });
}
