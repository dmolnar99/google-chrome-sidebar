# Sidebar — plan

A Chrome extension that recreates the Arc browser sidebar (Favorites + pinned folders), built for personal use first and the Chrome Web Store later.

## Constraints we accept

- Chrome's horizontal tab strip stays visible; extensions can't hide or replace it. We ignore it.
- `chrome.sidePanel` side and width are user-controlled (set the panel to the left in Chrome settings). No auto-hide.
- `sidePanel.open()` requires a user gesture; the panel is per-window.

## v1 scope

In:
- **Favorites**: icon-tile grid at the top.
- **Pinned section**: items and folders, folders nestable to any depth.
- **Tabs list**: plain list of this window's open tabs that aren't linked to an item. No auto-archive.
- One-time **Arc import**.

Out (for now): Spaces, Today auto-archive, Archive, Split View, Peek, Little Arc, Boosts, Easels, command bar, sync, custom themes.

## Decisions

### Surface
- `chrome.sidePanel` (MV3).

### Data model
- The extension owns sidebar data in `chrome.storage.local`. Items exist whether or not they have a live tab. Nothing goes into Chrome bookmarks.
- Tree: Favorites (flat) + Pinned (items and folders, nested).
- Same saved sidebar in every window.
- No sync. Manual JSON export/import as backup.

### Item ↔ tab linking
- Each item has at most one live tab **per window**.
- Clicking an item focuses its tab in the current window, or opens the saved URL.
- Navigating inside a linked tab keeps the link. A "back to saved URL" button appears once the URL has drifted.
- The **X** on an item closes its tab and keeps the item. Delete, rename and edit URL are in the right-click menu.
- Closing a linked tab any other way also keeps the item.
- The **background service worker** owns item–tab links, stored in `chrome.storage.session`. After a browser restart it re-links by URL matching, because tab IDs change. The panel only displays what the worker reports.
- Favorite tabs become Chrome-pinned tabs. Pinned items' tabs are normal Chrome tabs. Pinning only changes when a tab's Favorite status changes, so a tab the user unpins by hand stays unpinned.

### Interaction
- Add items: drag from Tabs into Favorites/Pinned/a folder; right-click a tab → "Add to Favorites" / "Pin"; keyboard shortcut.
- Drag-and-drop everywhere: reorder within sections, into and out of (nested) folders, between sections. Dragging an item into Tabs unpins it and keeps its tab open.
- Folders: click to collapse/expand, state persisted. Rename/delete via right-click menu. Deleting a non-empty folder asks for confirmation. No "open all".
- The Tabs list follows Chrome's tab order (new tabs at the bottom). Dragging in the list moves the real Chrome tab.

### Keyboard shortcuts (`chrome.commands`)
- Defaults: toggle sidebar (⌥S), pin/unpin current tab (⌥D). Pin/unpin on a Favorite or pinned item's tab removes the item and keeps the tab.
- Toggle works by open panels holding a port to the worker; closing asks the panel to `window.close()`.
- "Go to Favorite 1–9": declared with no keys set, assignable in `chrome://extensions/shortcuts`.

### Favicons
- Chrome's `_favicon` API (`favicon` permission). Arc's favicon cache is not imported.

### Arc import
- Source: `~/Library/Application Support/Arc/StorableSidebar.json`, picked via a file input on the options page.
- Arc Favorites (top-level container) → Favorites.
- Each Arc Space's pinned items → one top-level folder named after the Space. Nested folders are kept. With only one Space, its pinned items go straight into Pinned.
- Folders inside Favorites and split views are flattened (their tabs are kept). Unsupported kinds such as easels are skipped and listed in the import summary.
- Import replaces the current sidebar, asking first if it isn't empty.
- Arc's format: flat `items` list linked by `parentID` / `childrenIds`; `spaceModels` hold each Space's `containerIDs`; `topAppsContainerIDs` hold Favorites.
- A private backup lives in `fixtures/private/` (git-ignored). Committed test inputs are a small anonymised version of it.

### Look
- Arc-style: no borders, rounded rows, square Favorite tiles, light/dark following the system setting.

### Stack
- TypeScript, WXT, React, dnd-kit, Vitest.
- Permissions kept to a minimum: `sidePanel`, `tabs`, `tabGroups` (only if needed), `storage`, `favicon`. No code loaded from the internet.

### Testing
- Vitest unit tests cover the data model (move/nest/delete), the Arc import, and linking logic, with Chrome's APIs faked.
- Panel UI is checked by hand. Playwright tests come before the store release.

### Store readiness
- Working name "Sidebar". No "Arc" in the name or branding (The Browser Company's trademark).
- Store polish, onboarding and privacy policy come later.

## Milestones

Each step ends with something you can try in Chrome. All six are built (v1 complete, 2026-11-13).

1. Scaffold the project (WXT + React), open the side panel, keep the data model in storage.
2. Arc import from the real file in `fixtures/private/`.
3. Favorites and pinned items, with tab linking handled in the background worker.
4. Folders and drag-and-drop.
5. Tabs list.
6. Keyboard shortcuts; Favorite tabs as Chrome-pinned tabs.
