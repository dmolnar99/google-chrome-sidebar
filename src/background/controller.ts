import { linksStore } from '@/src/links/store';
import { linkTab, moveTab, pinChanges, pruneLinks, relink, tabForItem, unlinkTab, type Links } from '@/src/links/links';
import type { Command } from '@/src/messages';
import { finalTabIndex } from '@/src/model/drop';
import { applyOp } from '@/src/model/ops';
import { sidebarStore } from '@/src/model/store';
import { newId } from '@/src/model/tree';
import type { Item, NodeId, SidebarState } from '@/src/model/types';

function allItems(state: SidebarState): Item[] {
  return Object.values(state.nodes).filter((n): n is Item => n.kind === 'item');
}

/**
 * Owns the saved sidebar and the item–tab links. Every change runs through one queue, so
 * read-modify-write cycles from several windows can't overwrite each other.
 */
export class Controller {
  private queue: Promise<unknown> = Promise.resolve();

  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.withPinSync(task));
    this.queue = result.catch(() => {});
    return result;
  }

  /** Runs `task`, then pins or unpins tabs whose Favorite status it changed. */
  private async withPinSync<T>(task: () => Promise<T>): Promise<T> {
    const snapshot = async () => ({
      links: (await linksStore.getValue()) ?? {},
      favorites: (await sidebarStore.getValue()).favorites,
    });
    const before = await snapshot();
    try {
      return await task();
    } finally {
      const changes = pinChanges(before, await snapshot());
      // A split view's two tabs must share pinned state, so a Favorite's tab stays unpinned while split.
      const inSplit = async (id: number) => {
        const tab = await browser.tabs.get(id).catch(() => undefined);
        return tab?.splitViewId !== undefined && tab.splitViewId !== -1;
      };
      const pin = [];
      for (const id of changes.pin) if (!(await inSplit(id))) pin.push(id);
      const unpin = changes.unpin;
      // A tab may already be gone (closed, or the window closed); that's fine.
      await Promise.all([
        ...pin.map((id) => browser.tabs.update(id, { pinned: true }).catch(() => {})),
        ...unpin.map((id) => browser.tabs.update(id, { pinned: false }).catch(() => {})),
      ]);
    }
  }

  private async links(): Promise<Links> {
    const links = await linksStore.getValue();
    if (links) return links;
    // First run since a browser restart or extension reload: tab ids changed, match by URL.
    const tabs = await browser.tabs.query({});
    const rebuilt = relink(
      tabs.flatMap((t) => (t.id === undefined ? [] : [{ id: t.id, windowId: t.windowId, url: t.url }])),
      allItems(await sidebarStore.getValue()),
    );
    await linksStore.setValue(rebuilt);
    return rebuilt;
  }

  private async updateLinks(fn: (links: Links) => Links) {
    const links = await this.links();
    const next = fn(links);
    if (next !== links) await linksStore.setValue(next);
  }

  /** Builds links if needed; call on worker start. */
  init() {
    return this.run(() => this.links());
  }

  handle(command: Command): Promise<void> {
    return this.run(() => this.execute(command));
  }

  private async execute(command: Command) {
    switch (command.type) {
      case 'sidebar': {
        const state = applyOp(await sidebarStore.getValue(), command.op);
        await sidebarStore.setValue(state);
        if (command.op.type === 'replace') {
          // Brand-new items: match them to open tabs by URL.
          await linksStore.setValue(null);
          await this.links();
        } else {
          await this.updateLinks((l) => pruneLinks(l, (id) => !!state.nodes[id]));
        }
        return;
      }
      case 'activate': {
        const state = await sidebarStore.getValue();
        const item = state.nodes[command.itemId];
        if (item?.kind !== 'item') throw new Error(`Unknown item: ${command.itemId}`);
        const tabId = tabForItem(await this.links(), item.id, command.windowId);
        if (tabId !== undefined) {
          try {
            await browser.tabs.update(tabId, { active: true });
            return;
          } catch {
            // The tab is gone without us hearing about it; drop the link and open a fresh one.
            await this.updateLinks((l) => unlinkTab(l, tabId));
          }
        }
        const tab = await browser.tabs.create({ windowId: command.windowId, url: item.url, active: true });
        if (tab.id !== undefined) await this.updateLinks((l) => linkTab(l, tab.id!, item.id, command.windowId));
        return;
      }
      case 'closeTab': {
        const tabId = tabForItem(await this.links(), command.itemId, command.windowId);
        if (tabId === undefined) return;
        // Close first: unlinking first would briefly show the tab as a plain tab in the panel.
        await browser.tabs.remove(tabId);
        await this.updateLinks((l) => unlinkTab(l, tabId));
        return;
      }
      case 'reset': {
        const item = (await sidebarStore.getValue()).nodes[command.itemId];
        const tabId = tabForItem(await this.links(), command.itemId, command.windowId);
        if (item?.kind !== 'item' || tabId === undefined) return;
        await browser.tabs.update(tabId, { url: item.url });
        return;
      }
      case 'saveTab': {
        const tab = await browser.tabs.get(command.tabId);
        if (!tab.url || tab.id === undefined) throw new Error('That tab has no URL to save');
        const item: Item = { kind: 'item', id: newId(), title: tab.title || tab.url, url: tab.url };
        const state = applyOp(await sidebarStore.getValue(), {
          type: 'add',
          node: item,
          container: command.container,
          index: command.index,
        });
        await sidebarStore.setValue(state);
        await this.updateLinks((l) => linkTab(l, tab.id!, item.id, tab.windowId));
        return;
      }
      case 'unpin': {
        const state = await sidebarStore.getValue();
        const item = state.nodes[command.itemId];
        if (item?.kind !== 'item') throw new Error('Only items can be unpinned');
        const tabId = tabForItem(await this.links(), item.id, command.windowId);
        const next = applyOp(state, { type: 'remove', id: item.id });
        await sidebarStore.setValue(next);
        await this.updateLinks((l) => pruneLinks(l, (id) => !!next.nodes[id]));
        if (tabId === undefined) {
          await browser.tabs.create({ windowId: command.windowId, url: item.url, index: command.index, active: true });
        } else {
          await this.moveTabTo(tabId, command.index);
        }
        return;
      }
      case 'moveTab':
        await this.moveTabTo(command.tabId, command.index);
        return;
      case 'togglePin': {
        const tab = await browser.tabs.get(command.tabId);
        const link = (await this.links())[command.tabId];
        if (link) {
          // Already a Favorite or pinned item: remove the item, keep the tab.
          const next = applyOp(await sidebarStore.getValue(), { type: 'remove', id: link.itemId });
          await sidebarStore.setValue(next);
          await this.updateLinks((l) => pruneLinks(l, (id) => !!next.nodes[id]));
        } else {
          await this.execute({ type: 'saveTab', tabId: tab.id!, container: 'pinned' });
        }
        return;
      }
      case 'split':
        await this.split(command.source, command.windowId);
        return;
      case 'openFavorite': {
        const itemId = (await sidebarStore.getValue()).favorites[command.position - 1];
        if (itemId) await this.execute({ type: 'activate', itemId, windowId: command.windowId });
        return;
      }
    }
  }

  /**
   * Puts an item's tab (or a plain tab) in a split view with the window's active tab. Chrome only
   * splits two adjacent tabs that aren't split yet and share pinned state and tab group, so this
   * arranges that first. An item without a tab here opens in a new tab, straight into the split.
   */
  private async split(source: { itemId: NodeId } | { tabId: number }, windowId: number) {
    const [active] = await browser.tabs.query({ active: true, windowId });
    if (active?.id === undefined) return;
    let tabId = 'tabId' in source ? source.tabId : tabForItem(await this.links(), source.itemId, windowId);
    if (tabId === active.id) return; // already the current tab: nothing to split with

    const unsplit = async (tab: Browser.tabs.Tab) => {
      if (tab.splitViewId !== undefined && tab.splitViewId !== -1) await browser.tabs.unsplit(tab.splitViewId);
    };
    await unsplit(active);

    if (tabId === undefined) {
      const item = 'itemId' in source ? (await sidebarStore.getValue()).nodes[source.itemId] : undefined;
      if (item?.kind !== 'item') throw new Error('Nothing to open in split view');
      const tab = await browser.tabs.create({ splitWithTabId: active.id, url: item.url, active: true });
      if (tab.id !== undefined) await this.updateLinks((l) => linkTab(l, tab.id!, item.id, windowId));
      return;
    }

    let tab: Browser.tabs.Tab = await browser.tabs.get(tabId);
    await unsplit(tab);
    if (tab.pinned !== active.pinned) tab = (await browser.tabs.update(tabId, { pinned: active.pinned })) ?? tab;
    if (tab.groupId !== active.groupId) {
      if (active.groupId === -1) await browser.tabs.ungroup(tabId);
      else await browser.tabs.group({ groupId: active.groupId, tabIds: [tabId] });
    }
    const current = await browser.tabs.get(active.id);
    await browser.tabs.move(tabId, { index: finalTabIndex((await browser.tabs.get(tabId)).index, current.index + 1) });
    await browser.tabs.createSplit([active.id, tabId]);
    await browser.tabs.update(tabId, { active: true });
  }

  private async moveTabTo(tabId: number, insertAt: number) {
    const tab = await browser.tabs.get(tabId);
    // Chrome keeps pinned tabs at the front; a plain tab can't sit among them.
    if (tab.pinned) await browser.tabs.update(tabId, { pinned: false });
    await browser.tabs.move(tabId, { index: finalTabIndex(tab.index, insertAt) });
  }

  onTabRemoved(tabId: number) {
    return this.run(() => this.updateLinks((l) => unlinkTab(l, tabId)));
  }

  onTabAttached(tabId: number, windowId: number) {
    return this.run(() => this.updateLinks((l) => moveTab(l, tabId, windowId)));
  }

  /** Chrome swapped one tab for another (prerendering); keep the link. */
  onTabReplaced(addedTabId: number, removedTabId: number) {
    return this.run(() =>
      this.updateLinks((l) => {
        const link = l[removedTabId];
        return link ? linkTab(unlinkTab(l, removedTabId), addedTabId, link.itemId, link.windowId) : l;
      }),
    );
  }
}
