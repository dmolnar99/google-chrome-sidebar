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
