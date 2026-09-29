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

/** A term shared by two baked entity names, so a query on it renders multiple rows. */
const MULTI_ROW_TERM = 'Seed';
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
/**
 * A word whose letters appear in order across a client's body, though the word
 * itself never occurs there — a gapped subsequence, not a real substring.
 */
const GAPPED_WORD = 'execute';
/** A client whose body contains GAPPED_WORD only as a gapped subsequence. */
const GAPPED_SUBSEQUENCE_CLIENT = 'Riverstone Partners';
/** A body carrying the letters e-x-e-c-u-t-e in order, but never the word itself. */
const GAPPED_SUBSEQUENCE_BODY = 'Everyone expected the crew to unite here early.';
/** Dataview-index wait target: the baked Seed Client plus the three clients seeded here. */
const SEEDED_CLIENT_COUNT = 4;

const INPUT_SELECTOR = `.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`;
const RESULT_NAME_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_NAME}`;
const RESULT_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT}`;
const RESULT_MAIN_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_MAIN}`;

/** Timeout for the panel to settle on the typed query's results (ms). */
const RESULT_TIMEOUT_MS = 5_000;

/** Sub-pixel slack for layout box comparisons; browsers round fractional pixels. */
const LAYOUT_EPSILON_PX = 1;

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
      // A third client whose body carries GAPPED_WORD only as a gapped subsequence.
      seedClient(vaultPath, GAPPED_SUBSEQUENCE_CLIENT, GAPPED_SUBSEQUENCE_BODY);
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

/**
 * Assert that every rendered result row is sized to its content and does not
 * overlap its neighbours. A row clamped to Obsidian's fixed button height is
 * shorter than a multi-line content column (name + snippet + breadcrumb): the
 * column overflows the row box and the row bleeds into the rows above and below.
 * A content-sized row contains its column and clears the next row's top.
 */
async function assertRowsFitAndDoNotOverlap(): Promise<void> {
  const boxes = await window.$$eval(
    RESULT_SELECTOR,
    (rows, mainSel) =>
      rows.map((row) => {
        const rowRect = row.getBoundingClientRect();
        const mainRect = (row.querySelector(mainSel) ?? row).getBoundingClientRect();
        return {
          rowTop: rowRect.top,
          rowBottom: rowRect.bottom,
          mainTop: mainRect.top,
          mainBottom: mainRect.bottom,
        };
      }),
    RESULT_MAIN_SELECTOR,
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    // The row grew tall enough to contain its name/snippet/breadcrumb column.
    expect(box.rowTop).toBeLessThanOrEqual(box.mainTop + LAYOUT_EPSILON_PX);
    expect(box.rowBottom).toBeGreaterThanOrEqual(box.mainBottom - LAYOUT_EPSILON_PX);
  }
  for (let i = 0; i < boxes.length - 1; i += 1) {
    // No row's bottom edge crosses into the row below it.
    expect(boxes[i].rowBottom).toBeLessThanOrEqual(boxes[i + 1].rowTop + LAYOUT_EPSILON_PX);
  }
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
  // The content match renders a multi-line row (name + body snippet); it must be
  // sized to that content rather than clamped to the fixed button height.
  await assertRowsFitAndDoNotOverlap();
});

test('a word present in a body only as a gapped subsequence returns no note', async () => {
  await runSearch(GAPPED_WORD);
  // The letters e-x-e-c-u-t-e appear in order in one client's body, but the word
  // itself never does; body matching is a strict substring, so no note surfaces.
  await expect.poll(sortedResultNames, { timeout: RESULT_TIMEOUT_MS }).toEqual([]);
});

test('adjacent result rows do not overlap when several are rendered', async () => {
  // "Seed" name-matches both the baked Seed Client and Seed Engagement, so the
  // list renders more than one row — the engagement carrying a Client › Engagement
  // breadcrumb is multi-line. This exercises the adjacent-row non-overlap check,
  // not only the single-row fit check the body-match test covers.
  await runSearch(MULTI_ROW_TERM);
  await expect
    .poll(async () => (await window.$$(RESULT_SELECTOR)).length, { timeout: RESULT_TIMEOUT_MS })
    .toBeGreaterThanOrEqual(2);
  await assertRowsFitAndDoNotOverlap();
});
