import { describe, expect, it } from 'vitest';
import type { Item } from '@/src/model/types';
import { linkTab, moveTab, pinChanges, pruneLinks, relink, tabForItem, unlinkTab } from './links';

const item = (id: string, url = `https://${id}.test/`): Item => ({ kind: 'item', id, title: id, url });

describe('linkTab', () => {
  it('keeps one tab per item per window', () => {
    let links = linkTab({}, 1, 'a', 10);
    links = linkTab(links, 2, 'a', 20);
    links = linkTab(links, 3, 'a', 10);
    expect(links).toEqual({ 2: { itemId: 'a', windowId: 20 }, 3: { itemId: 'a', windowId: 10 } });
    expect(tabForItem(links, 'a', 10)).toBe(3);
  });

  it('moves a tab from one item to another', () => {
    const links = linkTab(linkTab({}, 1, 'a', 10), 1, 'b', 10);
    expect(links).toEqual({ 1: { itemId: 'b', windowId: 10 } });
  });
});

describe('unlinkTab / pruneLinks', () => {
  it('removes links', () => {
    const links = linkTab(linkTab({}, 1, 'a', 10), 2, 'b', 10);
    expect(unlinkTab(links, 1)).toEqual({ 2: { itemId: 'b', windowId: 10 } });
    expect(pruneLinks(links, (id) => id === 'a')).toEqual({ 1: { itemId: 'a', windowId: 10 } });
  });

  it('returns the same object when nothing changes', () => {
    const links = linkTab({}, 1, 'a', 10);
    expect(unlinkTab(links, 99)).toBe(links);
    expect(pruneLinks(links, () => true)).toBe(links);
  });
});

describe('moveTab', () => {
  it('follows a tab into another window', () => {
    expect(moveTab(linkTab({}, 1, 'a', 10), 1, 20)).toEqual({ 1: { itemId: 'a', windowId: 20 } });
  });

  it('unlinks the moved tab if the target window already has one for that item', () => {
    const links = linkTab(linkTab({}, 1, 'a', 10), 2, 'a', 20);
    expect(moveTab(links, 1, 20)).toEqual({ 2: { itemId: 'a', windowId: 20 } });
  });
});

describe('relink', () => {
  it('matches tabs to items by URL, first tab per window wins', () => {
    const links = relink(
      [
        { id: 1, windowId: 10, url: 'https://a.test/' },
        { id: 2, windowId: 10, url: 'https://a.test/' },
        { id: 3, windowId: 20, url: 'https://a.test/' },
        { id: 4, windowId: 10, url: 'https://other.test/' },
        { id: 5, windowId: 10 },
      ],
      [item('a')],
    );
    expect(links).toEqual({ 1: { itemId: 'a', windowId: 10 }, 3: { itemId: 'a', windowId: 20 } });
  });

  it('gives two items with the same URL a tab each', () => {
    const links = relink(
      [
        { id: 1, windowId: 10, url: 'https://x.test/' },
        { id: 2, windowId: 10, url: 'https://x.test/' },
      ],
      [item('a', 'https://x.test/'), item('b', 'https://x.test/')],
    );
    expect(links).toEqual({ 1: { itemId: 'a', windowId: 10 }, 2: { itemId: 'b', windowId: 10 } });
  });
});

describe('pinChanges', () => {
  const links = { 1: { itemId: 'fav', windowId: 10 }, 2: { itemId: 'pin', windowId: 10 } };

  it('pins tabs that become Favorites and unpins ones that stop being', () => {
    expect(pinChanges({ links: {}, favorites: ['fav'] }, { links, favorites: ['fav'] })).toEqual({ pin: [1], unpin: [] });
    expect(pinChanges({ links, favorites: ['fav'] }, { links, favorites: ['pin'] })).toEqual({ pin: [2], unpin: [1] });
    expect(pinChanges({ links, favorites: ['fav'] }, { links: unlinkTab(links, 1), favorites: ['fav'] })).toEqual({ pin: [], unpin: [1] });
  });

  it('leaves tabs alone when nothing about them changed', () => {
    expect(pinChanges({ links, favorites: ['fav'] }, { links, favorites: ['fav'] })).toEqual({ pin: [], unpin: [] });
  });
});
