import { describe, expect, it } from 'vitest';
import { finalTabIndex, resolveDrop, resolveMove, targetForRow, zoneAt } from './drop';
import { addNode, emptyState, moveNode } from './tree';
import type { SidebarNode, SidebarState } from './types';

const item = (id: string): SidebarNode => ({ kind: 'item', id, title: id, url: `https://${id}.test/` });
const folder = (id: string): SidebarNode => ({ kind: 'folder', id, title: id, childIds: [], collapsed: false });

/** favorites: [f1, f2]; pinned: [a, F[b, G[]], c] */
function sample(): SidebarState {
  let s = emptyState();
  s = addNode(s, item('f1'), 'favorites');
  s = addNode(s, item('f2'), 'favorites');
  s = addNode(s, item('a'), 'pinned');
  s = addNode(s, folder('F'), 'pinned');
  s = addNode(s, item('b'), 'F');
  s = addNode(s, folder('G'), 'F');
  s = addNode(s, item('c'), 'pinned');
  return s;
}

/** Simulates a drop and returns the resulting pinned/favorites layout. */
function drop(state: SidebarState, dragId: string, rowId: string, zone: 'before' | 'inside' | 'after', expanded = true) {
  const target = targetForRow(state, rowId, zone, { expanded });
  const move = target && resolveMove(state, dragId, target);
  return move && moveNode(state, dragId, move.container, move.index);
}

describe('zoneAt', () => {
  it('splits items in half and gives folders a middle band', () => {
    expect([0.1, 0.6].map((f) => zoneAt(f, false))).toEqual(['before', 'after']);
    expect([0.1, 0.5, 0.9].map((f) => zoneAt(f, true))).toEqual(['before', 'inside', 'after']);
  });
});

describe('drag and drop', () => {
  it('reorders downwards and upwards within a list', () => {
    expect(drop(sample(), 'a', 'c', 'after')!.pinned).toEqual(['F', 'c', 'a']);
    expect(drop(sample(), 'c', 'a', 'before')!.pinned).toEqual(['c', 'a', 'F']);
  });

  it('ignores drops that would not move anything', () => {
    expect(drop(sample(), 'a', 'a', 'before')).toBeUndefined();
    expect(drop(sample(), 'a', 'F', 'before')).toBeUndefined();
    expect(drop(sample(), 'f1', 'f2', 'before')).toBeUndefined();
  });

  it('drops into a folder, at the end', () => {
    const s = drop(sample(), 'a', 'F', 'inside')!;
    expect(s.nodes.F).toMatchObject({ childIds: ['b', 'G', 'a'] });
  });

  it('treats "below an open folder" as its first child, and "below a closed one" as after it', () => {
    expect(drop(sample(), 'c', 'F', 'after', true)!.nodes.F).toMatchObject({ childIds: ['c', 'b', 'G'] });
    expect(drop(sample(), 'a', 'F', 'after', false)!.pinned).toEqual(['F', 'a', 'c']);
  });

  it('moves items out of folders and between sections', () => {
    expect(drop(sample(), 'b', 'a', 'before')!.pinned).toEqual(['b', 'a', 'F', 'c']);
    const s = drop(sample(), 'a', 'f1', 'after')!;
    expect(s.favorites).toEqual(['f1', 'a', 'f2']);
    expect(drop(s, 'f2', 'c', 'after')!.pinned).toEqual(['F', 'c', 'f2']);
  });

  it('refuses folders in Favorites and folders inside themselves', () => {
    expect(drop(sample(), 'F', 'f1', 'after')).toBeUndefined();
    expect(drop(sample(), 'F', 'G', 'inside')).toBeUndefined();
    expect(drop(sample(), 'F', 'b', 'before')).toBeUndefined();
  });

  it('appends to a section via a section-level target', () => {
    const s = sample();
    const move = resolveMove(s, 'b', { container: 'pinned', index: s.pinned.length });
    expect(move).toEqual({ container: 'pinned', index: 3 });
  });
});

describe('resolveDrop', () => {
  const tabIndex = (id: number) => ({ 100: 0, 101: 1, 102: 2 })[id];

  it('saves a tab into the tree at the exact target position', () => {
    expect(resolveDrop(sample(), { kind: 'tab', tabId: 101 }, { kind: 'tree', container: 'F', index: 1 }, tabIndex)).toEqual({
      type: 'saveTab',
      tabId: 101,
      container: 'F',
      index: 1,
    });
  });

  it('unpins items into the tab list, but not folders', () => {
    expect(resolveDrop(sample(), { kind: 'node', id: 'b' }, { kind: 'tabs', index: 2 }, tabIndex)).toEqual({ type: 'unpin', itemId: 'b', index: 2 });
    expect(resolveDrop(sample(), { kind: 'node', id: 'F' }, { kind: 'tabs', index: 2 }, tabIndex)).toBeUndefined();
  });

  it('reorders tabs and ignores drops that keep a tab in place', () => {
    expect(resolveDrop(sample(), { kind: 'tab', tabId: 100 }, { kind: 'tabs', index: 3 }, tabIndex)).toEqual({ type: 'moveTab', tabId: 100, index: 3 });
    expect(resolveDrop(sample(), { kind: 'tab', tabId: 101 }, { kind: 'tabs', index: 1 }, tabIndex)).toBeUndefined();
    expect(resolveDrop(sample(), { kind: 'tab', tabId: 101 }, { kind: 'tabs', index: 2 }, tabIndex)).toBeUndefined();
  });

  it('still moves nodes within the tree', () => {
    expect(resolveDrop(sample(), { kind: 'node', id: 'a' }, { kind: 'tree', container: 'pinned', index: 3 }, tabIndex)).toEqual({
      type: 'move',
      id: 'a',
      container: 'pinned',
      index: 2,
    });
  });
});

describe('finalTabIndex', () => {
  it('accounts for the tab leaving its old spot', () => {
    expect(finalTabIndex(0, 3)).toBe(2);
    expect(finalTabIndex(3, 0)).toBe(0);
  });
});
