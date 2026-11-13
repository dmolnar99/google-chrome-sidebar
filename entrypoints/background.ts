import { Controller } from '@/src/background/controller';
import { onCommand } from '@/src/messages';
import { trackPanels } from '@/src/panelPort';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  const controller = new Controller();
  const panels = trackPanels();
  onCommand((command) => controller.handle(command));
  browser.tabs.onRemoved.addListener((tabId) => controller.onTabRemoved(tabId));
  browser.tabs.onAttached.addListener((tabId, info) => controller.onTabAttached(tabId, info.newWindowId));
  browser.tabs.onReplaced.addListener((added, removed) => controller.onTabReplaced(added, removed));

  browser.commands.onCommand.addListener((name, tab) => {
    if (name === 'toggle-sidebar') {
      if (tab) panels.toggle(tab.windowId); // no awaiting before this: it needs the user gesture
      return;
    }
    if (name === 'toggle-pin' && tab?.id !== undefined) {
      controller.handle({ type: 'togglePin', tabId: tab.id }).catch(console.error);
      return;
    }
    const favorite = /^favorite-(\d)$/.exec(name);
    if (favorite && tab) {
      controller.handle({ type: 'openFavorite', position: Number(favorite[1]), windowId: tab.windowId }).catch(console.error);
    }
  });

  controller.init().catch(console.error);
});
