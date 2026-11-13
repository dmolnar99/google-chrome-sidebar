import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SidebarState } from '@/src/model/types';
import { parseArcSidebar } from './arc';

type Kind = { tab: { savedURL: string; savedTitle?: string } } | { list: {} } | { itemContainer: {} } | Record<string, {}>;

/** Builds a minimal Arc-shaped StorableSidebar.json. */
function arcFile(opts: {
  items: { id: string; data: Kind; children?: string[]; title?: string | null }[];
  favorites: string[];
  spaces: { id: string; title: string; pinned: string; unpinned: string }[];
}) {
  return {
    version: 1,
    sidebar: {
      containers: [
        { global: {} },
        {
          topAppsContainerIDs: opts.favorites.flatMap((id) => [{ default: true }, id]),
          spaces: opts.spaces.flatMap((s) => [
            s.id,
            { id: s.id, title: s.title, containerIDs: ['unpinned', s.unpinned, 'pinned', s.pinned] },
          ]),
          items: opts.items.flatMap((i) => [
            i.id,
            { id: i.id, title: i.title ?? null, data: i.data, childrenIds: i.children ?? [], parentID: null },
          ]),
        },
      ],
    },
  };
}

const tab = (id: string, url = `https://${id}.test/`, extra: { title?: string; savedTitle?: string } = {}) => ({
  id,
  title: extra.title ?? null,
  data: { tab: { savedURL: url, savedTitle: extra.savedTitle ?? `Saved ${id}` } },
});
const container = (id: string, children: string[]) => ({ id, data: { itemContainer: {} }, children });
const list = (id: string, title: string, children: string[]) => ({ id, title, data: { list: {} }, children });

/** Renders the tree as nested titles for readable assertions. */
function outline(state: SidebarState, ids: string[]): unknown[] {
  return ids.map((id) => {
    const node = state.nodes[id]!;
    return node.kind === 'folder' ? { [node.title]: outline(state, node.childIds) } : node.title;
  });
}

describe('parseArcSidebar', () => {
  it('imports favorites and one space directly into pinned', () => {
    const { state, report } = parseArcSidebar(
      arcFile({
        favorites: ['fav'],
        spaces: [{ id: 's1', title: 'Personal', pinned: 'p1', unpinned: 'u1' }],
        items: [
          container('fav', ['f1', 'f2']),
          tab('f1'),
          tab('f2', 'https://renamed.test/', { title: 'My name' }),
          container('p1', ['a', 'F']),
          tab('a'),
          list('F', 'Work', ['b', 'G']),
          tab('b'),
          list('G', 'Deep', ['c']),
          tab('c'),
          container('u1', ['today']),
          tab('today'),
        ],
      }),
    );
    expect(outline(state, state.favorites)).toEqual(['Saved f1', 'My name']);
    expect(outline(state, state.pinned)).toEqual(['Saved a', { Work: ['Saved b', { Deep: ['Saved c'] }] }]);
    expect(state.nodes.f2).toMatchObject({ url: 'https://renamed.test/' });
    expect(state.nodes.today).toBeUndefined();
    expect(report).toEqual({ favorites: 2, items: 3, folders: 2, skipped: {} });
  });

  it('wraps each space in a folder when there are several, skipping empty ones', () => {
    const { state } = parseArcSidebar(
      arcFile({
        favorites: [],
        spaces: [
          { id: 's1', title: 'Home', pinned: 'p1', unpinned: 'u1' },
          { id: 's2', title: 'Work', pinned: 'p2', unpinned: 'u2' },
          { id: 's3', title: 'Empty', pinned: 'p3', unpinned: 'u3' },
        ],
        items: [container('p1', ['a']), tab('a'), container('p2', ['b']), tab('b'), container('p3', [])],
      }),
    );
    expect(outline(state, state.pinned)).toEqual([{ Home: ['Saved a'] }, { Work: ['Saved b'] }]);
  });

  it('flattens folders in favorites and groupings like split views', () => {
    const { state, report } = parseArcSidebar(
      arcFile({
        favorites: ['fav'],
        spaces: [{ id: 's1', title: 'S', pinned: 'p1', unpinned: 'u1' }],
        items: [
          container('fav', ['FL']),
          list('FL', 'Fav folder', ['f1']),
          tab('f1'),
          container('p1', ['split', 'easel']),
          { id: 'split', data: { splitView: {} }, children: ['x', 'y'] },
          tab('x'),
          tab('y'),
          { id: 'easel', data: { easel: {} } },
        ],
      }),
    );
    expect(outline(state, state.favorites)).toEqual(['Saved f1']);
    expect(outline(state, state.pinned)).toEqual(['Saved x', 'Saved y']);
    expect(report.skipped).toEqual({ easel: 1 });
  });

  it('ignores dangling and duplicate children', () => {
    const { state } = parseArcSidebar(
      arcFile({
        favorites: ['fav'],
        spaces: [{ id: 's1', title: 'S', pinned: 'p1', unpinned: 'u1' }],
        items: [container('fav', ['a', 'missing']), tab('a'), container('p1', ['a'])],
      }),
    );
    expect(state.favorites).toEqual(['a']);
    expect(state.pinned).toEqual([]);
  });

  it('rejects files that are not Arc sidebars', () => {
    expect(() => parseArcSidebar({ hello: 'world' })).toThrow(/doesn't look like/);
    expect(() => parseArcSidebar(null)).toThrow(/doesn't look like/);
  });
});

// Runs against the real, git-ignored backup when it exists on this machine.
const privateDir = new URL('../../fixtures/private/', import.meta.url);
const realFile = existsSync(privateDir)
  ? readdirSync(privateDir).find((f) => f.startsWith('StorableSidebar') && f.endsWith('.json'))
  : undefined;

describe.skipIf(!realFile)('parseArcSidebar on the real Arc backup', () => {
  it('imports without errors or skipped items', () => {
    const { report } = parseArcSidebar(JSON.parse(readFileSync(new URL(realFile!, privateDir), 'utf8')));
    expect(report.favorites + report.items).toBeGreaterThan(0);
    expect(report.skipped).toEqual({});
    console.log('Real Arc import:', report);
  });
});
