import { test, expect, Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import { selectCommand } from '../helpers/command-palette';
import { waitForDataviewIndex } from '../helpers/dataview-helpers';
import { COMMAND_NAMES, CSS_CLS, DEBOUNCE_MS } from '../../src/constants';

/**
 * End-to-end coverage for the contextual search panel (pm-search) against real
 * Obsidian: a name query, a fuzzy name query, and a query that matches only a
 * note's body text. Two client fixtures are seeded — one found by its name, one
 * found only by a distinctive word in its body — so the body-text case exercises
 * content search end to end, not just name matching.
 */

/** A client found by its name; the query term is part of the name. */
const NAME_MATCH_CLIENT = 'Northwind Trading';
/** A client whose distinctive term appears only in its body, never its name. */
const BODY_MATCH_CLIENT = 'Seabird Consulting';
/** The distinctive term present only in BODY_MATCH_CLIENT's body. */
const BODY_ONLY_WORD = 'pineapple';
/** The baked Seed Client plus the two seeded here. */
const SEEDED_CLIENT_COUNT = 3;

const CLIENT_TAG = '#client';
const INPUT_SELECTOR = `.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`;
const RESULT_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT}`;
const RESULT_NAME_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_NAME}`;

/** Extra settle time after the debounce for the asynchronous body read to resolve (ms). */
const SEARCH_SETTLE_MS = DEBOUNCE_MS.SEARCH + 400;
/** Timeout for a result row to appear once a query has been typed (ms). */
const RESULT_TIMEOUT_MS = 5_000;

/** Writes a `#client` note carrying `body` under the vault's clients folder. */
function seedClient(vaultPath: string, name: string, body: string): void {
  const dir = resolve(vaultPath, 'clients');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `${name}.md`),
    ['---', 'tags:', `  - "${CLIENT_TAG}"`, 'status: Active', '---', '', body, ''].join('\n'),
  );
}

let ctx: ObsidianSpecContext;
let window: Page;

test.beforeAll(async () => {
  ctx = await setupObsidianSpec({
    seedVault: (vaultPath) => {
      // One client is found by its name, the other only by a distinctive body word.
      seedClient(vaultPath, NAME_MATCH_CLIENT, 'A wholesale trading company.');
      seedClient(vaultPath, BODY_MATCH_CLIENT, `The team is fond of ${BODY_ONLY_WORD}.`);
    },
  });
  window = await ctx.getPage();
  await waitForDataviewIndex(window, CLIENT_TAG, SEEDED_CLIENT_COUNT);
});

test.afterAll(async () => {
  await teardownObsidianSpec(ctx);
});

test.beforeEach(async () => {
  window = await ctx.getPage();
});

/** Opens the search panel and types `query`, letting the debounce and async search settle. */
async function search(query: string): Promise<void> {
  await selectCommand(window, COMMAND_NAMES.OPEN_SEARCH);
  const input = await window.waitForSelector(INPUT_SELECTOR, { timeout: RESULT_TIMEOUT_MS });
  await input.fill(query);
  await window.waitForSelector(RESULT_SELECTOR, { timeout: RESULT_TIMEOUT_MS });
  await window.waitForTimeout(SEARCH_SETTLE_MS);
}

/** The result names currently rendered in the panel. */
async function resultNames(): Promise<string[]> {
  return window.$$eval(RESULT_NAME_SELECTOR, (els) => els.map((el) => el.textContent ?? ''));
}

test('a name query returns the matching entity', async () => {
  await search('Northwind');
  expect(await resultNames()).toContain(NAME_MATCH_CLIENT);
});

test('a fuzzy name query still returns the entity', async () => {
  // A gapped subsequence of "Northwind" — no exact substring, but a fuzzy match.
  await search('nrthwnd');
  expect(await resultNames()).toContain(NAME_MATCH_CLIENT);
});

test('a word only in a note body returns that note', async () => {
  await search(BODY_ONLY_WORD);
  const names = await resultNames();
  // The body-only client is returned; the name-only client, whose name and body
  // never contain the word, is not — so this is genuinely a content match.
  expect(names).toContain(BODY_MATCH_CLIENT);
  expect(names).not.toContain(NAME_MATCH_CLIENT);
});
