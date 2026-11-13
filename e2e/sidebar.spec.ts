import { drag, expect, importArcSample, PAGE, pointIn, queryTabs, readSidebar, test } from './fixtures';

// Rows in the sidebar tree (pinned items and folders); the Tabs list is queried separately.
const row = (panel: import('@playwright/test').Page, title: string) => panel.locator('.pinned .row', { hasText: title });

test.beforeEach(async ({ context, extensionId, panel }) => {
  await importArcSample(context, extensionId);
  await expect(row(panel, 'News page')).toBeVisible();
});

test('imports the Arc sidebar: Favorites, items, nested folder and color', async ({ panel }) => {
  await expect(panel.locator('.favorite')).toHaveCount(3);
  await expect(panel.locator('.favorite[title="Mail page"]')).toBeVisible();
  await expect(row(panel, 'Work')).toBeVisible();
  await expect(row(panel, 'Docs page')).toBeVisible();
  await expect(row(panel, 'Today page')).toHaveCount(0); // open Arc tabs aren't imported
  // Tinted with the Space's color rather than the neutral default.
  const bg = await panel.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(228, 227, 225)');
});

test('clicking an item opens its tab once; × closes the tab and keeps the item', async ({ context, worker, panel }) => {
  const opened = context.waitForEvent('page');
  await row(panel, 'News page').click();
  await (await opened).waitForURL(PAGE('news'));

  await row(panel, 'News page').click();
  await panel.waitForTimeout(300);
  expect(await queryTabs(worker, { url: PAGE('news') })).toHaveLength(1);

  await row(panel, 'News page').hover();
  await row(panel, 'News page').getByTitle('Close tab').click();
  await expect.poll(() => queryTabs(worker, { url: PAGE('news') })).toHaveLength(0);
  await expect(row(panel, 'News page')).toBeVisible();
});

test('a Favorite opens as a pinned Chrome tab', async ({ context, worker, panel }) => {
  const opened = context.waitForEvent('page');
  await panel.locator('.favorite[title="Mail page"]').click();
  await (await opened).waitForURL(PAGE('mail'));
  await expect.poll(async () => (await queryTabs(worker, { url: PAGE('mail') }))[0]?.pinned).toBe(true);
});

test('shows plain tabs and saves one by dragging it into a folder', async ({ context, worker, panel }) => {
  const extra = await context.newPage();
  await extra.goto(PAGE('extra'));
  await panel.bringToFront();
  const tabRow = panel.locator('.tabs .row', { hasText: 'Extra page' });
  await expect(tabRow).toBeVisible();

  await drag(panel, await pointIn(panel, tabRow), await pointIn(panel, row(panel, 'Work')));
  await expect.poll(async () => {
    const s = await readSidebar(worker);
    const work = Object.values(s.nodes).find((n) => n.title === 'Work')!;
    return work.childIds!.map((id) => s.nodes[id]!.title);
  }).toEqual(['Docs page', 'Calendar page', 'Extra page']);
  await expect(panel.locator('.tabs .row', { hasText: 'Extra page' })).toHaveCount(0);
});

test('dragging an item down into Tabs unpins it and keeps its tab', async ({ context, worker, panel }) => {
  const opened = context.waitForEvent('page');
  await row(panel, 'News page').click();
  await (await opened).waitForURL(PAGE('news'));
  await panel.bringToFront();

  await drag(panel, await pointIn(panel, row(panel, 'News page')), await pointIn(panel, panel.locator('.new-tab'), 0.9));
  await expect(panel.locator('.tabs .row', { hasText: 'News page' })).toBeVisible();
  await expect(panel.locator('.pinned .row', { hasText: 'News page' })).toHaveCount(0);
  expect(await queryTabs(worker, { url: PAGE('news') })).toHaveLength(1);
});

test('rename, new folder and moving into it via the right-click menu and drag', async ({ worker, panel }) => {
  await row(panel, 'News page').click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Rename…' }).click();
  await panel.locator('.dialog input').fill('Morning news');
  await panel.keyboard.press('Enter');
  await expect(row(panel, 'Morning news')).toBeVisible();

  await row(panel, 'Work').click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'New folder inside' }).click();
  await panel.locator('.dialog input').fill('Reading');
  await panel.keyboard.press('Enter');
  await expect(row(panel, 'Reading')).toBeVisible();

  await drag(panel, await pointIn(panel, row(panel, 'Morning news')), await pointIn(panel, row(panel, 'Reading')));
  await expect.poll(async () => {
    const s = await readSidebar(worker);
    const reading = Object.values(s.nodes).find((n) => n.title === 'Reading')!;
    return reading.childIds!.map((id) => s.nodes[id]!.title);
  }).toEqual(['Morning news']);
});

test('reordering Favorites by drag', async ({ worker, panel }) => {
  const tile = (t: string) => panel.locator(`.favorite[title="${t}"]`);
  const end = await pointIn(panel, tile('Code page'));
  await drag(panel, await pointIn(panel, tile('Mail page')), { x: end.x + 20, y: end.y });
  await expect.poll(async () => {
    const s = await readSidebar(worker);
    return s.favorites.map((id) => s.nodes[id]!.title);
  }).toEqual(['Video page', 'Code page', 'Mail page']);
});

test('backup export and restore round-trip', async ({ context, extensionId, panel }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  options.on('dialog', (d) => d.accept());
  const download = options.waitForEvent('download');
  await options.getByRole('button', { name: 'Export…' }).click();
  const file = await (await download).path();

  await panel.bringToFront();
  await row(panel, 'News page').click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(row(panel, 'News page')).toHaveCount(0);

  await options.bringToFront();
  await options.locator('input[type=file]').nth(1).setInputFiles(file);
  await expect(options.getByText('3 Favorites, 3 pinned items and 1 folder')).toBeVisible();
  await options.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(options.getByText('Restored')).toBeVisible();
  await expect(row(panel, 'News page')).toBeVisible();
});

test('text renders at the intended size, not Chrome’s 75% default for extension pages', async ({ panel }) => {
  const size = await row(panel, 'News page').locator('.title').evaluate((el) => getComputedStyle(el).fontSize);
  expect(size).toBe('14px');
});

test.describe('split view', () => {
  const splitIds = async (worker: import('@playwright/test').Worker, ...urls: string[]) =>
    Promise.all(urls.map(async (url) => ((await queryTabs(worker, { url }))[0] as { splitViewId?: number } | undefined)?.splitViewId));

  test('opens a closed item in a new tab, split with the current tab', async ({ context, worker, panel }) => {
    const opened = context.waitForEvent('page');
    await row(panel, 'News page').click();
    await (await opened).waitForURL(PAGE('news'));

    await row(panel, 'Docs page').click({ button: 'right' });
    await panel.getByRole('menuitem', { name: 'Open in Split View' }).click();
    await expect.poll(async () => {
      const [news, docs] = await splitIds(worker, PAGE('news'), PAGE('docs'));
      return news !== undefined && news !== -1 && news === docs;
    }).toBe(true);
    // The new tab belongs to the item, so it doesn't show up as a plain tab.
    await expect(panel.locator('.tabs .row', { hasText: 'Docs page' })).toHaveCount(0);
  });

  test('moves an item’s open tab next to the current tab instead of duplicating it', async ({ context, worker, panel }) => {
    for (const name of ['News page', 'Docs page']) {
      const opened = context.waitForEvent('page');
      await row(panel, name).click();
      await opened;
    }
    // A plain tab in between, so the two aren't neighbours to begin with.
    await (await context.newPage()).goto(PAGE('between'));
    await row(panel, 'Docs page').click(); // Docs is now the current tab

    await row(panel, 'News page').click({ button: 'right' });
    await panel.getByRole('menuitem', { name: 'Open in Split View' }).click();
    await expect.poll(async () => {
      const [news, docs] = await splitIds(worker, PAGE('news'), PAGE('docs'));
      return news !== undefined && news !== -1 && news === docs;
    }).toBe(true);
    expect(await queryTabs(worker, { url: PAGE('news') })).toHaveLength(1);
  });

  test('splits a Favorite’s pinned tab with a normal tab by unpinning it', async ({ context, worker, panel }) => {
    const fav = context.waitForEvent('page');
    await panel.locator('.favorite[title="Mail page"]').click();
    await (await fav).waitForURL(PAGE('mail'));
    const news = context.waitForEvent('page');
    await row(panel, 'News page').click();
    await news;

    await panel.locator('.favorite[title="Mail page"]').click({ button: 'right' });
    await panel.getByRole('menuitem', { name: 'Open in Split View' }).click();
    await expect.poll(async () => {
      const [mail, newsId] = await splitIds(worker, PAGE('mail'), PAGE('news'));
      return mail !== undefined && mail !== -1 && mail === newsId;
    }).toBe(true);
    expect((await queryTabs(worker, { url: PAGE('mail') }))[0]?.pinned).toBe(false);
  });
});
