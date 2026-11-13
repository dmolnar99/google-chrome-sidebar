import { describe, expect, it } from 'vitest';
import { addNode, emptyState, findParent, moveNode, removeNode, updateNode } from './tree';
import type { SidebarNode, SidebarState } from './types';

const item = (id: string): SidebarNode => ({ kind: 'item', id, title: id, url: `https://${id}.test/` });
const folder = (id: string): SidebarNode => ({ kind: 'folder', id, title: id, childIds: [], collapsed: false });

/** favorites: [f1]; pinned: [a, F[b, G[c]]] */
function sample(): SidebarState {
  let s = emptyState();
  s = addNode(s, item('f1'), 'favorites');
  s = addNode(s, item('a'), 'pinned');
  s = addNode(s, folder('F'), 'pinned');
  s = addNode(s, item('b'), 'F');
  s = addNode(s, folder('G'), 'F');
  s = addNode(s, item('c'), 'G');
  return s;
}

describe('addNode', () => {
  it('appends by default and inserts at an index', () => {
    let s = sample();
    s = addNode(s, item('z'), 'pinned', 0);
    expect(s.pinned).toEqual(['z', 'a', 'F']);
  });

  it('rejects folders in Favorites', () => {
    expect(() => addNode(sample(), folder('X'), 'favorites')).toThrow(/only hold items/);
  });

  it('rejects duplicate ids and unknown containers', () => {
    expect(() => addNode(sample(), item('a'), 'pinned')).toThrow(/Duplicate/);
    expect(() => addNode(sample(), item('z'), 'nope')).toThrow(/Unknown container/);
    expect(() => addNode(sample(), item('z'), 'a')).toThrow(/Unknown container/);
  });
});

describe('moveNode', () => {
  it('reorders within a list', () => {
    expect(moveNode(sample(), 'a', 'pinned').pinned).toEqual(['F', 'a']);
  });

  it('moves between sections and into nested folders', () => {
    let s = moveNode(sample(), 'f1', 'G', 0);
    expect(s.favorites).toEqual([]);
    expect(findParent(s, 'f1')).toBe('G');
    s = moveNode(s, 'c', 'favorites');
    expect(s.favorites).toEqual(['c']);
  });

  it('refuses to move a folder into itself or a descendant', () => {
    expect(() => moveNode(sample(), 'F', 'F')).toThrow(/into itself/);
    expect(() => moveNode(sample(), 'F', 'G')).toThrow(/into itself/);
  });

  it('refuses to move a folder into Favorites', () => {
    expect(() => moveNode(sample(), 'G', 'favorites')).toThrow(/only hold items/);
  });

  it('leaves the original state untouched', () => {
    const s = sample();
    const before = structuredClone(s);
    moveNode(s, 'b', 'pinned', 0);
    expect(s).toEqual(before);
  });
});

describe('removeNode', () => {
  it('removes a folder and everything inside it', () => {
    const s = removeNode(sample(), 'F');
    expect(s.pinned).toEqual(['a']);
    expect(Object.keys(s.nodes).sort()).toEqual(['a', 'f1']);
  });

  it('removes a nested item from its folder', () => {
    const s = removeNode(sample(), 'c');
    expect(s.nodes.G).toMatchObject({ childIds: [] });
  });
});

describe('updateNode', () => {
  it('patches fields', () => {
    const s = updateNode(sample(), 'G', { collapsed: true });
    expect(s.nodes.G).toMatchObject({ collapsed: true, title: 'G' });
  });
});
