// Generates Chrome Web Store images from the built extension (run `pnpm build` first):
// 1280×800 screenshots in store/screenshots/ and the 440×280 promo tile in store/.
// Uses a demo sidebar of public websites (visited once so Chrome knows their icons).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.resolve('.output/chrome-mv3');
const OUT = 'store/screenshots';
const THEME = '#6cbad9';

const favorites = [
  ['YouTube', 'https://www.youtube.com/'],
  ['GitHub', 'https://github.com/'],
  ['Figma', 'https://www.figma.com/'],
  ['Spotify', 'https://open.spotify.com/'],
  ['Reddit', 'https://www.reddit.com/'],
  ['Wikipedia', 'https://www.wikipedia.org/'],
];
const pinned = [
  ['Linear', 'https://linear.app/'],
  ['Notion', 'https://www.notion.so/'],
  ['Vercel', 'https://vercel.com/'],
];
const reading = [
  ['Hacker News', 'https://news.ycombinator.com/'],
  ['The Verge', 'https://www.theverge.com/'],
  ['MDN Web Docs', 'https://developer.mozilla.org/'],
];
const trips = [['Google Flights', 'https://www.google.com/travel/flights']];
const plainTabs = ['https://developer.chrome.com/docs/extensions/reference/api/sidePanel', 'https://web.dev/'];

function demoState() {
  const nodes = {};
  const item = (prefix) => ([title, url], i) => {
    const id = `${prefix}${i}`;
    nodes[id] = { kind: 'item', id, title, url };
    return id;
  };
  const folder = (id, title, childIds, collapsed) => {
    nodes[id] = { kind: 'folder', id, title, childIds, collapsed };
    return id;
  };
  return {
    version: 1,
    nodes,
    favorites: favorites.map(item('fav')),
    pinned: [
      ...pinned.map(item('pin')),
      folder('reading', 'Reading', reading.map(item('read')), false),
      folder('trips', 'Trips', trips.map(item('trip')), true),
    ],
  };
}

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const id = new URL(worker.url()).host;
const visit = async (page, url) => {
  // Wait for the network to settle so the site's icon has actually been fetched.
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
};

// Visit every demo site once so Chrome's favicon cache knows them, and save each site's address
// after redirects (otherwise items show the "back to saved URL" button straight away).
const warm = await context.newPage();
for (const list of [favorites, pinned, reading, trips]) {
  for (const entry of list) {
    await visit(warm, entry[1]);
    if (warm.url().startsWith('http')) entry[1] = warm.url();
  }
}
for (const url of plainTabs) await visit(warm, url);
await warm.close();
for (const page of context.pages()) if (page.url() === 'about:blank') await page.close();

await worker.evaluate(async ([state, theme]) => {
  await chrome.storage.local.set({ sidebar: state, themeColor: theme });
  await chrome.storage.session.set({ links: null });
}, [demoState(), THEME]);

const panel = await context.newPage();
await panel.setViewportSize({ width: 320, height: 640 });
await panel.goto(`chrome-extension://${id}/sidepanel.html`, { waitUntil: 'load' });
await panel.waitForSelector('.favorite');

// A couple of plain tabs for the Tabs list, and some open items, with Linear in front.
for (const url of plainTabs) await visit(await context.newPage(), url);
for (const title of ['Hacker News', 'Notion', 'Linear']) {
  await panel.locator('.pinned .row', { hasText: title }).click();
  await panel.waitForTimeout(1500);
}
await panel.locator('.favorite[title="GitHub"]').click();
await panel.waitForTimeout(1500);
await panel.locator('.pinned .row', { hasText: 'Linear' }).click();

/** The panel lists its own page as a tab, which a real side panel wouldn't; hide it for the shots. */
async function shootPanel(file) {
  await panel.waitForTimeout(1500); // background tabs only get timers once a second
  await panel.evaluate(() => {
    document.activeElement?.blur(); // a cancelled drag leaves focus (and its highlight) on the row
    for (const row of document.querySelectorAll('.tabs .row')) {
      if (row.textContent?.trim().startsWith('Sidebar')) row.style.display = 'none';
    }
  });
  await panel.screenshot({ path: file, scale: 'device' });
}

const tmp = fs.mkdtempSync('/tmp/sidebar-shots-');
const panelLight = path.join(tmp, 'panel-light.png');
await shootPanel(panelLight);

// Mid-drag: a tab on its way into the Reading folder.
const tabRow = panel.locator('.tabs .row').filter({ hasText: /Side Panel|sidePanel|chrome\.sidePanel/i }).first();
const target = panel.locator('.pinned .row', { hasText: 'Reading' });
const from = await tabRow.boundingBox();
const to = await target.boundingBox();
// Grab near the left edge and end up right of the folder's middle, so the dragged tab doesn't
// hide the folder it's being dropped into.
const start = { x: from.x + 24, y: from.y + from.height / 2 };
const end = { x: to.x + 100, y: to.y + to.height * 0.62 };
await panel.mouse.move(start.x, start.y);
await panel.mouse.down();
for (let i = 1; i <= 20; i++) {
  await panel.mouse.move(start.x + (end.x - start.x) * (i / 20), start.y + (end.y - start.y) * (i / 20));
}
const panelDrag = path.join(tmp, 'panel-drag.png');
await shootPanel(panelDrag);
await panel.keyboard.press('Escape');
await panel.mouse.up();
await panel.mouse.move(2, 2); // park the pointer in the top padding so nothing shows a hover highlight

await panel.emulateMedia({ colorScheme: 'dark' });
const panelDark = path.join(tmp, 'panel-dark.png');
await shootPanel(panelDark);
await panel.emulateMedia({ colorScheme: 'light' });

// The Arc import page, mid-import of the anonymised sample.
const options = await context.newPage();
await options.setViewportSize({ width: 600, height: 560 });
await options.goto(`chrome-extension://${id}/options.html`);
await options.locator('input[type=file]').first().setInputFiles(path.resolve('e2e/fixtures/arc-sample.json'));
await options.waitForSelector('.card');
const optionsShot = path.join(tmp, 'options.png');
await options.screenshot({ path: optionsShot, scale: 'device' });

await context.close();

// Compose the store images.
const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const icon = b64('public/icon/128.png');
const css = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 800px; overflow: hidden; font-family: system-ui, sans-serif; letter-spacing: -0.2px;
         background: radial-gradient(1200px 700px at 85% 110%, #5fa9cb 0%, transparent 60%), linear-gradient(135deg, #e7f3f8, #b9dceb); color: #0c2a37; }
  .wrap { display: flex; align-items: center; gap: 64px; height: 100%; padding: 0 72px; }
  .copy { flex: 1; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 22px; margin-bottom: 28px; }
  .brand img { width: 44px; height: 44px; margin: -6px; }
  h1 { font-size: 46px; line-height: 1.12; font-weight: 750; letter-spacing: -1.2px; }
  p { margin-top: 18px; font-size: 21px; line-height: 1.45; color: #3d5b68; max-width: 470px; }
  .window { flex: none; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 30px 80px rgba(12, 42, 55, 0.28), 0 0 0 1px rgba(12, 42, 55, 0.08); }
  .bar { height: 38px; background: #eef1f3; display: flex; align-items: center; gap: 8px; padding: 0 14px; }
  .bar i { width: 12px; height: 12px; border-radius: 50%; background: #d6dadd; display: block; }
  .bar .url { margin-left: 18px; height: 22px; flex: 1; border-radius: 11px; background: #fff; }
  .body { display: flex; height: 680px; }
  .body > img { width: 340px; height: 680px; display: block; }
  .page { width: 250px; background: #fafbfc; padding: 36px 28px; border-left: 1px solid #e6e9eb; }
  .page div { height: 12px; border-radius: 6px; background: #e8ecee; margin-bottom: 14px; }
  .page .h { height: 26px; width: 70%; background: #dfe4e7; margin-bottom: 26px; }
  .shot { flex: none; border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px rgba(12, 42, 55, 0.25); }
  .shot img { display: block; width: 600px; }
  .dark body, body.dark { background: radial-gradient(1200px 700px at 85% 110%, #1f4b5e 0%, transparent 60%), linear-gradient(135deg, #17242b, #0e171c); color: #e8f2f6; }
  body.dark p { color: #9fb5bf; }
  body.dark .window { background: #1c1d1f; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06); }
  body.dark .bar { background: #2a2b2e; } body.dark .bar i { background: #44464a; } body.dark .bar .url { background: #1c1d1f; }
  body.dark .page { background: #202124; border-color: #2e3033; } body.dark .page div { background: #2c2e31; }
`;
const brand = `<div class="brand"><img src="${icon}">Sidebar</div>`;
const browserWindow = (panelImg) =>
  `<div class="window"><div class="bar"><i></i><i></i><i></i><span class="url"></span></div><div class="body"><img src="${b64(panelImg)}"><div class="page"><div class="h"></div>${'<div></div>'.repeat(3)}<div style="width:60%"></div><br>${'<div></div>'.repeat(4)}<div style="width:45%"></div></div></div></div>`;
const slide = (title, text, visual, cls = '') =>
  `<!doctype html><meta charset="utf-8"><style>${css}</style><body class="${cls}"><div class="wrap"><div class="copy">${brand}<h1>${title}</h1><p>${text}</p></div>${visual}</div></body>`;

const slides = [
  ['1-overview', slide('Favorites, pinned tabs and folders, in Chrome’s side panel.', 'Your favorite sites one click away, pinned tabs that remember where they belong, and folders to keep it all tidy.', browserWindow(panelLight))],
  ['2-drag-and-drop', slide('Drag a tab in to keep it. Drag it out to let go.', 'Pin tabs by dragging them into the sidebar or any folder, reorder everything, and drag items back down to unpin them.', browserWindow(panelDrag))],
  ['3-import-from-arc', slide('Bring your Arc sidebar over in one step.', 'Import Favorites, pinned tabs, folders and your Space’s color straight from Arc’s sidebar file. Nothing leaves your computer.', `<div class="shot"><img src="${b64(optionsShot)}"></div>`)],
  ['4-dark-mode', slide('Tinted your way, light or dark.', 'Pick any color for the sidebar, or keep your Arc color. It follows your system’s light and dark mode.', browserWindow(panelDark), 'dark')],
  ['5-keyboard', slide('Keyboard first.', '⌥S opens and closes the sidebar, ⌥D pins the current tab, and you can jump to any Favorite with a shortcut of your choice.', browserWindow(panelLight))],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const [name, html] of slides) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(
  `<!doctype html><meta charset="utf-8"><style>${css} body { width: 440px; height: 280px; } .t { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 14px; text-align: center; } .t img { width: 112px; margin: -10px; } .t h1 { font-size: 34px; letter-spacing: -0.8px; } .t p { margin: 0; font-size: 16px; max-width: 320px; }</style><body><div class="t"><img src="${icon}"><h1>Sidebar</h1><p>Favorites, pinned tabs and folders in Chrome’s side panel</p></div></body>`,
);
await page.screenshot({ path: 'store/promo-440x280.png' });
await browser.close();
console.log(`wrote ${slides.length} screenshots to ${OUT}/ and store/promo-440x280.png`);
