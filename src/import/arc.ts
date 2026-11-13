import { addNode, emptyState } from '@/src/model/tree';
import type { ContainerId, SidebarState } from '@/src/model/types';

/**
 * Converts Arc's `StorableSidebar.json` into a SidebarState.
 *
 * Arc's format, as far as we rely on it:
 * - `sidebar.containers[]` holds one entry with `spaces`, `items` and `topAppsContainerIDs`.
 * - Those three are flat lists alternating key, value, key, value…
 * - Items form a tree via `childrenIds`. `data.tab` is a saved URL, `data.list` is a folder,
 *   `data.itemContainer` is a section root (Favorites, or a Space's pinned/unpinned list).
 * - Each Space's `containerIDs` alternates role ("pinned" / "unpinned") and container id.
 *
 * Favorites from every profile are merged. A Space's pinned items become a top-level folder
 * named after the Space, unless there is only one Space, in which case they go straight into
 * Pinned. Unpinned (Today) tabs are not imported.
 */

export interface ArcImportReport {
  favorites: number;
  items: number;
  folders: number;
  /** Arc item kinds we don't support (e.g. easel, splitView leaf types), with counts. */
  skipped: Record<string, number>;
}

export interface ArcImportResult {
  state: SidebarState;
  report: ArcImportReport;
}

interface ArcItem {
  id: string;
  title?: string | null;
  childrenIds?: string[];
  data?: Record<string, any>;
}

interface ArcSpace {
  id?: string;
  title?: string | null;
  containerIDs?: unknown[];
}

function pairs<V>(list: unknown): [unknown, V][] {
  if (!Array.isArray(list)) return [];
  const out: [unknown, V][] = [];
  for (let i = 0; i + 1 < list.length; i += 2) out.push([list[i], list[i + 1] as V]);
  return out;
}

export function parseArcSidebar(json: unknown): ArcImportResult {
  const containers: any[] = (json as any)?.sidebar?.containers;
  const root = Array.isArray(containers) ? containers.find((c) => c && 'items' in c) : undefined;
  if (!root) throw new Error("This doesn't look like Arc's StorableSidebar.json");

  const items = new Map<string, ArcItem>();
  for (const [, item] of pairs<ArcItem>(root.items)) {
    if (item && typeof item.id === 'string') items.set(item.id, item);
  }

  let state = emptyState();
  const report: ArcImportReport = { favorites: 0, items: 0, folders: 0, skipped: {} };
  const skip = (kind: string) => (report.skipped[kind] = (report.skipped[kind] ?? 0) + 1);

  /** Copies Arc's children of `arcId` into `target`. Favorites can't hold folders, so they flatten. */
  const copyChildren = (arcId: string, target: ContainerId, flatten: boolean) => {
    for (const childId of items.get(arcId)?.childrenIds ?? []) {
      const child = items.get(childId);
      // Skip dangling ids, and anything Arc lists twice.
      if (!child || state.nodes[child.id]) continue;
      const kind = Object.keys(child.data ?? {})[0] ?? 'unknown';
      if (kind === 'tab') {
        const tab = child.data!.tab;
        const url: unknown = tab?.savedURL;
        if (typeof url !== 'string' || !url) {
          skip('tab without URL');
          continue;
        }
        const title = child.title || tab.savedTitle || url;
        state = addNode(state, { kind: 'item', id: child.id, title, url }, target);
        if (target === 'favorites') report.favorites++;
        else report.items++;
      } else if (kind === 'list' && !flatten) {
        state = addNode(
          state,
          { kind: 'folder', id: child.id, title: child.title || 'Folder', childIds: [], collapsed: false },
          target,
        );
        report.folders++;
        copyChildren(child.id, child.id, false);
      } else if (child.childrenIds?.length) {
        // Folders inside Favorites, split views and other groupings: keep their tabs, drop the grouping.
        copyChildren(child.id, target, flatten);
      } else {
        skip(kind);
      }
    }
  };

  for (const [, containerId] of pairs<string>(root.topAppsContainerIDs)) {
    if (typeof containerId === 'string') copyChildren(containerId, 'favorites', true);
  }

  const spaces = pairs<ArcSpace>(root.spaces)
    .map(([, space]) => space)
    .filter((s): s is ArcSpace => !!s && typeof s === 'object');
  for (const space of spaces) {
    const pinnedId = pairs<string>(space.containerIDs).find(([role]) => role === 'pinned')?.[1];
    if (typeof pinnedId !== 'string' || !items.get(pinnedId)?.childrenIds?.length) continue;
    let target: ContainerId = 'pinned';
    if (spaces.length > 1) {
      target = `space-${pinnedId}`;
      state = addNode(
        state,
        { kind: 'folder', id: target, title: space.title || 'Space', childIds: [], collapsed: false },
        'pinned',
      );
      report.folders++;
    }
    copyChildren(pinnedId, target, false);
  }

  return { state, report };
}
