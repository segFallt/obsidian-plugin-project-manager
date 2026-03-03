import type { PluginServices, AddCommandFn } from "../plugin-context";

/**
 * PM: Set Up Vault Structure
 * Creates all required folders and default view files.
 * Safe to run on an existing vault.
 */
export function registerScaffoldVaultCommand(services: PluginServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "scaffold-vault",
    name: "PM: Set Up Vault Structure",
    callback: async () => {
      await services.scaffoldService.scaffoldVault();
    },
  });
}
