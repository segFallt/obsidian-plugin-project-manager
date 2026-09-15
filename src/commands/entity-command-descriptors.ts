import { COMMAND_IDS } from "../command-ids";
import type { CommandId } from "../command-ids";
import type { CommandServices } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import type { EntityCreationResult } from "../ui/modals/entity-creation-modal";
import { InputModal } from "../ui/modals/input-modal";
import {
  ENTITY_TAGS,
  COMMAND_NAMES,
  LOG_CONTEXT,
  CMD_MODAL,
  PARENT_LABEL,
  CMD_ERROR_LABEL,
  ACTION_CTX_FIELD,
  FM_KEY,
} from "../constants";

/**
 * Declarative description of one entity-creation command whose flow reduces to:
 * prompt for a name (and optional parent), log a debug line, then call an
 * entity-service creation method inside the shared error-notice wrapper.
 *
 * Commands with bespoke multi-step modals (RAID item, reference, project note,
 * recurring-meeting event, reference topic) are intentionally NOT modelled here.
 */
export interface EntityCreateDescriptor {
  /** Bare command id (from the shared COMMAND_IDS registry). */
  id: CommandId;
  /** Command palette display name. */
  name: string;
  /** Logger context tag for debug/error lines. */
  context: string;
  /** Opens the command's modal and returns a normalized result (or null on cancel). */
  prompt: (services: CommandServices) => Promise<EntityCreationResult | null>;
  /** Builds the debug log line from the acquired result. */
  debugMessage: (result: EntityCreationResult) => string;
  /** Invokes the entity-service creation method. */
  create: (services: CommandServices, result: EntityCreationResult) => Promise<unknown>;
  /** Builds the user-facing error Notice message. */
  errorMessage: (err: unknown) => string;
}

/** Reads a pre-selected parent value from the pending action context. */
function readPreselectedParent(services: CommandServices, field: string): string | undefined {
  const pendingCtx = services.actionContext.consume();
  return pendingCtx?.field === field ? pendingCtx.value : undefined;
}

interface EntityCreationModalConfig {
  title: string;
  namePlaceholder: string;
  parentTag: string;
  parentLabel: string;
  /** Action-context field that pre-selects the parent; omitted commands do not consume context. */
  preselectField?: string;
}

/** Builds a `prompt` implementation backed by the shared EntityCreationModal. */
function entityCreationModalPrompt(
  config: EntityCreationModalConfig
): (services: CommandServices) => Promise<EntityCreationResult | null> {
  return async (services) => {
    const preselected = config.preselectField
      ? readPreselectedParent(services, config.preselectField)
      : undefined;

    const options = services.queryService.getActiveEntitiesByTag(config.parentTag);

    const modal = new EntityCreationModal(
      services.app,
      config.title,
      config.namePlaceholder,
      options.length > 0 ? config.parentLabel : null,
      options,
      preselected
    );

    return modal.prompt();
  };
}

export const CREATE_CLIENT_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_CLIENT,
  name: COMMAND_NAMES.CREATE_CLIENT,
  context: LOG_CONTEXT.CREATE_CLIENT,
  prompt: async (services) => {
    const modal = new InputModal(services.app, CMD_MODAL.CREATE_CLIENT.title, CMD_MODAL.CREATE_CLIENT.placeholder);
    const name = await modal.prompt();
    return name ? { name, parentName: null } : null;
  },
  debugMessage: (result) => `${LOG_CONTEXT.CREATE_CLIENT} invoked: "${result.name}"`,
  create: (services, result) => services.entityService.createClient(result.name),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_CLIENT}: ${String(err)}`,
};

export const CREATE_ENGAGEMENT_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_ENGAGEMENT,
  name: COMMAND_NAMES.CREATE_ENGAGEMENT,
  context: LOG_CONTEXT.CREATE_ENGAGEMENT,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_ENGAGEMENT.title,
    namePlaceholder: CMD_MODAL.CREATE_ENGAGEMENT.placeholder,
    parentTag: ENTITY_TAGS.client,
    parentLabel: PARENT_LABEL.CLIENT_OPTIONAL,
    preselectField: ACTION_CTX_FIELD.CLIENT,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_ENGAGEMENT} invoked: "${result.name}", ${FM_KEY.CLIENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createEngagement(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_ENGAGEMENT}: ${String(err)}`,
};

export const CREATE_PROJECT_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_PROJECT,
  name: COMMAND_NAMES.CREATE_PROJECT,
  context: LOG_CONTEXT.CREATE_PROJECT,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_PROJECT.title,
    namePlaceholder: CMD_MODAL.CREATE_PROJECT.placeholder,
    parentTag: ENTITY_TAGS.engagement,
    parentLabel: PARENT_LABEL.ENGAGEMENT_OPTIONAL,
    preselectField: ACTION_CTX_FIELD.ENGAGEMENT,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_PROJECT} invoked: "${result.name}", ${FM_KEY.ENGAGEMENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createProject(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_PROJECT}: ${String(err)}`,
};

export const CREATE_PERSON_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_PERSON,
  name: COMMAND_NAMES.CREATE_PERSON,
  context: LOG_CONTEXT.CREATE_PERSON,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_PERSON.title,
    namePlaceholder: CMD_MODAL.CREATE_PERSON.placeholder,
    parentTag: ENTITY_TAGS.client,
    parentLabel: PARENT_LABEL.CLIENT_OPTIONAL,
    preselectField: ACTION_CTX_FIELD.CLIENT,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_PERSON} invoked: "${result.name}", ${FM_KEY.CLIENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createPerson(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_PERSON}: ${String(err)}`,
};

export const CREATE_INBOX_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_INBOX,
  name: COMMAND_NAMES.CREATE_INBOX,
  context: LOG_CONTEXT.CREATE_INBOX,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_INBOX.title,
    namePlaceholder: CMD_MODAL.CREATE_INBOX.placeholder,
    parentTag: ENTITY_TAGS.engagement,
    parentLabel: PARENT_LABEL.ENGAGEMENT_OPTIONAL,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_INBOX} invoked: "${result.name}", ${FM_KEY.ENGAGEMENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createInboxNote(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_INBOX}: ${String(err)}`,
};

export const CREATE_SINGLE_MEETING_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_SINGLE_MEETING,
  name: COMMAND_NAMES.CREATE_SINGLE_MEETING,
  context: LOG_CONTEXT.CREATE_SINGLE_MEETING,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_SINGLE_MEETING.title,
    namePlaceholder: CMD_MODAL.CREATE_SINGLE_MEETING.placeholder,
    parentTag: ENTITY_TAGS.engagement,
    parentLabel: PARENT_LABEL.ENGAGEMENT_OPTIONAL,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_SINGLE_MEETING} invoked: "${result.name}", ${FM_KEY.ENGAGEMENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createSingleMeeting(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_SINGLE_MEETING}: ${String(err)}`,
};

export const CREATE_RECURRING_MEETING_DESCRIPTOR: EntityCreateDescriptor = {
  id: COMMAND_IDS.CREATE_RECURRING_MEETING,
  name: COMMAND_NAMES.CREATE_RECURRING_MEETING,
  context: LOG_CONTEXT.CREATE_RECURRING_MEETING,
  prompt: entityCreationModalPrompt({
    title: CMD_MODAL.CREATE_RECURRING_MEETING.title,
    namePlaceholder: CMD_MODAL.CREATE_RECURRING_MEETING.placeholder,
    parentTag: ENTITY_TAGS.engagement,
    parentLabel: PARENT_LABEL.ENGAGEMENT_OPTIONAL,
  }),
  debugMessage: (result) =>
    `${LOG_CONTEXT.CREATE_RECURRING_MEETING} invoked: "${result.name}", ${FM_KEY.ENGAGEMENT}: "${result.parentName ?? "none"}"`,
  create: (services, result) =>
    services.entityService.createRecurringMeeting(result.name, result.parentName ?? undefined),
  errorMessage: (err) => `${CMD_ERROR_LABEL.CREATE_RECURRING_MEETING}: ${String(err)}`,
};

/**
 * The full descriptor list. Registration iterates this array, so adding a new
 * table-driven create command is a single entry here — no other file changes.
 */
export const ENTITY_CREATE_DESCRIPTORS: EntityCreateDescriptor[] = [
  CREATE_CLIENT_DESCRIPTOR,
  CREATE_ENGAGEMENT_DESCRIPTOR,
  CREATE_PROJECT_DESCRIPTOR,
  CREATE_PERSON_DESCRIPTOR,
  CREATE_INBOX_DESCRIPTOR,
  CREATE_SINGLE_MEETING_DESCRIPTOR,
  CREATE_RECURRING_MEETING_DESCRIPTOR,
];
