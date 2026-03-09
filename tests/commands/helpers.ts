import { vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/settings";
import { createMockApp } from "../mocks/app-mock";
import { Notice } from "../mocks/obsidian-mock";
import type { TFile } from "../mocks/obsidian-mock";
import type { PluginServices, AddCommandFn } from "../../src/plugin-context";

/**
 * Creates a minimal mock plugin with spy-based services.
 * Designed for testing individual command callbacks in isolation.
 *
 * Returns both:
 * - `services` + `addCommand`: for testing individual command register functions
 * - `plugin`: for testing registerAllCommands (wiring layer, still typed as full plugin)
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
    createRecurringMeetingEvent: vi.fn().mockResolvedValue({}),
    convertSingleToRecurring: vi.fn().mockResolvedValue({}),
  };

  const queryService = {
    getActiveEntitiesByTag: vi.fn().mockReturnValue([]),
    getActiveRecurringMeetings: vi.fn().mockReturnValue([]),
  };

  const scaffoldService = {
    scaffoldVault: vi.fn().mockResolvedValue(undefined),
  };

  const loggerService = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };

  const commands: Array<{ id: string; name: string; callback: () => Promise<void> }> = [];

  const addCommandFn = (cmd: { id: string; name: string; callback: () => Promise<void> }) => {
    commands.push(cmd);
  };

  const plugin = {
    app: app as unknown as import("obsidian").App,
    settings: DEFAULT_SETTINGS,
    entityService: entityService as unknown as import("../../src/services/interfaces").IEntityService,
    queryService: queryService as unknown as import("../../src/services/interfaces").IQueryService,
    scaffoldService: scaffoldService as unknown as import("../../src/services/interfaces").IScaffoldService,
    taskParser: {} as unknown as import("../../src/services/interfaces").ITaskParser,
    loggerService: loggerService as unknown as import("../../src/services/interfaces").ILoggerService,
    addCommand: addCommandFn,
    pendingActionContext: null as { field: string; value: string } | null,
  };

  return {
    /** Use with individual command register functions: registerCreateXxxCommand(services, addCommand) */
    services: plugin as unknown as PluginServices,
    /** Use with individual command register functions: registerCreateXxxCommand(services, addCommand) */
    addCommand: addCommandFn as unknown as AddCommandFn,
    /** Use with the wiring layer: registerAllCommands(plugin) */
    plugin: plugin as unknown as import("../../src/main").default,
    commands,
    entityService,
    queryService,
    scaffoldService,
    loggerService,
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
