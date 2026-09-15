import type { ScaffoldCommandServices, AddCommandFn } from "../plugin-context";
import { COMMAND_IDS } from "../command-ids";
import { COMMAND_NAMES } from "../constants";

/**
 * PM: Set Up Vault Structure
 * Creates all required folders and default view files.
 * Safe to run on an existing vault.
 */
export function registerScaffoldVaultCommand(services: ScaffoldCommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: COMMAND_IDS.SCAFFOLD_VAULT,
    name: COMMAND_NAMES.SCAFFOLD_VAULT,
    callback: async () => {
      await services.scaffoldService.scaffoldVault();
    },
  });
}
