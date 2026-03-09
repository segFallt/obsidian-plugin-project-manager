import type { App, Command, MarkdownPostProcessorContext } from "obsidian";
import type {
  IQueryService,
  IEntityService,
  IScaffoldService,
  ITaskParser,
  ILoggerService,
} from "./services/interfaces";
import type { ProjectManagerSettings } from "./settings";

/**
 * Narrow service bag consumed by commands and processors.
 *
 * Commands and processors depend on this interface rather than the concrete
 * ProjectManagerPlugin class (service-locator anti-pattern). This satisfies
 * ISP — each consumer only sees the services it actually needs — and DIP —
 * consumers depend on abstractions, not implementations.
 *
 * ProjectManagerPlugin satisfies this interface via structural (duck) typing,
 * so no casting is required in the wiring layer (commands/index.ts,
 * processors/index.ts).
 */
export interface PluginServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  entityService: IEntityService;
  taskParser: ITaskParser;
  scaffoldService: IScaffoldService;
  loggerService: ILoggerService;
  /** Transient context set by action buttons so create commands can pre-populate parent fields. */
  pendingActionContext: { field: string; value: string } | null;
}

/** Bound version of Plugin.addCommand, passed from the wiring layer. */
export type AddCommandFn = (cmd: Command) => void;

/** Bound version of Plugin.registerMarkdownCodeBlockProcessor, passed from the wiring layer. */
export type RegisterProcessorFn = (
  lang: string,
  handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
) => void;
