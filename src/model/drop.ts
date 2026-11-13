import { cannotHold, childList, findParent } from './tree';
import type { ContainerId, NodeId, SidebarState } from './types';

/** Where in a row the pointer is, for a vertical list. */
export type Zone = 'before' | 'inside' | 'after';

/**
 * Picks the drop zone from the pointer's position within a row (0 = top edge, 1 = bottom edge).
 * Folders get a middle band for "drop inside"; items only split into before/after.
 */
export function zoneAt(fraction: number, isFolder: boolean): Zone {
  if (!isFolder) return fraction < 0.5 ? 'before' : 'after';
  if (fraction < 0.25) return 'before';
  if (fraction > 0.75) return 'after';
  return 'inside';
}

/** A drop position expressed against the lists as they look now, before the dragged node is removed. */
export interface DropTarget {
  container: ContainerId;
  index: number;
}

/** Turns "dropped on this row, in this zone" into a position. */
export function targetForRow(
  state: SidebarState,
  rowId: NodeId,
  zone: Zone,
  opts: { expanded: boolean },
): DropTarget | undefined {
  const parent = findParent(state, rowId);
  if (parent === undefined) return undefined;
  const node = state.nodes[rowId];
  if (zone === 'inside' && node?.kind === 'folder') return { container: rowId, index: node.childIds.length };
  // Just below an open folder with children is visually its first child.
  if (zone === 'after' && node?.kind === 'folder' && opts.expanded && node.childIds.length > 0) {
    return { container: rowId, index: 0 };
  }
  const index = childList(state, parent).indexOf(rowId);
  return { container: parent, index: zone === 'before' ? index : index + 1 };
}

/**
 * Converts a drop target into the arguments for moveNode, or undefined if the drop is not
 * allowed or wouldn't change anything.
 */
export function resolveMove(
  state: SidebarState,
  dragId: NodeId,
  target: DropTarget,
): { container: ContainerId; index: number } | undefined {
  const node = state.nodes[dragId];
  const from = findParent(state, dragId);
  if (!node || from === undefined || cannotHold(state, target.container, node)) return undefined;
  let index = target.index;
  if (from === target.container) {
    const current = childList(state, from).indexOf(dragId);
    if (current < index) index--; // the list shrinks by one before inserting
    if (current === index) return undefined;
  }
  return { container: target.container, index };
}

/** Something being dragged: a sidebar node, or one of the window's plain tabs. */
export type DragSource = { kind: 'node'; id: NodeId } | { kind: 'tab'; tabId: number };

/** Where it's being dropped: a position in the sidebar tree, or an insertion index among Chrome's tabs. */
export type Destination = ({ kind: 'tree' } & DropTarget) | { kind: 'tabs'; index: number };

/** The command a drop turns into. Tab indexes are insertion points before the dragged tab moves. */
export type DropAction =
  | { type: 'move'; id: NodeId; container: ContainerId; index: number }
  | { type: 'saveTab'; tabId: number; container: ContainerId; index: number }
  | { type: 'unpin'; itemId: NodeId; index: number }
  | { type: 'moveTab'; tabId: number; index: number };

/**
 * Where a tab ends up when inserted at `insertAt` (counted before it is taken out of its old
 * spot at `from`). Chrome's tabs.move expects this final index.
 */
export function finalTabIndex(from: number, insertAt: number): number {
  return from < insertAt ? insertAt - 1 : insertAt;
}

/** Decides what a drop does, or undefined if it isn't allowed or changes nothing. */
export function resolveDrop(
  state: SidebarState,
  source: DragSource,
  dest: Destination,
  tabIndex: (tabId: number) => number | undefined,
): DropAction | undefined {
  if (source.kind === 'node') {
    if (dest.kind === 'tree') {
      const move = resolveMove(state, source.id, dest);
      return move && { type: 'move', id: source.id, ...move };
    }
    // Only items turn back into tabs; folders stay in the sidebar.
    return state.nodes[source.id]?.kind === 'item' ? { type: 'unpin', itemId: source.id, index: dest.index } : undefined;
  }
  if (dest.kind === 'tree') {
    const container = state.nodes[dest.container];
    if (dest.container !== 'favorites' && dest.container !== 'pinned' && container?.kind !== 'folder') return undefined;
    return { type: 'saveTab', tabId: source.tabId, container: dest.container, index: dest.index };
  }
  const from = tabIndex(source.tabId);
  if (from === undefined || finalTabIndex(from, dest.index) === from) return undefined;
  return { type: 'moveTab', tabId: source.tabId, index: dest.index };
}
