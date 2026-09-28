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
import {
  COMMAND_NAMES,
  CSS_CLS,
  ENTITY_TAGS,
  FM_KEY,
  MD_EXTENSION,
  STATUS,
} from '../../src/constants';

/**
 * End-to-end coverage for the contextual search panel (pm-search) against real
 * Obsidian: a name query, a fuzzy name query, and a query that matches only a
 * note's body text. Two client fixtures are seeded — one found by its name, one
 * found only by a distinctive word in its body — so the body-text case exercises
 * content search end to end, not just name matching.
 */

/** The distinctive term in the name-matched client's name; also used as the name query. */
const NAME_MATCH_TERM = 'Northwind';
/** A client found by its name (the term is part of the name). */
const NAME_MATCH_CLIENT = `${NAME_MATCH_TERM} Trading`;
/** A gapped subsequence of the name term — a fuzzy, non-substring form of it. */
const NAME_MATCH_FUZZY = 'nrthwnd';
/** A client whose distinctive term appears only in its body, never its name. */
const BODY_MATCH_CLIENT = 'Seabird Consulting';
/** The distinctive term present only in BODY_MATCH_CLIENT's body; also the body query. */
const BODY_ONLY_WORD = 'pineapple';
/** Dataview-index wait target: the baked Seed Client plus the two clients seeded here. */
const SEEDED_CLIENT_COUNT = 3;

const INPUT_SELECTOR = `.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`;
const RESULT_NAME_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_NAME}`;

/** Timeout for the panel to settle on the typed query's results (ms). */
const RESULT_TIMEOUT_MS = 5_000;

/** Writes a `#client` note carrying `body` under the vault's clients folder. */
function seedClient(vaultPath: string, name: string, body: string): void {
  const dir = resolve(vaultPath, 'clients');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `${name}${MD_EXTENSION}`),
    [
      '---',
      'tags:',
      `  - "${ENTITY_TAGS.client}"`,
      `${FM_KEY.STATUS}: ${STATUS.ACTIVE}`,
      '---',
      '',
      body,
      '',
    ].join('\n'),
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
  await waitForDataviewIndex(window, ENTITY_TAGS.client, SEEDED_CLIENT_COUNT);
});

test.afterAll(async () => {
  await teardownObsidianSpec(ctx);
});

test.beforeEach(async () => {
  window = await ctx.getPage();
});

/** Opens the search panel and types `query`. */
async function runSearch(query: string): Promise<void> {
  await selectCommand(window, COMMAND_NAMES.OPEN_SEARCH);
  const input = await window.waitForSelector(INPUT_SELECTOR, { timeout: RESULT_TIMEOUT_MS });
  await input.fill(query);
}

/** The result names currently rendered in the panel, sorted for order-independent comparison. */
async function sortedResultNames(): Promise<string[]> {
  const names = await window.$$eval(RESULT_NAME_SELECTOR, (els) => els.map((el) => el.textContent ?? ''));
  return names.sort();
}

// Each assertion polls until the panel settles on exactly the query's matches.
// An empty query browses every entity, so a query with distinctive terms narrows
// the set from that browse list — polling for the exact expected set spans the
// debounce and async body read and can never pass on the pre-query browse state.

test('a name query returns the matching entity', async () => {
  await runSearch(NAME_MATCH_TERM);
  await expect.poll(sortedResultNames, { timeout: RESULT_TIMEOUT_MS }).toEqual([NAME_MATCH_CLIENT]);
});

test('a fuzzy name query still returns the entity', async () => {
  await runSearch(NAME_MATCH_FUZZY);
  await expect.poll(sortedResultNames, { timeout: RESULT_TIMEOUT_MS }).toEqual([NAME_MATCH_CLIENT]);
});

test('a word only in a note body returns that note', async () => {
  await runSearch(BODY_ONLY_WORD);
  // Exactly the body-only client: the name-only client — whose name and body never
  // contain the word — is absent, so this is genuinely a content match, not browse.
  await expect.poll(sortedResultNames, { timeout: RESULT_TIMEOUT_MS }).toEqual([BODY_MATCH_CLIENT]);
});
