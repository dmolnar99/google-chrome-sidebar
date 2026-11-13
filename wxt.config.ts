import { defineConfig } from 'wxt';

const favoriteCommands = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [`favorite-${i + 1}`, { description: `Go to Favorite ${i + 1}` }]),
);

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Sidebar',
    description: 'An Arc-style sidebar for Chrome: Favorites, pinned items and folders.',
    permissions: ['sidePanel', 'storage', 'tabs', 'favicon'],
    action: { default_title: 'Open Sidebar' },
    // Chrome allows at most four suggested keys; the rest are assignable in chrome://extensions/shortcuts.
    commands: {
      'toggle-sidebar': { suggested_key: { default: 'Alt+S' }, description: 'Open or close the sidebar' },
      'toggle-pin': { suggested_key: { default: 'Alt+D' }, description: 'Pin or unpin the current tab' },
      ...favoriteCommands,
    },
  },
});
