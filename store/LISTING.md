# Chrome Web Store listing — Sidebar

Paste-ready text for the Chrome Web Store Developer Dashboard. The images are in this folder; regenerate them with `pnpm screenshots`.

## Store listing

**Name:** Sidebar

**Summary** (max 132 characters; the store takes it from the manifest's `description`, set in `wxt.config.ts`):
> Favorites, pinned tabs and folders in Chrome's side panel. Drag tabs in to keep them, import from Arc, all on your device.

**Category:** Productivity → Tools (or Workflow & Planning)

**Language:** English

**Description:**

> Sidebar puts your favorite sites, pinned tabs and folders in Chrome's side panel, next to the page you're on.
>
> FAVORITES
> Your most-used sites as big icon tiles at the top. Click one to jump to its tab, or open it if it isn't open yet. Favorite tabs are pinned in Chrome automatically.
>
> PINNED TABS THAT REMEMBER
> Pinned items stay in the sidebar after you close their tab. Clicking one brings it back at the address you saved. If you browse away inside a pinned tab, one click takes you back.
>
> FOLDERS
> Group pinned items into folders, nested as deep as you like. Open and close them with a click.
>
> DRAG AND DROP
> Drag an open tab into the sidebar or a folder to keep it. Drag items around to reorder them. Drag an item down into your tabs to unpin it.
>
> SPLIT VIEW
> Right-click any item or tab and choose Open in Split View to see it side by side with the page you're on (Chrome 155 or later).
>
> IMPORT FROM ARC
> Moving from the Arc browser? Import your Favorites, pinned tabs, folders and your Space's color from Arc's sidebar file in one step.
>
> MAKE IT YOURS
> Tint the sidebar with any color. It follows your system's light and dark mode.
>
> KEYBOARD SHORTCUTS
> ⌥S opens and closes the sidebar, ⌥D pins the current tab, and you can jump to any of your first nine Favorites with shortcuts you choose in chrome://extensions/shortcuts.
>
> PRIVATE BY DESIGN
> Everything stays in your Chrome profile on this device. No accounts, no servers, no analytics, no network requests. Export a backup file whenever you like.
>
> Tip: Chrome lets you choose which side the panel opens on. Go to chrome://settings/appearance and set it to the left.
>
> Sidebar is an independent project. It isn't affiliated with or endorsed by The Browser Company.

**Images:**
- Store icon (128×128): `public/icon/128.png`
- Screenshots (1280×800): `store/screenshots/1-overview.png` … `5-keyboard.png`
- Small promo tile (440×280): `store/promo-440x280.png`

## Privacy practices tab

**Single purpose:**
> Shows and manages the user's favorite sites, pinned tabs, folders and open tabs in Chrome's side panel.

**Permission justifications:**
- `sidePanel`: The extension's whole interface is a side panel.
- `tabs`: Lists the window's open tabs in the panel, opens and switches tabs when the user clicks a saved item, pins Favorite tabs, and reads a tab's URL and title when the user saves it. Nothing is sent off the device.
- `storage`: Saves the user's sidebar (titles, URLs, folders) and theme color locally in chrome.storage.
- `favicon`: Shows site icons from Chrome's local favicon cache.

**Remote code:** No, I am not using remote code. All code ships in the package.

**Data usage.** Sidebar handles tab URLs and titles (which Google classes as "web history") **only on the device**. It never transmits or collects them. Recommended answers:
- Data collected: none. No category ticked, since nothing leaves the device. If a reviewer asks, explain that URLs and titles of tabs the user chooses to save are stored locally in chrome.storage only.
- Certify all three: not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL:** host `PRIVACY.md` publicly (for example on GitHub Pages or as a public GitHub file) and paste its URL here.

## Before submitting

- [ ] Publish `PRIVACY.md` at a public URL.
- [ ] Bump `version` in `package.json`, then run `pnpm zip` and upload `.output/sidebar-<version>-chrome.zip`.
- [ ] Run `pnpm test && pnpm test:e2e`.
- [ ] Pay the one-time developer registration fee and verify the publisher email.
