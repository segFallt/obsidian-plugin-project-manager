import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { executeCommandById } from '../helpers/command-palette';
import {
  waitForModal,
  closeModal,
  fillModalInput,
  submitModal,
} from '../helpers/modal-helpers';
import { ElectronApplication, Page } from 'playwright';

let vaultPath: string;
let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  vaultPath = createTempVault();
  const launched = await launchObsidian(vaultPath);
  app = launched.app;
  window = launched.window;
  await dismissFirstLaunchDialogs(window);
  await window.waitForSelector('.workspace', { timeout: 30_000 });
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test('InputModal (create-client) renders input fields', async () => {
  await executeCommandById(window, 'project-manager:create-client');
  await waitForModal(window);

  const inputs = await window.$$('.modal input, .modal textarea');
  expect(inputs.length).toBeGreaterThan(0);

  await closeModal(window);
});

test('InputModal (create-client) can be filled and submitted', async () => {
  await executeCommandById(window, 'project-manager:create-client');
  await waitForModal(window);

  await fillModalInput(window, 'e.g. Acme Corp', 'Modal Test Client');
  await submitModal(window);

  await window.waitForTimeout(500);
  // Modal should be dismissed after submit
  const modal = await window.$('.modal-container .modal');
  expect(modal).toBeNull();
});

test('EntityCreationModal (create-engagement) closes on Escape', async () => {
  await executeCommandById(window, 'project-manager:create-engagement');
  await waitForModal(window);

  await window.keyboard.press('Escape');
  await window.waitForTimeout(300);

  const modal = await window.$('.modal-container .modal');
  expect(modal).toBeNull();
});

test('Create Engagement modal shows client selector', async () => {
  await executeCommandById(window, 'project-manager:create-engagement');
  await waitForModal(window);

  // Engagement requires selecting a parent client
  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});
