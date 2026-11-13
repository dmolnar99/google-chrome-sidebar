import type { Item, NodeId } from '@/src/model/types';

/**
 * Which live tab belongs to which sidebar item. Keyed by tab id; each item has at most one
 * linked tab per window, and each tab belongs to at most one item.
 */
export interface Link {
  itemId: NodeId;
  windowId: number;
}
export type Links = Record<string, Link>;

export interface TabInfo {
  id: number;
  windowId: number;
  url?: string;
}

export function tabForItem(links: Links, itemId: NodeId, windowId: number): number | undefined {
  for (const [tabId, link] of Object.entries(links)) {
    if (link.itemId === itemId && link.windowId === windowId) return Number(tabId);
  }
  return undefined;
}

/** Links `tabId` to `itemId`, replacing the tab's old link and the item's old tab in that window. */
export function linkTab(links: Links, tabId: number, itemId: NodeId, windowId: number): Links {
  const next: Links = {};
  for (const [id, link] of Object.entries(links)) {
    const sameSlot = link.itemId === itemId && link.windowId === windowId;
    if (Number(id) !== tabId && !sameSlot) next[id] = link;
  }
  next[tabId] = { itemId, windowId };
  return next;
}

export function unlinkTab(links: Links, tabId: number): Links {
  if (!(tabId in links)) return links;
  const { [tabId]: _, ...rest } = links;
  return rest;
}

/** Drops links to items that no longer exist. */
export function pruneLinks(links: Links, itemExists: (id: NodeId) => boolean): Links {
  const next = Object.fromEntries(Object.entries(links).filter(([, l]) => itemExists(l.itemId)));
  return Object.keys(next).length === Object.keys(links).length ? links : next;
}

/** A tab moved to another window. If that window already has a tab for the item, the moved tab loses its link. */
export function moveTab(links: Links, tabId: number, windowId: number): Links {
  const link = links[tabId];
  if (!link || link.windowId === windowId) return links;
  const rest = unlinkTab(links, tabId);
  if (tabForItem(rest, link.itemId, windowId) !== undefined) return rest;
  return { ...rest, [tabId]: { itemId: link.itemId, windowId } };
}

/**
 * Rebuilds links from scratch by matching open tabs to items' saved URLs. Used after a browser
 * restart or extension reload, when tab ids have changed. First matching tab per window wins.
 */
export function relink(tabs: TabInfo[], items: Item[]): Links {
  const byUrl = new Map<string, NodeId[]>();
  for (const item of items) byUrl.set(item.url, [...(byUrl.get(item.url) ?? []), item.id]);
  let links: Links = {};
  for (const tab of tabs) {
    for (const itemId of (tab.url && byUrl.get(tab.url)) || []) {
      if (tabForItem(links, itemId, tab.windowId) === undefined) {
        links = linkTab(links, tab.id, itemId, tab.windowId);
        break;
      }
    }
  }
  return links;
}
