import type { ContainerId, Folder, Item, NodeId, SidebarNode, SidebarState } from './types';

export function emptyState(): SidebarState {
  return { version: 1, nodes: {}, favorites: [], pinned: [] };
}

export function newId(): NodeId {
  return crypto.randomUUID();
}

export function childList(state: SidebarState, container: ContainerId): NodeId[] {
  if (container === 'favorites') return state.favorites;
  if (container === 'pinned') return state.pinned;
  const folder = state.nodes[container];
  if (folder?.kind !== 'folder') throw new Error(`Unknown container: ${container}`);
  return folder.childIds;
}

export function findParent(state: SidebarState, id: NodeId): ContainerId | undefined {
  if (state.favorites.includes(id)) return 'favorites';
  if (state.pinned.includes(id)) return 'pinned';
  for (const node of Object.values(state.nodes)) {
    if (node.kind === 'folder' && node.childIds.includes(id)) return node.id;
  }
  return undefined;
}

function isDescendant(state: SidebarState, ancestor: NodeId, id: NodeId): boolean {
  const node = state.nodes[ancestor];
  if (node?.kind !== 'folder') return false;
  return node.childIds.some((child) => child === id || isDescendant(state, child, id));
}

function insertAt(list: NodeId[], id: NodeId, index?: number): NodeId[] {
  const next = [...list];
  next.splice(index ?? next.length, 0, id);
  return next;
}

function withChildList(state: SidebarState, container: ContainerId, list: NodeId[]): SidebarState {
  if (container === 'favorites') return { ...state, favorites: list };
  if (container === 'pinned') return { ...state, pinned: list };
  const folder = state.nodes[container] as Folder;
  return { ...state, nodes: { ...state.nodes, [container]: { ...folder, childIds: list } } };
}

/** Why `node` can't go into `container`, or undefined if it can. */
export function cannotHold(state: SidebarState, container: ContainerId, node: SidebarNode): string | undefined {
  if (container === 'favorites' && node.kind === 'folder') return 'Favorites can only hold items';
  if (node.kind === 'folder' && (container === node.id || isDescendant(state, node.id, container))) {
    return 'Cannot move a folder into itself';
  }
  return undefined;
}

function assertCanHold(state: SidebarState, container: ContainerId, node: SidebarNode) {
  const reason = cannotHold(state, container, node);
  if (reason) throw new Error(reason);
  childList(state, container); // throws on unknown container
}

/** Adds a new node to `container` at `index` (default: end). */
export function addNode(
  state: SidebarState,
  node: SidebarNode,
  container: ContainerId,
  index?: number,
): SidebarState {
  if (state.nodes[node.id]) throw new Error(`Duplicate id: ${node.id}`);
  assertCanHold(state, container, node);
  const withNode = { ...state, nodes: { ...state.nodes, [node.id]: node } };
  return withChildList(withNode, container, insertAt(childList(state, container), node.id, index));
}

export function addItem(
  state: SidebarState,
  fields: Pick<Item, 'title' | 'url'>,
  container: ContainerId,
  index?: number,
): SidebarState {
  return addNode(state, { kind: 'item', id: newId(), ...fields }, container, index);
}

export function addFolder(
  state: SidebarState,
  title: string,
  container: ContainerId,
  index?: number,
): SidebarState {
  return addNode(
    state,
    { kind: 'folder', id: newId(), title, childIds: [], collapsed: false },
    container,
    index,
  );
}

/**
 * Moves `id` into `container` at `index` (default: end). `index` refers to the
 * target list as it looks after the node has been taken out.
 */
export function moveNode(
  state: SidebarState,
  id: NodeId,
  container: ContainerId,
  index?: number,
): SidebarState {
  const node = state.nodes[id];
  const from = findParent(state, id);
  if (!node || from === undefined) throw new Error(`Unknown node: ${id}`);
  assertCanHold(state, container, node);
  const removed = withChildList(state, from, childList(state, from).filter((c) => c !== id));
  return withChildList(removed, container, insertAt(childList(removed, container), id, index));
}

/** Removes a node; removing a folder removes everything inside it. */
export function removeNode(state: SidebarState, id: NodeId): SidebarState {
  const from = findParent(state, id);
  if (from === undefined) throw new Error(`Unknown node: ${id}`);
  const doomed = new Set<NodeId>();
  const collect = (nodeId: NodeId) => {
    doomed.add(nodeId);
    const node = state.nodes[nodeId];
    if (node?.kind === 'folder') node.childIds.forEach(collect);
  };
  collect(id);
  const nodes = Object.fromEntries(Object.entries(state.nodes).filter(([k]) => !doomed.has(k)));
  return withChildList({ ...state, nodes }, from, childList(state, from).filter((c) => c !== id));
}

export function updateNode(
  state: SidebarState,
  id: NodeId,
  patch: Partial<Pick<Item, 'title' | 'url'>> & Partial<Pick<Folder, 'title' | 'collapsed'>>,
): SidebarState {
  const node = state.nodes[id];
  if (!node) throw new Error(`Unknown node: ${id}`);
  return { ...state, nodes: { ...state.nodes, [id]: { ...node, ...patch } as SidebarNode } };
}
