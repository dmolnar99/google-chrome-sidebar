/// <reference types="chrome" />
import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'node:path';

export const PAGE = (name: string) => `http://localhost:4317/page/${name}`;
const EXTENSION = path.resolve('.output/chrome-mv3');

interface Fixtures {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  /** The side panel, opened as a page (Playwright can't reach Chrome's real side panel UI). */
  panel: Page;
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
  panel: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await use(page);
  },
});

export { expect };

/** Imports e2e/fixtures/arc-sample.json through the settings page, like a user would. */
export async function importArcSample(context: BrowserContext, extensionId: string) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  options.on('dialog', (d) => d.accept());
  await options.locator('input[type=file]').first().setInputFiles(path.resolve('e2e/fixtures/arc-sample.json'));
  await options.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(options.getByText('Imported.')).toBeVisible();
  await options.close();
}

/** Chrome's view of the tabs, straight from the extension's service worker. */
export function queryTabs(worker: Worker, query: { url?: string; pinned?: boolean } = {}) {
  return worker.evaluate((q) => chrome.tabs.query(q), query);
}

export function readSidebar(worker: Worker) {
  return worker.evaluate(async () => (await chrome.storage.local.get('sidebar')).sidebar as {
    favorites: string[];
    pinned: string[];
    nodes: Record<string, { kind: string; title: string; url?: string; childIds?: string[] }>;
  });
}

/** Drags with real pointer events, in small steps so dnd-kit picks up the movement. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  }
  await page.waitForTimeout(50);
  await page.mouse.up();
}

/** A point inside an element: `fy` is the vertical fraction (0 = top edge, 1 = bottom). */
export async function pointIn(page: Page, selector: ReturnType<Page['locator']>, fy = 0.5) {
  const box = (await selector.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height * fy };
}
