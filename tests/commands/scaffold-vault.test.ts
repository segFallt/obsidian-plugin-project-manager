import { describe, it, expect } from "vitest";
import { registerScaffoldVaultCommand } from "../../src/commands/scaffold-vault";
import { createMockPlugin, runCommand } from "./helpers";

describe("registerScaffoldVaultCommand", () => {
  it("calls scaffoldService.scaffoldVault", async () => {
    const { plugin, commands, scaffoldService } = createMockPlugin();
    registerScaffoldVaultCommand(plugin);
    await runCommand(commands, "scaffold-vault");
    expect(scaffoldService.scaffoldVault).toHaveBeenCalledOnce();
  });
});
