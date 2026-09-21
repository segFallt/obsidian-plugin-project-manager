/**
 * Named constants shared across the E2E harness.
 *
 * The plugin id and command ids are the harness's view of the plugin's runtime
 * identity. The bare command ids are imported from `src/command-ids.ts` so the
 * harness never re-types them and cannot drift from the plugin.
 */
import { COMMAND_IDS } from '../../src/command-ids';

/** The plugin's manifest id — the namespace Obsidian keys the plugin and its commands under. */
export const PLUGIN_ID = 'engagement-project-manager';

/** Prefix Obsidian applies to bare command ids at runtime (`<manifest id>:`). */
export const COMMAND_PREFIX = `${PLUGIN_ID}:`;

/** Fully-qualified command ids, derived from the plugin's single source of truth. */
export const CREATE_CLIENT_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_CLIENT}`;
export const CREATE_ENGAGEMENT_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_ENGAGEMENT}`;
export const CREATE_PROJECT_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_PROJECT}`;
export const CREATE_PERSON_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_PERSON}`;
export const CREATE_RAID_ITEM_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_RAID_ITEM}`;
export const CREATE_REFERENCE_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.CREATE_REFERENCE}`;
export const SCAFFOLD_VAULT_COMMAND_ID = `${COMMAND_PREFIX}${COMMAND_IDS.SCAFFOLD_VAULT}`;

/** Selector for Obsidian's workspace root — present once the vault UI has rendered. */
export const WORKSPACE_SELECTOR = '.workspace';

/** Timeout for the plugin's commands to register after load (ms). */
export const PLUGIN_READY_TIMEOUT_MS = 15_000;

/** Timeout for the workspace to render after launch (ms). */
export const WORKSPACE_READY_TIMEOUT_MS = 30_000;

/** Attempts to re-acquire the live page when a renderer replacement closes it mid-wait. */
export const LIVE_PAGE_REACQUIRE_ATTEMPTS = 3;

/** Backoff between live-page re-acquire attempts (ms). */
export const REACQUIRE_BACKOFF_MS = 500;

/** Settle time after dismissing a first-launch dialog (ms). */
export const DIALOG_DISMISS_SETTLE_MS = 300;

/**
 * Minimum number of plugin commands expected to be registered under the plugin
 * namespace — guards against accidental command removals or namespace drift.
 * Set to the full command count (all COMMAND_IDS are registered during onload),
 * so removing any command fails the plugin-load guard rather than slipping past.
 */
export const MIN_REGISTERED_COMMAND_COUNT = Object.keys(COMMAND_IDS).length;

/** Text encoding used when reading harness files (e.g. the built manifest). */
export const FILE_ENCODING = 'utf8';
