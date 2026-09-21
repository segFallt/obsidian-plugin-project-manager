import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import { executeCommandById, selectCommand } from '../helpers/command-palette';
import { ObsidianWindow } from '../helpers/types';
import {
  waitForModal,
  fillModalInput,
  submitModal,
  closeModal,
} from '../helpers/modal-helpers';
import {
  COMMAND_PREFIX,
  CREATE_CLIENT_COMMAND_ID,
  CREATE_ENGAGEMENT_COMMAND_ID,
  CREATE_PROJECT_COMMAND_ID,
  SCAFFOLD_VAULT_COMMAND_ID,
} from '../helpers/constants';

let ctx: ObsidianSpecContext;
let window: Page;

test.beforeAll(async () => {
  ctx = await setupObsidianSpec();
  window = await ctx.getPage();
});

test.afterAll(async () => {
  await teardownObsidianSpec(ctx);
});

test.beforeEach(async () => {
  window = await ctx.getPage();
});

test('Create Client command opens EntityCreationModal', async () => {
  await executeCommandById(window, CREATE_CLIENT_COMMAND_ID);
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Create Client via command palette creates a note', async () => {
  await selectCommand(window, 'Create Client');
  await waitForModal(window);

  await fillModalInput(window, 'e.g. Acme Corp', 'Test Client E2E');
  await submitModal(window);

  // Verify note was created — the active file should reference the client
  await window.waitForTimeout(1_000);
  const activeFile = await window.evaluate(() => {
    return (window as unknown as ObsidianWindow).app?.workspace?.getActiveFile()?.basename;
  });
  expect(activeFile).toContain('Test Client E2E');
});

test('Create Engagement command opens modal', async () => {
  await executeCommandById(window, CREATE_ENGAGEMENT_COMMAND_ID);
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Create Project command opens modal', async () => {
  await executeCommandById(window, CREATE_PROJECT_COMMAND_ID);
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Scaffold Vault command is registered', async () => {
  const commands = await window.evaluate((prefix: string) => {
    const obsApp = (window as unknown as ObsidianWindow).app;
    return Object.keys(obsApp?.commands?.commands ?? {}).filter((id) =>
      id.startsWith(prefix),
    );
  }, COMMAND_PREFIX);

  expect(commands).toContain(SCAFFOLD_VAULT_COMMAND_ID);
});
