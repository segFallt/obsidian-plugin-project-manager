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
  BLANK_LINE,
  FM_TAGS_KEY,
  FRONTMATTER_FENCE,
  SEED_CLIENT,
  SEED_ENGAGEMENT,
  YAML_KEY_SUFFIX,
  YAML_LIST_ITEM_PREFIX,
  YAML_VALUE_SEPARATOR,
} from '../helpers/constants';
import {
  COMMAND_NAMES,
  CSS_CLS,
  DEFAULT_FOLDERS,
  EMPTY_LENGTH,
  EMPTY_QUERY,
  ENTITY_TAGS,
  FM_KEY,
  MD_EXTENSION,
  NL,
  PM_SEARCH_TEXT,
  STATUS,
} from '../../src/constants';

/**
 * End-to-end coverage for the contextual search panel (pm-search) against real
 * Obsidian. Names match when they contain the query (case-insensitive) anywhere,
 * so the spec covers a name query, a mid-name query with its highlight, a name
 * that holds the query only as a gapped subsequence (no match), a query that
 * matches only a note's body text, a body gapped subsequence (no match), and the
 * empty-query browse list. Three clients are seeded next to the baked Seed Client
 * and Seed Engagement: one found by its name, one found only by a distinctive
 * word in its body, and one whose body holds a word only as a gapped subsequence.
 */

/** A term shared by two baked entity names, so a query on it renders multiple rows. */
const MULTI_ROW_TERM = 'Seed';
/** The distinctive term in the name-matched client's name; also used as the name query. */
const NAME_MATCH_TERM = 'Northwind';
/** A client found by its name (the term is part of the name). */
const NAME_MATCH_CLIENT = `${NAME_MATCH_TERM} Trading`;
/** The body of the name-matched client; it contains none of the spec's queries. */
const NAME_MATCH_BODY = 'A wholesale trading company.';
/** A substring from the middle of the name term, in the name's own casing. */
const NAME_MID_TERM = 'thwind';
/** The letters of the name term in order but with gaps: a gapped subsequence, not a substring. */
const NAME_GAPPED_SUBSEQUENCE = 'nrthwnd';
/** A client whose distinctive term appears only in its body, never its name. */
const BODY_MATCH_CLIENT = 'Seabird Consulting';
/** The distinctive term present only in BODY_MATCH_CLIENT's body; also the body query. */
const BODY_ONLY_WORD = 'pineapple';
/** The body of BODY_MATCH_CLIENT, carrying BODY_ONLY_WORD. */
const BODY_MATCH_BODY = `The team is fond of ${BODY_ONLY_WORD}.`;
/**
 * A word whose letters appear in order across a client's body, though the word
 * itself never occurs there: a gapped subsequence, not a real substring.
 */
const GAPPED_WORD = 'execute';
/** A client whose body contains GAPPED_WORD only as a gapped subsequence. */
const GAPPED_SUBSEQUENCE_CLIENT = 'Riverstone Partners';
/** A body carrying the letters e-x-e-c-u-t-e in order, but never the word itself. */
const GAPPED_SUBSEQUENCE_BODY = 'Everyone expected the crew to unite here early.';
/**
 * A query that no fixture or seeded name or body contains, so it always renders
 * the no-match state. Searching for it resets the panel to a known empty state.
 */
const NO_MATCH_SENTINEL = 'zqxj-reset-sentinel';
/** Every entity in the vault, in name order: the empty query browses exactly these. */
const BROWSE_NAMES_IN_ORDER = [
  NAME_MATCH_CLIENT,
  GAPPED_SUBSEQUENCE_CLIENT,
  BODY_MATCH_CLIENT,
  SEED_CLIENT,
  SEED_ENGAGEMENT,
];
/** Dataview-index wait target: the baked Seed Client plus the three clients seeded here. */
const SEEDED_CLIENT_COUNT = 4;
/** Dataview-index wait target: the baked Seed Engagement. */
const SEEDED_ENGAGEMENT_COUNT = 1;
/** A substring name match highlights one run: the query's first occurrence in the name. */
const NAME_HIGHLIGHT_COUNT = 1;
/** The fewest rows the multi-row query must render for the adjacent-row check to apply. */
const MIN_MULTI_ROW_COUNT = 2;

const INPUT_SELECTOR = `.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`;
const RESULT_NAME_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_NAME}`;
const RESULT_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT}`;
const RESULT_MAIN_SELECTOR = `.${CSS_CLS.PM_SEARCH_RESULT_MAIN}`;
const HIGHLIGHT_SELECTOR = `.${CSS_CLS.PM_SEARCH_HL}`;
const EMPTY_TITLE_SELECTOR = `.${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`;

/** Timeout for the panel to settle on the typed query's results (ms). */
const RESULT_TIMEOUT_MS = 5_000;

/** Sub-pixel slack for layout box comparisons; browsers round fractional pixels. */
const LAYOUT_EPSILON_PX = 1;

/** The index of the first rendered result row. */
const FIRST_ROW_INDEX = 0;
/** The distance from a result row to the row directly below it. */
const NEXT_ROW_STEP = 1;

/** The text read for a result name element that has no text content. */
const NO_TEXT = '';

/** Writes a `#client` note carrying `body` under the vault's clients folder. */
function seedClient(vaultPath: string, name: string, body: string): void {
  const dir = resolve(vaultPath, DEFAULT_FOLDERS.clients);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, `${name}${MD_EXTENSION}`),
    [
      FRONTMATTER_FENCE,
      `${FM_TAGS_KEY}${YAML_KEY_SUFFIX}`,
      `${YAML_LIST_ITEM_PREFIX}${JSON.stringify(ENTITY_TAGS.client)}`,
      `${FM_KEY.STATUS}${YAML_KEY_SUFFIX}${YAML_VALUE_SEPARATOR}${STATUS.ACTIVE}`,
      FRONTMATTER_FENCE,
      BLANK_LINE,
      body,
      BLANK_LINE,
    ].join(NL),
  );
}

let ctx: ObsidianSpecContext;
let window: Page;

test.beforeAll(async () => {
  ctx = await setupObsidianSpec({
    seedVault: (vaultPath) => {
      // Three clients: one found by its name, one only by a distinctive body word,
      // and one whose body carries GAPPED_WORD only as a gapped subsequence.
      seedClient(vaultPath, NAME_MATCH_CLIENT, NAME_MATCH_BODY);
      seedClient(vaultPath, BODY_MATCH_CLIENT, BODY_MATCH_BODY);
      seedClient(vaultPath, GAPPED_SUBSEQUENCE_CLIENT, GAPPED_SUBSEQUENCE_BODY);
    },
  });
  window = await ctx.getPage();
  await waitForDataviewIndex(window, ENTITY_TAGS.client, SEEDED_CLIENT_COUNT);
  await waitForDataviewIndex(window, ENTITY_TAGS.engagement, SEEDED_ENGAGEMENT_COUNT);
});

test.afterAll(async () => {
  await teardownObsidianSpec(ctx);
});

test.beforeEach(async () => {
  window = await ctx.getPage();
});

/** Waits until the panel shows the no-match state echoing `query`. */
async function expectNoMatchFor(page: Page, query: string): Promise<void> {
  await expect(page.locator(EMPTY_TITLE_SELECTOR)).toHaveText(PM_SEARCH_TEXT.noMatchTitle(query), {
    timeout: RESULT_TIMEOUT_MS,
  });
}

/**
 * Opens the search panel and types `query` from a known empty state.
 *
 * The panel keeps its query and rows between tests, and a typed query only runs
 * after the search debounce. The helper first searches for NO_MATCH_SENTINEL and
 * waits for its no-match title, so the panel provably shows zero rows before
 * `query` is typed. Any rows rendered afterwards therefore come from `query`.
 */
async function searchFor(page: Page, query: string): Promise<void> {
  await selectCommand(page, COMMAND_NAMES.OPEN_SEARCH);
  const input = await page.waitForSelector(INPUT_SELECTOR, { timeout: RESULT_TIMEOUT_MS });
  await input.fill(NO_MATCH_SENTINEL);
  await expectNoMatchFor(page, NO_MATCH_SENTINEL);
  await input.fill(query);
}

/** The result names currently rendered in the panel, in rendered order. */
async function resultNames(page: Page): Promise<string[]> {
  return page.$$eval(
    RESULT_NAME_SELECTOR,
    (els, noText) => els.map((el) => el.textContent ?? noText),
    NO_TEXT,
  );
}

/** The result names currently rendered in the panel, sorted for order-independent comparison. */
async function sortedResultNames(page: Page): Promise<string[]> {
  return (await resultNames(page)).sort();
}

/**
 * Assert that every rendered result row is sized to its content and does not
 * overlap its neighbours. A row clamped to Obsidian's fixed button height is
 * shorter than a multi-line content column (name + snippet + breadcrumb): the
 * column overflows the row box and the row bleeds into the rows above and below.
 * A content-sized row contains its column and clears the next row's top.
 */
async function assertRowsFitAndDoNotOverlap(page: Page): Promise<void> {
  const boxes = await page.$$eval(
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
  expect(boxes.length).toBeGreaterThan(EMPTY_LENGTH);
  for (const box of boxes) {
    // The row grew tall enough to contain its name/snippet/breadcrumb column.
    expect(box.rowTop).toBeLessThanOrEqual(box.mainTop + LAYOUT_EPSILON_PX);
    expect(box.rowBottom).toBeGreaterThanOrEqual(box.mainBottom - LAYOUT_EPSILON_PX);
  }
  for (let i = FIRST_ROW_INDEX; i < boxes.length - NEXT_ROW_STEP; i += NEXT_ROW_STEP) {
    // No row's bottom edge crosses into the row below it.
    expect(boxes[i].rowBottom).toBeLessThanOrEqual(
      boxes[i + NEXT_ROW_STEP].rowTop + LAYOUT_EPSILON_PX,
    );
  }
}

// Every test searches through searchFor, so the panel starts each query from the
// sentinel's empty no-match state. A test expecting rows polls the row names; a
// test expecting no result waits for the no-match title echoing its own query,
// because an empty list alone would also match the sentinel state.

test('a name query returns the matching entity', async () => {
  await searchFor(window, NAME_MATCH_TERM);
  await expect.poll(() => sortedResultNames(window), { timeout: RESULT_TIMEOUT_MS }).toEqual([NAME_MATCH_CLIENT]);
});

test('a query from the middle of a name returns the entity and highlights the match', async () => {
  await searchFor(window, NAME_MID_TERM);
  await expect.poll(() => sortedResultNames(window), { timeout: RESULT_TIMEOUT_MS }).toEqual([NAME_MATCH_CLIENT]);
  // Exactly one highlight: the matched substring, in the name's own casing.
  const highlights = window
    .locator(RESULT_NAME_SELECTOR, { hasText: NAME_MATCH_CLIENT })
    .locator(HIGHLIGHT_SELECTOR);
  await expect(highlights).toHaveCount(NAME_HIGHLIGHT_COUNT);
  await expect(highlights).toHaveText(NAME_MID_TERM);
});

test('a name present only as a gapped subsequence returns no note', async () => {
  await searchFor(window, NAME_GAPPED_SUBSEQUENCE);
  // The letters n-r-t-h-w-n-d appear in order in a client's name, but the query
  // itself never does; name matching is a substring match, so no note surfaces.
  await expectNoMatchFor(window, NAME_GAPPED_SUBSEQUENCE);
});

test('a word only in a note body returns that note', async () => {
  await searchFor(window, BODY_ONLY_WORD);
  // Exactly the body-only client: the name-only client, whose name and body never
  // contain the word, is absent, so this is a content match, not browse.
  await expect.poll(() => sortedResultNames(window), { timeout: RESULT_TIMEOUT_MS }).toEqual([BODY_MATCH_CLIENT]);
  // The content match renders a multi-line row (name + body snippet); it must be
  // sized to that content rather than clamped to the fixed button height.
  await assertRowsFitAndDoNotOverlap(window);
});

test('a word present in a body only as a gapped subsequence returns no note', async () => {
  await searchFor(window, GAPPED_WORD);
  // The letters e-x-e-c-u-t-e appear in order in one client's body, but the word
  // itself never does; body matching is a substring match, so no note surfaces.
  await expectNoMatchFor(window, GAPPED_WORD);
});

test('an empty query browses every entity in name order', async () => {
  await searchFor(window, EMPTY_QUERY);
  // Rendered order, unsorted, so an ordering fault in the browse list fails here.
  await expect.poll(() => resultNames(window), { timeout: RESULT_TIMEOUT_MS }).toEqual(BROWSE_NAMES_IN_ORDER);
});

test('adjacent result rows do not overlap when several are rendered', async () => {
  // "Seed" name-matches both the baked Seed Client and Seed Engagement, so the
  // list renders more than one row, and the engagement carrying a
  // Client › Engagement breadcrumb is multi-line. This exercises the adjacent-row
  // non-overlap check, not only the single-row fit check the body-match test covers.
  await searchFor(window, MULTI_ROW_TERM);
  await expect
    .poll(async () => (await window.$$(RESULT_SELECTOR)).length, { timeout: RESULT_TIMEOUT_MS })
    .toBeGreaterThanOrEqual(MIN_MULTI_ROW_COUNT);
  await assertRowsFitAndDoNotOverlap(window);
});
