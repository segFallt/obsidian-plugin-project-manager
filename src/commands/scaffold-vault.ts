import type ProjectManagerPlugin from "../main";

/**
 * PM: Set Up Vault Structure
 * Creates all required folders and default view files.
 * Safe to run on an existing vault.
 */
export function registerScaffoldVaultCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "scaffold-vault",
    name: "PM: Set Up Vault Structure",
    callback: async () => {
      await plugin.scaffoldService.scaffoldVault();
    },
  });
}
