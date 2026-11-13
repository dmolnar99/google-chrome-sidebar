import { Controller } from '@/src/background/controller';
import { onCommand } from '@/src/messages';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  const controller = new Controller();
  onCommand((command) => controller.handle(command));
  browser.tabs.onRemoved.addListener((tabId) => controller.onTabRemoved(tabId));
  browser.tabs.onAttached.addListener((tabId, info) => controller.onTabAttached(tabId, info.newWindowId));
  browser.tabs.onReplaced.addListener((added, removed) => controller.onTabReplaced(added, removed));
  controller.init().catch(console.error);
});
