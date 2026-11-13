import { describe, expect, it } from 'vitest';
import { addNode, emptyState } from '@/src/model/tree';
import type { SidebarState } from '@/src/model/types';
import { backupFileName, countSidebar, createBackup, parseBackup } from './backup';

function sample(): SidebarState {
  let s = emptyState();
  s = addNode(s, { kind: 'item', id: 'f1', title: 'Fav', url: 'https://fav.test/' }, 'favorites');
  s = addNode(s, { kind: 'item', id: 'a', title: 'A', url: 'https://a.test/' }, 'pinned');
  s = addNode(s, { kind: 'folder', id: 'F', title: 'Work', childIds: [], collapsed: true }, 'pinned');
  s = addNode(s, { kind: 'folder', id: 'G', title: 'Deep', childIds: [], collapsed: false }, 'F');
  s = addNode(s, { kind: 'item', id: 'b', title: 'B', url: 'https://b.test/' }, 'G');
  return s;
}

const roundTrip = (backup: unknown) => parseBackup(JSON.parse(JSON.stringify(backup)));

describe('backup', () => {
  it('round-trips the sidebar and theme color', () => {
    const now = new Date('2026-11-13T20:00:00Z');
    const restored = roundTrip(createBackup(sample(), '#6cbad9', now));
    expect(restored).toEqual({ exportedAt: '2026-11-13T20:00:00.000Z', sidebar: sample(), themeColor: '#6cbad9' });
    expect(backupFileName(now)).toBe('sidebar-backup-2026-11-13.json');
  });

  it('counts what is inside', () => {
    expect(countSidebar(sample())).toEqual({ favorites: 1, items: 2, folders: 2 });
  });

  it('rejects other files', () => {
    expect(() => parseBackup({ sidebar: {} })).toThrow(/isn't a Sidebar backup/);
    expect(() => parseBackup({ format: 'sidebar-backup', version: 2 })).toThrow(/Unsupported backup version/);
    expect(() => parseBackup({ format: 'sidebar-backup', version: 1 })).toThrow(/missing its sidebar/);
    expect(() => parseBackup(null)).toThrow(/isn't a Sidebar backup/);
  });

  it('repairs damaged files instead of trusting them', () => {
    const backup = createBackup(sample(), 'not-a-color') as any;
    backup.sidebar.nodes.G.childIds.push('F', 'missing', 'a'); // cycle, dangling, duplicate
    backup.sidebar.favorites.push('F'); // folder in Favorites
    backup.sidebar.nodes.a.url = 42; // broken item
    const { sidebar, themeColor } = roundTrip(backup);
    expect(sidebar.favorites).toEqual(['f1']);
    expect(sidebar.pinned).toEqual(['F']);
    expect(sidebar.nodes.G).toMatchObject({ childIds: ['b'] });
    expect(sidebar.nodes.a).toBeUndefined();
    expect(themeColor).toBeNull();
  });
});
