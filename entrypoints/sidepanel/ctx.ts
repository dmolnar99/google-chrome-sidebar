import type { MouseEvent } from 'react';
import { tabForItem, type Links } from '@/src/links/links';
import type { Command } from '@/src/messages';
import type { Item, SidebarState } from '@/src/model/types';
import type { DialogRequest } from './Dialog';
import type { WindowTabs } from './hooks';
import type { MenuEntry } from './Menu';

/** What every part of the panel needs: the data, and ways to act on it. */
export interface Ctx {
  state: SidebarState;
  windowId: number;
  tabStateOf: (item: Item) => TabState;
  run: (command: Command) => void;
  openMenu: (e: MouseEvent, entries: MenuEntry[]) => void;
  ask: (request: DialogRequest) => void;
}

/** What the panel knows about an item's tab in this window. */
export interface TabState {
  open: boolean;
  active: boolean;
  /** The linked tab has navigated away from the saved URL. */
  drifted: boolean;
}

export function tabState(item: Item, links: Links, win: WindowTabs): TabState {
  const tabId = tabForItem(links, item.id, win.windowId);
  const tab = tabId === undefined ? undefined : win.tabs.get(tabId);
  if (!tab) return { open: false, active: false, drifted: false };
  const url = tab.pendingUrl ?? tab.url;
  return { open: true, active: !!tab.active, drifted: !!url && url !== item.url };
}

export function faviconUrl(pageUrl: string) {
  const url = new URL(browser.runtime.getURL('/_favicon/' as '/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

export function classes(...names: (string | false | undefined)[]) {
  return names.filter(Boolean).join(' ');
}
