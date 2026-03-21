import { Page } from '@playwright/test';
import { ObsidianWindow } from './types';

/**
 * Wait until Dataview has indexed at least `minCount` pages matching `tag`.
 * Polls via page.waitForFunction. Throws on timeout.
 */
export async function waitForDataviewIndex(
  page: Page,
  tag: string,
  minCount = 1,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    (args: { tag: string; minCount: number }) => {
      const obsApp = (window as unknown as ObsidianWindow).app;
      const dv = (
        obsApp?.plugins as unknown as {
          plugins?: {
            dataview?: { api?: { pages: (t: string) => ArrayLike<unknown> } };
          };
        }
      )?.plugins?.dataview?.api;
      if (!dv) return false;
      return dv.pages(args.tag).length >= args.minCount;
    },
    { tag, minCount },
    { timeout },
  );
}
