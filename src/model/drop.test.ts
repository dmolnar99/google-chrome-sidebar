import { describe, expect, it } from 'vitest';
import { resolveMove, targetForRow, zoneAt } from './drop';
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
