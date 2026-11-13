import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Sidebar',
    description: 'An Arc-style sidebar for Chrome: Favorites, pinned items and folders.',
    permissions: ['sidePanel', 'storage', 'tabs', 'favicon'],
    action: { default_title: 'Open Sidebar' },
  },
});
