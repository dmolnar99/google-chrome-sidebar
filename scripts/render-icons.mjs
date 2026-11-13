// Renders assets/icon*.svg to public/icon/{16,32,48,128}.png (WXT adds them to the manifest).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, file] of [[16, 'icon-small'], [32, 'icon-small'], [48, 'icon'], [128, 'icon']]) {
  const svg = fs.readFileSync(`assets/${file}.svg`, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.locator('svg').screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
}
await browser.close();
console.log('icons written to public/icon/');
