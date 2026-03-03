import { vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { createMockApp } from "../mocks/app-mock";
import { Notice } from "../mocks/obsidian-mock";
import type { TFile } from "../mocks/obsidian-mock";

/**
 * Creates a minimal mock plugin with spy-based services.
 * Designed for testing individual command callbacks in isolation.
 */
export function createMockPlugin(overrides: {
  activeFile?: TFile | null;
  notesDirectory?: string;
  inInboxFolder?: boolean;
} = {}) {
  const app = createMockApp();

  // Configure active file
  const activeFile = overrides.activeFile ?? null;
  app.workspace.getActiveFile = () => activeFile as unknown as import("obsidian").TFile | null;

  // Configure metadata cache for project note detection
  if (activeFile && overrides.notesDirectory) {
    app.metadataCache.getFileCache = () => ({
      frontmatter: { notesDirectory: overrides.notesDirectory },
    });
  }

  const entityService = {
    createClient: vi.fn().mockResolvedValue({}),
    createEngagement: vi.fn().mockResolvedValue({}),
    createProject: vi.fn().mockResolvedValue({}),
    createPerson: vi.fn().mockResolvedValue({}),
    createInboxNote: vi.fn().mockResolvedValue({}),
    createSingleMeeting: vi.fn().mockResolvedValue({}),
    createRecurringMeeting: vi.fn().mockResolvedValue({}),
    createProjectNote: vi.fn().mockResolvedValue({}),
    convertInboxToProject: vi.fn().mockResolvedValue({}),
  };

  const queryService = {
    getActiveEntitiesByTag: vi.fn().mockReturnValue([]),
  };

  const scaffoldService = {
    scaffoldVault: vi.fn().mockResolvedValue(undefined),
  };

  const commands: Array<{ id: string; name: string; callback: () => Promise<void> }> = [];

  const plugin = {
    app: app as unknown as import("obsidian").App,
    settings: DEFAULT_SETTINGS,
    entityService: entityService as unknown as import("../../src/services/entity-service").EntityService,
    queryService: queryService as unknown as import("../../src/services/query-service").QueryService,
    scaffoldService: scaffoldService as unknown as import("../../src/services/vault-scaffold-service").VaultScaffoldService,
    addCommand: (cmd: { id: string; name: string; callback: () => Promise<void> }) => {
      commands.push(cmd);
    },
  };

  return {
    plugin: plugin as unknown as import("../../src/main").default,
    commands,
    entityService,
    queryService,
    scaffoldService,
    app,
  };
}

/** Extracts and calls the command callback, returning after it resolves. */
export async function runCommand(
  commands: Array<{ id: string; callback: () => Promise<void> }>,
  id: string
): Promise<void> {
  const cmd = commands.find((c) => c.id === id);
  if (!cmd) throw new Error(`Command "${id}" not registered`);
  await cmd.callback();
}

export { Notice };
