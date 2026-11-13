import { addNode, emptyState } from '@/src/model/tree';
import type { ContainerId, NodeId, SidebarState } from '@/src/model/types';

const FORMAT = 'sidebar-backup';

export interface Backup {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  sidebar: SidebarState;
  themeColor: string | null;
}

export interface SidebarCounts {
  favorites: number;
  items: number;
  folders: number;
}

export function countSidebar(state: SidebarState): SidebarCounts {
  const nodes = Object.values(state.nodes);
  return {
    favorites: state.favorites.length,
    items: nodes.filter((n) => n.kind === 'item').length - state.favorites.length,
    folders: nodes.filter((n) => n.kind === 'folder').length,
  };
}

export function createBackup(sidebar: SidebarState, themeColor: string | null, now = new Date()): Backup {
  return { format: FORMAT, version: 1, exportedAt: now.toISOString(), sidebar, themeColor };
}

export function backupFileName(now = new Date()) {
  return `sidebar-backup-${now.toISOString().slice(0, 10)}.json`;
}

const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * Reads a backup file. The sidebar is rebuilt node by node with the normal tree operations, so a
 * damaged or hand-edited file can't produce cycles, duplicates or dangling references.
 */
export function parseBackup(json: unknown): Omit<Backup, 'format' | 'version'> {
  const b = json as Partial<Backup> | null;
  if (b?.format !== FORMAT) throw new Error("This isn't a Sidebar backup file");
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}`);
  const source = b.sidebar;
  if (!source || typeof source.nodes !== 'object' || !Array.isArray(source.favorites) || !Array.isArray(source.pinned)) {
    throw new Error('The backup is missing its sidebar');
  }

  let state = emptyState();
  const copy = (ids: unknown[], container: ContainerId) => {
    for (const id of ids) {
      if (!isString(id)) continue;
      const node = source.nodes[id as NodeId];
      if (!node || state.nodes[id]) continue; // dangling or listed twice
      if (node.kind === 'item') {
        if (!isString(node.url)) continue;
        state = addNode(state, { kind: 'item', id, title: isString(node.title) ? node.title : node.url, url: node.url }, container);
      } else if (node.kind === 'folder' && container !== 'favorites') {
        state = addNode(
          state,
          { kind: 'folder', id, title: isString(node.title) ? node.title : 'Folder', childIds: [], collapsed: node.collapsed === true },
          container,
        );
        copy(Array.isArray(node.childIds) ? node.childIds : [], id);
      }
    }
  };
  copy(source.favorites, 'favorites');
  copy(source.pinned, 'pinned');

  const themeColor = isString(b.themeColor) && /^#[0-9a-f]{6}$/i.test(b.themeColor) ? b.themeColor : null;
  return { exportedAt: isString(b.exportedAt) ? b.exportedAt : '', sidebar: state, themeColor };
}
