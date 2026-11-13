import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { linksStore } from '@/src/links/store';
import { sidebarStore } from '@/src/model/store';
import { addNode, emptyState } from '@/src/model/tree';
import type { SidebarState } from '@/src/model/types';
import { Controller } from './controller';

const URL_A = 'https://a.test/';

async function setup(): Promise<{ controller: Controller; windowId: number }> {
  let state: SidebarState = emptyState();
  state = addNode(state, { kind: 'item', id: 'a', title: 'A', url: URL_A }, 'pinned');
  state = addNode(state, { kind: 'folder', id: 'F', title: 'F', childIds: [], collapsed: false }, 'pinned');
  state = addNode(state, { kind: 'item', id: 'b', title: 'B', url: 'https://b.test/' }, 'F');
  await sidebarStore.setValue(state);
  const win = await fakeBrowser.windows.create({});
  const controller = new Controller();
  await controller.init();
  return { controller, windowId: win!.id! };
}

const links = () => linksStore.getValue();

describe('Controller', () => {
  beforeEach(() => fakeBrowser.reset());

  it('opens an item once, then focuses its tab', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    const [tab] = await fakeBrowser.tabs.query({ url: URL_A });
    expect(await links()).toEqual({ [tab!.id!]: { itemId: 'a', windowId } });

    await fakeBrowser.tabs.create({ windowId, url: 'https://elsewhere.test/', active: true });
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    expect(await fakeBrowser.tabs.query({ url: URL_A })).toHaveLength(1);
    expect((await fakeBrowser.tabs.get(tab!.id!)).active).toBe(true);
  });

  it('closing the tab keeps the item and drops the link', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    await controller.handle({ type: 'closeTab', itemId: 'a', windowId });
    expect(await fakeBrowser.tabs.query({ url: URL_A })).toHaveLength(0);
    expect(await links()).toEqual({});
    expect((await sidebarStore.getValue()).nodes.a).toBeDefined();
  });

  it('unlinks when Chrome closes the tab', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    const [tab] = await fakeBrowser.tabs.query({ url: URL_A });
    await controller.onTabRemoved(tab!.id!);
    expect(await links()).toEqual({});
  });

  it('reopens a fresh tab when the linked one vanished unnoticed', async () => {
    const { controller, windowId } = await setup();
    await linksStore.setValue({ 999: { itemId: 'a', windowId } });
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    const [tab] = await fakeBrowser.tabs.query({ url: URL_A });
    expect(await links()).toEqual({ [tab!.id!]: { itemId: 'a', windowId } });
  });

  it('resets a drifted tab to the saved URL', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    const [tab] = await fakeBrowser.tabs.query({ url: URL_A });
    await fakeBrowser.tabs.update(tab!.id!, { url: 'https://a.test/deep/page' });
    await controller.handle({ type: 'reset', itemId: 'a', windowId });
    expect((await fakeBrowser.tabs.get(tab!.id!)).url).toBe(URL_A);
  });

  it('saves a tab as a linked item', async () => {
    const { controller, windowId } = await setup();
    const tab = await fakeBrowser.tabs.create({ windowId, url: 'https://new.test/' });
    await controller.handle({ type: 'saveTab', tabId: tab.id!, container: 'favorites' });
    const state = await sidebarStore.getValue();
    const id = state.favorites[0]!;
    expect(state.nodes[id]).toMatchObject({ url: 'https://new.test/' });
    expect(await links()).toEqual({ [tab.id!]: { itemId: id, windowId } });
  });

  it('removing a folder unlinks its items but leaves their tabs open', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'b', windowId });
    await controller.handle({ type: 'sidebar', op: { type: 'remove', id: 'F' } });
    expect(await links()).toEqual({});
    expect(await fakeBrowser.tabs.query({ url: 'https://b.test/' })).toHaveLength(1);
  });

  it('rebuilds links by URL on start and after an import', async () => {
    const win = await fakeBrowser.windows.create({});
    const tab = await fakeBrowser.tabs.create({ windowId: win!.id, url: URL_A });
    const { controller } = await setup(); // init runs relink
    expect(await links()).toMatchObject({ [tab.id!]: { itemId: 'a' } });

    let imported = emptyState();
    imported = addNode(imported, { kind: 'item', id: 'z', title: 'Z', url: URL_A }, 'favorites');
    await controller.handle({ type: 'sidebar', op: { type: 'replace', state: imported } });
    expect(await links()).toMatchObject({ [tab.id!]: { itemId: 'z' } });
  });

  it('surfaces errors without breaking the queue', async () => {
    const { controller, windowId } = await setup();
    await expect(controller.handle({ type: 'activate', itemId: 'nope', windowId })).rejects.toThrow(/Unknown item/);
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    expect(await fakeBrowser.tabs.query({ url: URL_A })).toHaveLength(1);
  });
});

describe('Controller: unpin and tab moves', () => {
  beforeEach(() => fakeBrowser.reset());

  it('unpinning an open item keeps its tab', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'activate', itemId: 'a', windowId });
    const [tab] = await fakeBrowser.tabs.query({ url: URL_A });
    // The fake browser has no tabs.move; the real one does.
    fakeBrowser.tabs.move = (async () => tab) as never;
    await controller.handle({ type: 'unpin', itemId: 'a', windowId, index: 0 });
    expect((await sidebarStore.getValue()).nodes.a).toBeUndefined();
    expect(await links()).toEqual({});
    expect(await fakeBrowser.tabs.query({ url: URL_A })).toHaveLength(1);
  });

  it('unpinning a closed item opens it as a plain tab', async () => {
    const { controller, windowId } = await setup();
    await controller.handle({ type: 'unpin', itemId: 'a', windowId, index: 0 });
    expect(await fakeBrowser.tabs.query({ url: URL_A })).toHaveLength(1);
    expect(await links()).toEqual({});
  });

  it('refuses to unpin a folder', async () => {
    const { controller, windowId } = await setup();
    await expect(controller.handle({ type: 'unpin', itemId: 'F', windowId, index: 0 })).rejects.toThrow(/Only items/);
  });
});
